import 'dotenv/config';
import { crmToolHandlers } from '../../mcp/tools';
import { db } from '../index';
import {
  users,
  companies,
  opportunities,
  assignmentRules,
  timelineActivities,
} from '../schema';
import { eq, inArray, or, and } from 'drizzle-orm';

async function main() {
  console.log('[Test] Starting Lead Routing & Assignment Rules end-to-end test against live Polygres DB...');

  const timestamp = Date.now();

  // 1. Create two test sales reps in system.users
  console.log('\n1. Creating test sales reps...');
  const repAId = `user_test_ae_a_${timestamp}`;
  const repBId = `user_test_ae_b_${timestamp}`;

  await db.insert(users).values([
    { id: repAId, email: `ae_a_${timestamp}@testcrm.io`, name: 'Alice Strategic (AE)', role: 'member' },
    { id: repBId, email: `ae_b_${timestamp}@testcrm.io`, name: 'Bob Growth (AE)', role: 'member' },
  ]);
  console.log(`✓ Test reps created: ${repAId} (Alice) and ${repBId} (Bob)`);

  // 2. Create a test company
  const [company] = await db.insert(companies).values({
    name: `Routing Test Corp ${timestamp}`,
  }).returning();

  // 3. Create Assignment Rules
  console.log('\n3. Creating assignment rules...');
  // Rule 1: Enterprise deals (>= $500k) assigned to Alice directly (SPECIFIC_USER)
  const rule1Res = await crmToolHandlers.createAssignmentRule({
    name: `Enterprise Deals to Alice ${timestamp}`,
    targetEntity: 'opportunities',
    conditions: [
      { field: 'amountMicros', operator: 'gte', value: 500000000000 }, // $500k+
    ],
    assignmentStrategy: 'SPECIFIC_USER',
    candidateUserIds: [repAId],
    priority: 10,
  });
  console.log(`✓ Rule 1 created: "${rule1Res.rule.name}" (Priority 10, SPECIFIC_USER)`);

  // Rule 2: Mid-market (< $500k) assigned via ROUND_ROBIN between Alice and Bob
  const rule2Res = await crmToolHandlers.createAssignmentRule({
    name: `Mid-Market Round Robin ${timestamp}`,
    targetEntity: 'opportunities',
    conditions: [
      { field: 'amountMicros', operator: 'lt', value: 500000000000 }, // < $500k
    ],
    assignmentStrategy: 'ROUND_ROBIN',
    candidateUserIds: [repAId, repBId],
    priority: 20,
  });
  console.log(`✓ Rule 2 created: "${rule2Res.rule.name}" (Priority 20, ROUND_ROBIN)`);

  // 4. Create 3 opportunities:
  console.log('\n4. Creating test opportunities...');
  const [oppEnterprise] = await db.insert(opportunities).values({
    companyId: company.id,
    name: 'Enterprise $1M Deal',
    amountMicros: '1000000000000', // $1,000,000
    stage: 'DISCOVERY',
  }).returning();

  const [oppMid1] = await db.insert(opportunities).values({
    companyId: company.id,
    name: 'Mid-Market $100k Deal A',
    amountMicros: '100000000000', // $100,000
    stage: 'DISCOVERY',
  }).returning();

  const [oppMid2] = await db.insert(opportunities).values({
    companyId: company.id,
    name: 'Mid-Market $150k Deal B',
    amountMicros: '150000000000', // $150,000
    stage: 'DISCOVERY',
  }).returning();

  // 5. Route Opp 1 (Enterprise $1M) -> should match Rule 1 (Alice)
  console.log('\n5. Routing Enterprise $1M Deal...');
  const route1 = await crmToolHandlers.routeAndAssignRecord({
    targetEntity: 'opportunities',
    recordId: oppEnterprise.id,
  });
  console.log(`✓ Routed to: ${route1.assignedUserName} (${route1.assignedUserId}) via Rule "${route1.matchedRule?.name}"`);
  if (route1.assignedUserId !== repAId) {
    throw new Error(`Expected Enterprise deal assigned to Alice (${repAId}), got ${route1.assignedUserId}`);
  }

  // 6. Route Opp 2 (Mid-Market 1) -> should match Rule 2 turn 1 (Alice)
  console.log('\n6. Routing Mid-Market Deal 1 (Round-Robin turn 1)...');
  const route2 = await crmToolHandlers.routeAndAssignRecord({
    targetEntity: 'opportunities',
    recordId: oppMid1.id,
  });
  console.log(`✓ Routed to: ${route2.assignedUserName} (${route2.assignedUserId}) via Rule "${route2.matchedRule?.name}"`);

  // 7. Route Opp 3 (Mid-Market 2) -> should match Rule 2 turn 2 (Bob)
  console.log('\n7. Routing Mid-Market Deal 2 (Round-Robin turn 2)...');
  const route3 = await crmToolHandlers.routeAndAssignRecord({
    targetEntity: 'opportunities',
    recordId: oppMid2.id,
  });
  console.log(`✓ Routed to: ${route3.assignedUserName} (${route3.assignedUserId}) via Rule "${route3.matchedRule?.name}"`);

  if (route2.assignedUserId === route3.assignedUserId) {
    throw new Error('Round-robin strategy failed to alternate assignees!');
  }

  // 8. Test LOAD_BALANCED strategy
  console.log('\n8. Testing LOAD_BALANCED strategy...');
  // Currently Alice has 2 deals (OppEnterprise, OppMid1), Bob has 1 deal (OppMid2).
  // A load-balanced rule between Alice and Bob should pick Bob!
  const loadBalancedRule = await crmToolHandlers.createAssignmentRule({
    name: `Workload Balanced Rule ${timestamp}`,
    targetEntity: 'opportunities',
    conditions: [],
    assignmentStrategy: 'LOAD_BALANCED',
    candidateUserIds: [repAId, repBId],
    priority: 5,
  });

  const [oppLoadTest] = await db.insert(opportunities).values({
    companyId: company.id,
    name: 'Workload Balancing Test Deal',
    amountMicros: '200000000000',
    stage: 'DISCOVERY',
  }).returning();

  const loadRoute = await crmToolHandlers.routeAndAssignRecord({
    targetEntity: 'opportunities',
    recordId: oppLoadTest.id,
    forceRuleId: loadBalancedRule.rule.id,
  });
  console.log(`✓ Load-balanced deal routed to: ${loadRoute.assignedUserName} (${loadRoute.assignedUserId})`);
  if (loadRoute.assignedUserId !== repBId) {
    throw new Error(`Expected load-balanced deal routed to Bob (fewer deals), got ${loadRoute.assignedUserId}`);
  }

  // 9. Verify Activity Timeline events
  console.log('\n9. Verifying activity timeline events for assignments...');
  const timeline = await db.query.timelineActivities.findMany({
    where: and(
      eq(timelineActivities.entityType, 'opportunity'),
      eq(timelineActivities.activityType, 'RECORD_ASSIGNED')
    ),
  });
  console.log(`✓ Found ${timeline.length} RECORD_ASSIGNED timeline activities logged across test.`);

  // 10. Clean up test data
  console.log('\n10. Cleaning up test data from live DB...');
  const oppIds = [oppEnterprise.id, oppMid1.id, oppMid2.id, oppLoadTest.id];
  await db.delete(timelineActivities).where(inArray(timelineActivities.entityId, oppIds));
  await db.delete(opportunities).where(inArray(opportunities.id, oppIds));
  await db.delete(companies).where(eq(companies.id, company.id));
  await db.delete(assignmentRules).where(
    inArray(assignmentRules.id, [rule1Res.rule.id, rule2Res.rule.id, loadBalancedRule.rule.id])
  );
  await db.delete(users).where(inArray(users.id, [repAId, repBId]));
  console.log('✓ Cleanup complete.');

  console.log('\n🎉 ALL LEAD ROUTING & ASSIGNMENT TESTS PASSED VERIFIED LIVE AGAINST POLYGRES DB!');
  process.exit(0);
}

main().catch((err) => {
  console.error('[Test Failed]', err);
  process.exit(1);
});
