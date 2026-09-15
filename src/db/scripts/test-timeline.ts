import 'dotenv/config';
import { crmToolHandlers } from '../../mcp/tools';
import { readCrmResource } from '../../mcp/resources';
import { db } from '../index';
import { companies, opportunities, timelineActivities, tags, taggables } from '../schema';
import { eq } from 'drizzle-orm';

async function main() {
  console.log('[Test] Starting Activity Timeline end-to-end test against live DB...');

  // 1. Create a test company via MCP tool -> should auto-log RECORD_CREATED
  const companyName = `Timeline Test Corp ${Date.now()}`;
  console.log(`\n1. Creating test company: "${companyName}"...`);
  const createResult = await crmToolHandlers.createCompany({
    name: companyName,
    domainName: 'timelinetest.ai',
    industry: 'Enterprise Software',
  });
  const companyId = createResult.company.id;
  console.log(`✓ Company created with ID: ${companyId}`);

  // 2. Explicitly log an activity via crm_log_timeline_activity tool
  console.log('\n2. Explicitly logging an outreach activity via tool...');
  const explicitLog = await crmToolHandlers.logTimelineActivity({
    entityType: 'company',
    entityId: companyId,
    activityType: 'EMAIL_SENT',
    actorSource: 'AGENT',
    actorName: 'Apollo Outbound Agent',
    properties: {
      subject: 'Intro to mysios CRM',
      touchpointNumber: 1,
      recipientEmail: 'founder@timelinetest.ai',
    },
  });
  console.log(`✓ Explicit activity logged: ${explicitLog.summary}`);

  // 3. Attach a tag via tag tool -> should auto-log TAG_ADDED
  console.log('\n3. Attaching "Hot Lead" tag to company...');
  await crmToolHandlers.tagRecord({
    tagName: 'Timeline-Hot-Lead',
    taggableType: 'company',
    taggableId: companyId,
  });
  console.log('✓ Tag attached');

  // 4. Create an opportunity for this company
  console.log('\n4. Creating test opportunity...');
  const [opp] = await db.insert(opportunities).values({
    companyId,
    name: `${companyName} Pilot`,
    stage: 'DISCOVERY',
    amountMicros: '75000000000', // $75,000
  }).returning();
  console.log(`✓ Opportunity created: ${opp.id}`);

  // 5. Update opportunity stage -> should auto-log STAGE_CHANGED to both opportunity AND company
  console.log('\n5. Updating opportunity stage to PROPOSAL...');
  await crmToolHandlers.updateOpportunityStage({
    opportunityId: opp.id,
    newStage: 'PROPOSAL',
    healthScore: 0.85,
    reason: 'Executive sponsor approved budget proposal',
  });
  console.log('✓ Opportunity stage updated');

  // 6. Detach the tag -> should auto-log TAG_REMOVED
  console.log('\n6. Removing tag from company...');
  await crmToolHandlers.untagRecord({
    tagName: 'Timeline-Hot-Lead',
    taggableType: 'company',
    taggableId: companyId,
  });
  console.log('✓ Tag removed');

  // 7. Query the timeline via crm_get_timeline tool
  console.log(`\n7. Querying timeline for company ${companyId}...`);
  const timelineResult = await crmToolHandlers.getTimeline({
    entityType: 'company',
    entityId: companyId,
    limit: 10,
  });
  console.log(`✓ Found ${timelineResult.totalCount} timeline activities for company:`);
  for (const act of timelineResult.activities) {
    console.log(`   • [${act.activityType}] ${act.summary}`);
  }

  if (timelineResult.totalCount < 4) {
    throw new Error(`Expected at least 4 activities, found ${timelineResult.totalCount}`);
  }

  // 8. Query the timeline for the opportunity
  console.log(`\n8. Querying timeline for opportunity ${opp.id}...`);
  const oppTimeline = await crmToolHandlers.getTimeline({
    entityType: 'opportunity',
    entityId: opp.id,
    limit: 10,
  });
  console.log(`✓ Found ${oppTimeline.totalCount} timeline activities for opportunity:`);
  for (const act of oppTimeline.activities) {
    console.log(`   • [${act.activityType}] ${act.summary}`);
  }

  // 9. Verify MCP Resource crm://companies/{id} includes the embedded timeline
  console.log('\n9. Reading MCP Resource crm://companies/{id}...');
  const resourcePayload = await readCrmResource(`crm://companies/${companyId}`);
  const parsed = JSON.parse(resourcePayload);
  console.log(`✓ Resource loaded successfully! Embedded timeline events count: ${parsed.timeline?.length}`);
  if (!parsed.timeline || parsed.timeline.length === 0) {
    throw new Error('Resource payload does not contain embedded timeline');
  }

  // Cleanup test artifacts
  console.log('\n10. Cleaning up test records from live DB...');
  await db.delete(timelineActivities).where(eq(timelineActivities.entityId, companyId));
  await db.delete(timelineActivities).where(eq(timelineActivities.entityId, opp.id));
  await db.delete(opportunities).where(eq(opportunities.id, opp.id));
  await db.delete(companies).where(eq(companies.id, companyId));
  console.log('✓ Cleanup complete.');

  console.log('\n🎉 ALL ACTIVITY TIMELINE TESTS PASSED VERIFIED LIVE AGAINST POLYGRES DB!');
  process.exit(0);
}

main().catch((err) => {
  console.error('[Test Failed]', err);
  process.exit(1);
});
