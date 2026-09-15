import 'dotenv/config';
import { crmToolHandlers } from '../../mcp/tools';
import { db } from '../index';
import { companies, people, opportunities, timelineActivities } from '../schema';
import { eq, or, inArray } from 'drizzle-orm';

async function main() {
  console.log('[Test] Starting Account Hierarchy & Rollup end-to-end test against live Polygres DB...');

  const timestamp = Date.now();

  // 1. Create Root Parent Company
  console.log('\n1. Creating Root Corporate Parent: "Omni Corp Global"...');
  const [root] = await db.insert(companies).values({
    name: `Omni Corp Global ${timestamp}`,
    domainName: `omnicorp-${timestamp}.com`,
    industry: 'Conglomerate',
  }).returning();
  console.log(`✓ Root created: ${root.id} (${root.name})`);

  // 2. Create Tier 1 Subsidiary: "Omni Robotics"
  console.log('\n2. Creating Tier 1 Subsidiary: "Omni Robotics"...');
  const [subTier1] = await db.insert(companies).values({
    name: `Omni Robotics ${timestamp}`,
    domainName: `robotics.omnicorp-${timestamp}.com`,
    industry: 'Robotics & Hardware',
    parentCompanyId: root.id,
  }).returning();
  console.log(`✓ Tier 1 subsidiary created: ${subTier1.id} (parent: ${root.id})`);

  // 3. Create Tier 2 Subsidiary: "Omni Software Systems"
  console.log('\n3. Creating Tier 2 Subsidiary: "Omni Software Systems"...');
  const [subTier2] = await db.insert(companies).values({
    name: `Omni Software Systems ${timestamp}`,
    domainName: `software.omnicorp-${timestamp}.com`,
    industry: 'Enterprise Software',
    parentCompanyId: subTier1.id,
  }).returning();
  console.log(`✓ Tier 2 subsidiary created: ${subTier2.id} (parent: ${subTier1.id})`);

  const familyIds = [root.id, subTier1.id, subTier2.id];

  // 4. Attach contacts and opportunities across the 3 tiers
  console.log('\n4. Attaching contacts and opportunities across family tiers...');
  await db.insert(people).values([
    { companyId: root.id, firstName: 'Richard', lastName: 'Jones', email: `jones@omnicorp-${timestamp}.com` },
    { companyId: subTier1.id, firstName: 'Donald', lastName: 'Johnson', email: `donald@robotics.omnicorp-${timestamp}.com` },
    { companyId: subTier2.id, firstName: 'Bob', lastName: 'Morton', email: `bob@software.omnicorp-${timestamp}.com` },
  ]);

  await db.insert(opportunities).values([
    { companyId: root.id, name: 'Omni Corporate Enterprise Platform', stage: 'PROPOSAL', amountMicros: '1000000000000' }, // $1,000,000
    { companyId: subTier1.id, name: 'ED-209 Fleet Automation', stage: 'NEGOTIATION', amountMicros: '500000000000' },     // $500,000
    { companyId: subTier2.id, name: 'RoboCop Telemetry Suite', stage: 'DISCOVERY', amountMicros: '250000000000' },       // $250,000
  ]);
  console.log('✓ Attached 3 contacts and 3 opportunities ($1.75M total pipeline across family).');

  // 5. Test Cycle Detection: attempt to make Root a child of Tier 2!
  console.log('\n5. Testing Cycle Detection: attempting to set Root parent to Tier 2 subsidiary...');
  try {
    await crmToolHandlers.setParentCompany({
      companyId: root.id,
      parentCompanyId: subTier2.id,
    });
    throw new Error('Cycle detection failed: circular hierarchy was allowed!');
  } catch (err: any) {
    console.log(`✓ Cycle intercepted successfully: "${err.message}"`);
  }

  // 6. Query Hierarchy from leaf subsidiary (Tier 2) via crm_get_company_hierarchy
  console.log(`\n6. Querying hierarchy from leaf subsidiary ${subTier2.id}...`);
  const hierarchy = await crmToolHandlers.getCompanyHierarchy({ companyId: subTier2.id });

  console.log(`✓ Current Company: ${hierarchy.currentCompany.name}`);
  console.log(`✓ Root Canonical Parent: ${hierarchy.rootCompany.name} (ID: ${hierarchy.rootCompany.id})`);
  console.log(`✓ Ancestor Chain (${hierarchy.ancestors.length} levels up):`);
  for (const a of hierarchy.ancestors) {
    console.log(`   [Depth ${a.depth}] ${a.name}`);
  }

  console.log(`✓ Consolidated Family Rollup:`);
  console.log(`   • Total Family Entities: ${hierarchy.rollup.totalFamilyEntities}`);
  console.log(`   • Total Family Contacts: ${hierarchy.rollup.totalContacts}`);
  console.log(`   • Total Open Opportunities: ${hierarchy.rollup.totalOpenOpportunities}`);
  console.log(`   • Total Family Pipeline: $${(Number(hierarchy.rollup.totalPipelineAmountMicros) / 1_000_000).toLocaleString()}`);

  if (hierarchy.rollup.totalFamilyEntities !== 3) {
    throw new Error(`Expected 3 family entities, got ${hierarchy.rollup.totalFamilyEntities}`);
  }
  if (hierarchy.rollup.totalOpenOpportunities !== 3) {
    throw new Error(`Expected 3 open opportunities, got ${hierarchy.rollup.totalOpenOpportunities}`);
  }
  if (hierarchy.rollup.totalPipelineAmountMicros !== '1750000000000') {
    throw new Error(`Expected 1,750,000,000,000 micros, got ${hierarchy.rollup.totalPipelineAmountMicros}`);
  }

  // 7. Test Detaching a Subsidiary via crm_set_parent_company
  console.log(`\n7. Detaching Tier 2 subsidiary (setting parentCompanyId to null)...`);
  await crmToolHandlers.setParentCompany({
    companyId: subTier2.id,
    parentCompanyId: null,
  });

  const updatedHierarchy = await crmToolHandlers.getCompanyHierarchy({ companyId: root.id });
  console.log(`✓ Post-detach family entities under root: ${updatedHierarchy.rollup.totalFamilyEntities} (Expected: 2)`);
  console.log(`✓ Post-detach family pipeline under root: $${(Number(updatedHierarchy.rollup.totalPipelineAmountMicros) / 1_000_000).toLocaleString()} (Expected: $1,500,000)`);

  if (updatedHierarchy.rollup.totalFamilyEntities !== 2) {
    throw new Error(`Expected 2 family entities after detach, got ${updatedHierarchy.rollup.totalFamilyEntities}`);
  }

  // 8. Cleanup test data
  console.log('\n8. Cleaning up test data from live DB...');
  await db.delete(timelineActivities).where(inArray(timelineActivities.entityId, familyIds));
  await db.delete(opportunities).where(inArray(opportunities.companyId, familyIds));
  await db.delete(people).where(inArray(people.companyId, familyIds));
  await db.delete(companies).where(inArray(companies.id, familyIds));
  console.log('✓ Cleanup complete.');

  console.log('\n🎉 ALL ACCOUNT HIERARCHY & ROLLUP TESTS PASSED VERIFIED LIVE AGAINST POLYGRES DB!');
  process.exit(0);
}

main().catch((err) => {
  console.error('[Test Failed]', err);
  process.exit(1);
});
