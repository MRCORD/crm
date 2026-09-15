import 'dotenv/config';
import { crmToolHandlers } from '../../mcp/tools';
import { db } from '../index';
import { dashboards, dashboardWidgets, fieldPermissions, opportunities } from '../schema';
import { eq } from 'drizzle-orm';

async function main() {
  console.log('[Test] Starting Reporting & Permissions end-to-end test against live Polygres DB...');

  // 1. Pipeline Funnel Report (reads from live seed data)
  console.log('\n1. Running pipeline funnel report...');
  const funnel = await crmToolHandlers.getPipelineFunnelReport();
  console.log(`✓ Pipeline funnel: ${funnel.stages.length} stage(s) found:`);
  for (const stage of funnel.stages) {
    const amount = (Number(stage.totalAmountMicros) / 1_000_000).toLocaleString();
    console.log(`   ${stage.stage}: ${stage.count} deals, $${amount}`);
  }
  console.log(`  Active pipeline total: $${(Number(funnel.summary.activePipelineMicros) / 1_000_000).toLocaleString()}`);

  // 2. Rep Performance Report
  console.log('\n2. Running rep performance report...');
  const repPerf = await crmToolHandlers.getRepPerformanceReport();
  console.log(`✓ Rep performance: ${repPerf.reps.length} rep(s) tracked.`);
  for (const rep of repPerf.reps) {
    console.log(`   Owner ${rep.ownerId}: total ${rep.total} deals, won ${rep.won}, win rate ${rep.winRatePercent}%`);
  }

  // 3. Deal Velocity Report
  console.log('\n3. Running deal velocity report...');
  const velocity = await crmToolHandlers.getDealVelocityReport();
  console.log(`✓ Deal velocity: ${velocity.stageDistribution.length} active stage(s).`);
  for (const s of velocity.stageDistribution) {
    console.log(`   ${s.stage}: avg ${s.avgDaysInStage} days in stage, ${s.count} active deals`);
  }

  // 4. Engagement Report
  console.log('\n4. Running engagement report for companies...');
  const engagement = await crmToolHandlers.getEngagementReport({ entityType: 'company', limit: 5 });
  console.log(`✓ Engagement: ${engagement.topEntities.length} company entities with activity.`);
  for (const e of engagement.topEntities) {
    console.log(`   ${e.entityId}: ${e.activityCount} activities, last at ${e.lastActivityAt}`);
  }

  // 5. Create Dashboard and Add Widgets
  console.log('\n5. Creating dashboard with 3 widgets...');
  const dashRes = await crmToolHandlers.createDashboard({
    name: 'Q3 Sales Operations Dashboard',
    description: 'Funnel, velocity, and top engagement overview',
    isShared: true,
  });
  const dashId = dashRes.dashboard.id;
  console.log(`✓ Dashboard created: "${dashRes.dashboard.name}" [ID: ${dashId}]`);

  await db.insert(dashboardWidgets).values([
    { dashboardId: dashId, widgetType: 'PIPELINE_FUNNEL', title: 'Pipeline by Stage', config: {}, position: { x: 0, y: 0, w: 6, h: 4 } },
    { dashboardId: dashId, widgetType: 'REP_PERFORMANCE', title: 'Rep Leaderboard', config: {}, position: { x: 6, y: 0, w: 6, h: 4 } },
    { dashboardId: dashId, widgetType: 'ENGAGEMENT', title: 'Most Active Accounts', config: { entityType: 'company' }, position: { x: 0, y: 4, w: 12, h: 4 } },
  ]);

  // 6. Execute Dashboard (runs all 3 widgets live)
  console.log('\n6. Executing dashboard with live widget data...');
  const dashData = await crmToolHandlers.executeDashboard({ dashboardId: dashId });
  console.log(`✓ Dashboard "${dashData.name}" rendered ${dashData.widgets.length} widget(s):`);
  for (const w of dashData.widgets) {
    const hasError = (w.data as any)?.error;
    console.log(`   [${w.widget.widgetType}] "${w.widget.title}": ${hasError ? `ERROR: ${hasError}` : 'OK'}`);
  }
  if (dashData.widgets.some((w) => (w.data as any)?.error)) {
    throw new Error('One or more dashboard widgets returned an error!');
  }

  // 7. Record-Level Visibility: Mark opportunity as PRIVATE
  console.log('\n7. Testing record-level visibility (OPEN -> PRIVATE)...');
  const anyOpp = await db.query.opportunities.findFirst();
  if (anyOpp) {
    const visRes = await crmToolHandlers.setRecordVisibility({
      entityType: 'opportunities',
      recordId: anyOpp.id,
      visibility: 'PRIVATE',
    });
    console.log(`✓ Opportunity ${anyOpp.id} visibility now: "${visRes.record.visibility}"`);
    if (visRes.record.visibility !== 'PRIVATE') {
      throw new Error('Visibility not updated to PRIVATE!');
    }

    // Reset back to OPEN
    await crmToolHandlers.setRecordVisibility({
      entityType: 'opportunities',
      recordId: anyOpp.id,
      visibility: 'OPEN',
    });
    console.log('  Reverted back to OPEN.');
  }

  // 8. Field-Level Permissions
  console.log('\n8. Testing field-level permission configuration...');
  const permRes = await crmToolHandlers.setFieldPermission({
    entityType: 'companies',
    fieldName: 'annualRevenueAmountMicros',
    role: 'guest',
    canRead: false,
    canWrite: false,
  });
  console.log(`✓ Field permission created: ${permRes.permission.entityType}.${permRes.permission.fieldName} for role "${permRes.permission.role}" -> canRead=${permRes.permission.canRead}, canWrite=${permRes.permission.canWrite}`);

  const listRes = await crmToolHandlers.listFieldPermissions({ entityType: 'companies' });
  console.log(`✓ Listed ${listRes.count} field permission rule(s) for companies.`);

  // 9. Cleanup
  console.log('\n9. Cleaning up test data from live DB...');
  await db.delete(dashboardWidgets).where(eq(dashboardWidgets.dashboardId, dashId));
  await db.delete(dashboards).where(eq(dashboards.id, dashId));
  await db.delete(fieldPermissions).where(eq(fieldPermissions.id, permRes.permission.id));
  console.log('✓ Cleanup complete.');

  console.log('\n🎉 ALL REPORTING & PERMISSIONS TESTS PASSED VERIFIED LIVE AGAINST POLYGRES DB!');
  process.exit(0);
}

main().catch((err) => {
  console.error('[Test Failed]', err);
  process.exit(1);
});
