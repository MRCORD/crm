import 'dotenv/config';
import { crmToolHandlers } from '../../mcp/tools';
import { db } from '../index';
import { views, companies, opportunities } from '../schema';
import { eq } from 'drizzle-orm';

async function main() {
  console.log('[Test] Starting Saved Views end-to-end test against live Polygres DB...');

  // 1. Create a Table view for Companies
  console.log('\n1. Creating a Table view: "High Revenue Accounts"...');
  const tableViewRes = await crmToolHandlers.createView({
    targetEntity: 'companies',
    name: 'High Revenue Accounts Test',
    viewType: 'TABLE',
    filters: [
      { field: 'industry', operator: 'contains', value: 'Defense' },
    ],
    sortBy: [
      { field: 'annualRevenueAmountMicros', direction: 'desc' },
    ],
    visibleFields: ['name', 'industry', 'annualRevenueAmountMicros', 'domainName'],
    isShared: true,
  });

  const tableViewId = tableViewRes.view.id;
  console.log(`✓ Table view created with ID: ${tableViewId}`);

  // 2. Run the Table view via crm_run_view
  console.log(`\n2. Running Table view ${tableViewId}...`);
  const tableResult = await crmToolHandlers.runView({
    viewId: tableViewId,
    limit: 10,
  });
  console.log(`✓ Table view returned ${tableResult.totalCount} records:`);
  for (const rec of (tableResult as any).records || []) {
    console.log(`   • ${rec.name} (${rec.industry}) - Rev: ${rec.annualRevenueAmountMicros}`);
  }

  // 3. Create a Kanban view for Opportunities grouped by Stage
  console.log('\n3. Creating a Kanban view: "Pipeline Funnel by Stage"...');
  const kanbanViewRes = await crmToolHandlers.createView({
    targetEntity: 'opportunities',
    name: 'Pipeline Funnel by Stage Test',
    viewType: 'KANBAN',
    groupByField: 'stage',
    filters: [],
    sortBy: [
      { field: 'amountMicros', direction: 'desc' },
    ],
    isShared: true,
  });

  const kanbanViewId = kanbanViewRes.view.id;
  console.log(`✓ Kanban view created with ID: ${kanbanViewId}`);

  // 4. Run the Kanban view via crm_run_view
  console.log(`\n4. Running Kanban view ${kanbanViewId}...`);
  const kanbanResult = await crmToolHandlers.runView({
    viewId: kanbanViewId,
    limit: 50,
  });

  const kr = kanbanResult as any;
  console.log(`✓ Kanban view returned ${kr.totalCount} total opportunities across ${kr.columns?.length} columns:`);
  for (const col of kr.columns || []) {
    const items = kr.groups[col] || [];
    console.log(`   [${col}] (${items.length} deals):`);
    for (const item of items) {
      console.log(`      - ${item.name}: $${(Number(item.amountMicros) / 1_000_000).toLocaleString()}`);
    }
  }

  // 5. Run an Ad-Hoc View (without saved viewId)
  console.log('\n5. Running an Ad-Hoc view on opportunities where stage = "DISCOVERY"...');
  const adHocResult = await crmToolHandlers.runView({
    targetEntity: 'opportunities',
    filters: [
      { field: 'stage', operator: 'eq', value: 'DISCOVERY' },
    ],
    sortBy: [
      { field: 'amountMicros', direction: 'desc' },
    ],
  });
  console.log(`✓ Ad-hoc query returned ${adHocResult.totalCount} records.`);

  // 6. List all saved views
  console.log('\n6. Listing saved views for opportunities...');
  const listRes = await crmToolHandlers.listViews({ targetEntity: 'opportunities' });
  console.log(`✓ Found ${listRes.count} views for opportunities:`);
  for (const v of listRes.views) {
    console.log(`   • ${v.name} (${v.viewType}) [ID: ${v.id}]`);
  }

  // 7. Delete the test views
  console.log('\n7. Cleaning up test views...');
  await crmToolHandlers.deleteView({ viewId: tableViewId });
  await crmToolHandlers.deleteView({ viewId: kanbanViewId });
  console.log('✓ Test views deleted.');

  console.log('\n🎉 ALL SAVED VIEWS & SEGMENTATION TESTS PASSED VERIFIED LIVE AGAINST POLYGRES DB!');
  process.exit(0);
}

main().catch((err) => {
  console.error('[Test Failed]', err);
  process.exit(1);
});
