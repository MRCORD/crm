import 'dotenv/config';
import { crmToolHandlers } from '../../mcp/tools';
import { db } from '../index';
import { companies, people, opportunities, timelineActivities, mergeCandidates, mcpApprovals } from '../schema';
import { eq, or, and } from 'drizzle-orm';

async function main() {
  console.log('[Test] Starting Duplicate Detection & Merge end-to-end test against live Polygres DB...');

  const timestamp = Date.now();
  const domain = `initech-${timestamp}.com`;

  // 1. Create primary company
  console.log('\n1. Creating canonical company "Initech Global"...');
  const [primaryCompany] = await db.insert(companies).values({
    name: 'Initech Global',
    domainName: domain,
    industry: 'Enterprise Technology',
  }).returning();
  console.log(`✓ Primary company created: ${primaryCompany.id}`);

  // 2. Create duplicate company (with slight name variance & prefixed URL)
  console.log('\n2. Creating duplicate company "Initech Global Corp"...');
  const [duplicateCompany] = await db.insert(companies).values({
    name: 'Initech Global Corp',
    domainName: `https://www.${domain}/careers`,
    industry: 'Enterprise Technology',
  }).returning();
  console.log(`✓ Duplicate company created: ${duplicateCompany.id}`);

  // 3. Attach an opportunity to the duplicate company
  console.log('\n3. Attaching opportunity to duplicate company...');
  const [opp] = await db.insert(opportunities).values({
    companyId: duplicateCompany.id,
    name: 'Initech TPS Report Software License',
    stage: 'DISCOVERY',
    amountMicros: '50000000000', // $50,000
  }).returning();
  console.log(`✓ Opportunity created pointing to duplicate: ${opp.id}`);

  // 4. Attach a contact to the duplicate company
  console.log('\n4. Attaching contact to duplicate company...');
  const [contact] = await db.insert(people).values({
    companyId: duplicateCompany.id,
    firstName: 'Peter',
    lastName: 'Gibbons',
    email: `peter@${domain}`,
  }).returning();
  console.log(`✓ Contact created pointing to duplicate: ${contact.id}`);

  // 5. Run Duplicate Detection via crm_find_duplicates tool
  console.log('\n5. Scanning for duplicates using crm_find_duplicates...');
  const scanResult = await crmToolHandlers.findDuplicates({
    entityType: 'company',
    recordId: primaryCompany.id,
    minConfidence: 0.70,
  });
  console.log(`✓ Detected ${scanResult.foundCount} candidate(s):`);
  for (const c of scanResult.candidates) {
    console.log(`   • ${c.primarySummary} <-> ${c.duplicateSummary} (Confidence: ${c.confidenceScore}, Reason: ${c.matchReason})`);
  }

  if (scanResult.foundCount === 0) {
    throw new Error('Failed to detect duplicate company pair!');
  }

  // 6. Verify candidate persisted in crm.merge_candidates
  console.log('\n6. Checking crm.merge_candidates table...');
  const candidateList = await crmToolHandlers.listMergeCandidates({
    entityType: 'company',
    status: 'PENDING',
  });
  console.log(`✓ Found ${candidateList.count} pending merge candidate(s) in CRM queue.`);

  // 7. Test Tier 4 HITL Gate: attempt merge without explicit approval
  console.log('\n7. Testing Tier 4 HITL Gate (calling crm_merge_records without approved=true)...');
  const gateResult = await crmToolHandlers.mergeRecords({
    entityType: 'company',
    primaryRecordId: primaryCompany.id,
    duplicateRecordId: duplicateCompany.id,
    approved: false,
    reason: 'Routine deduplication scan',
  });
  console.log(`✓ Gated response received: status = "${gateResult.status}"`);
  console.log(`  Message: ${gateResult.message}`);
  if (gateResult.status !== 'PENDING_APPROVAL' || !gateResult.approvalId) {
    throw new Error('Tier 4 approval gate failed to intercept unapproved merge!');
  }

  // 8. Execute authorized merge: approved = true
  console.log('\n8. Executing authorized merge (approved=true)...');
  const mergeResult = await crmToolHandlers.mergeRecords({
    entityType: 'company',
    primaryRecordId: primaryCompany.id,
    duplicateRecordId: duplicateCompany.id,
    approved: true,
  });
  console.log(`✓ Merge executed successfully: status = "${mergeResult.status}"`);
  console.log(`  Re-pointed counts:`, mergeResult.rePointedCounts);

  // 9. Verify re-pointed records and soft deletion
  console.log('\n9. Verifying database state after merge...');
  const updatedOpp = await db.query.opportunities.findFirst({ where: eq(opportunities.id, opp.id) });
  console.log(`  Opportunity companyId now: ${updatedOpp?.companyId} (Expected: ${primaryCompany.id})`);
  if (updatedOpp?.companyId !== primaryCompany.id) {
    throw new Error('Opportunity was not re-pointed to primary company!');
  }

  const updatedContact = await db.query.people.findFirst({ where: eq(people.id, contact.id) });
  console.log(`  Contact companyId now: ${updatedContact?.companyId} (Expected: ${primaryCompany.id})`);
  if (updatedContact?.companyId !== primaryCompany.id) {
    throw new Error('Contact was not re-pointed to primary company!');
  }

  const deletedDuplicate = await db.query.companies.findFirst({ where: eq(companies.id, duplicateCompany.id) });
  console.log(`  Duplicate company deletedAt: ${deletedDuplicate?.deletedAt ? 'SET (Soft Deleted)' : 'NULL'}`);
  if (!deletedDuplicate?.deletedAt) {
    throw new Error('Duplicate company was not soft deleted!');
  }

  // 10. Verify timeline activity logged on primary company
  const timeline = await db.query.timelineActivities.findMany({
    where: and(
      eq(timelineActivities.entityType, 'company'),
      eq(timelineActivities.entityId, primaryCompany.id),
      eq(timelineActivities.activityType, 'RECORD_MERGED')
    ),
  });
  console.log(`✓ Found ${timeline.length} RECORD_MERGED event on primary company timeline.`);
  if (timeline.length === 0) {
    throw new Error('RECORD_MERGED event was not recorded on primary company timeline!');
  }

  // 11. Cleanup test records
  console.log('\n11. Cleaning up test records...');
  await db.delete(mcpApprovals).where(eq(mcpApprovals.id, gateResult.approvalId));
  await db.delete(timelineActivities).where(
    or(
      eq(timelineActivities.entityId, primaryCompany.id),
      eq(timelineActivities.entityId, duplicateCompany.id)
    )
  );
  await db.delete(mergeCandidates).where(
    or(
      eq(mergeCandidates.primaryRecordId, primaryCompany.id),
      eq(mergeCandidates.duplicateRecordId, duplicateCompany.id)
    )
  );
  await db.delete(opportunities).where(eq(opportunities.id, opp.id));
  await db.delete(people).where(eq(people.id, contact.id));
  await db.delete(companies).where(
    or(
      eq(companies.id, primaryCompany.id),
      eq(companies.id, duplicateCompany.id)
    )
  );
  console.log('✓ Cleanup complete.');

  console.log('\n🎉 ALL DUPLICATE DETECTION & RECORD MERGE TESTS PASSED VERIFIED LIVE AGAINST POLYGRES DB!');
  process.exit(0);
}

main().catch((err) => {
  console.error('[Test Failed]', err);
  process.exit(1);
});
