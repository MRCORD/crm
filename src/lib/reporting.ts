import { db } from '../db';
import {
  opportunities,
  companies,
  people,
  timelineActivities,
  dashboards,
  dashboardWidgets,
  pipelineStages,
  stageCategories,
} from '../db/schema';
import { eq, and, sql, desc, asc, isNull } from 'drizzle-orm';

export type WidgetType =
  | 'PIPELINE_FUNNEL'
  | 'REP_PERFORMANCE'
  | 'DEAL_VELOCITY'
  | 'ENGAGEMENT'
  | 'NUMBER'
  | 'TABLE';

/**
 * Pipeline funnel: opportunity count and total value by stage.
 * Ordering and open/closed classification come from `crm.pipeline_stages` /
 * `crm.stage_categories` rather than a hardcoded stage list, so custom
 * stages sort and roll up correctly without a code change.
 */
export async function getPipelineFunnelReport() {
  const rows = await db
    .select({
      stage: opportunities.stage,
      count: sql<number>`count(*)::int`,
      totalAmountMicros: sql<string>`coalesce(sum(${opportunities.amountMicros}::numeric), 0)::text`,
      avgHealthScore: sql<string>`round(coalesce(avg(${opportunities.healthScore}::numeric), 0), 2)::text`,
    })
    .from(opportunities)
    .where(isNull(opportunities.deletedAt))
    .groupBy(opportunities.stage);

  const stageMeta = await db
    .select({
      key: pipelineStages.key,
      sortOrder: pipelineStages.sortOrder,
      isClosed: stageCategories.isClosed,
      isWon: stageCategories.isWon,
    })
    .from(pipelineStages)
    .innerJoin(stageCategories, eq(pipelineStages.categoryId, stageCategories.id));

  const metaByKey = new Map(stageMeta.map((m) => [m.key, m]));
  const isClosedStage = (stage: string) => metaByKey.get(stage)?.isClosed ?? false;

  const sortedRows = [...rows].sort(
    (a, b) => (metaByKey.get(a.stage)?.sortOrder ?? 999) - (metaByKey.get(b.stage)?.sortOrder ?? 999)
  );

  const totalPipelineMicros = sortedRows
    .filter((r) => !isClosedStage(r.stage))
    .reduce((s, r) => s + BigInt(r.totalAmountMicros), BigInt(0));

  return {
    reportType: 'PIPELINE_FUNNEL',
    generatedAt: new Date().toISOString(),
    stages: sortedRows,
    summary: {
      totalActiveStages: sortedRows.filter((r) => !isClosedStage(r.stage)).length,
      activePipelineMicros: totalPipelineMicros.toString(),
    },
  };
}

/**
 * Rep performance: win/loss counts, rates, and total pipeline per owner.
 */
export async function getRepPerformanceReport() {
  const rows = await db
    .select({
      ownerId: opportunities.ownerId,
      total: sql<number>`count(*)::int`,
      won: sql<number>`count(*) FILTER (WHERE stage = 'CLOSED_WON')::int`,
      lost: sql<number>`count(*) FILTER (WHERE stage = 'CLOSED_LOST')::int`,
      activePipelineMicros: sql<string>`coalesce(sum(amount_micros::numeric) FILTER (WHERE stage NOT IN ('CLOSED_WON','CLOSED_LOST') AND deleted_at IS NULL), 0)::text`,
      wonAmountMicros: sql<string>`coalesce(sum(amount_micros::numeric) FILTER (WHERE stage = 'CLOSED_WON'), 0)::text`,
    })
    .from(opportunities)
    .where(isNull(opportunities.deletedAt))
    .groupBy(opportunities.ownerId)
    .orderBy(desc(sql`sum(amount_micros::numeric) FILTER (WHERE stage = 'CLOSED_WON')`));

  return {
    reportType: 'REP_PERFORMANCE',
    generatedAt: new Date().toISOString(),
    reps: rows.map((r) => {
      const winRate = r.total > 0 ? ((r.won / r.total) * 100).toFixed(1) : '0.0';
      return { ...r, winRatePercent: winRate };
    }),
  };
}

/**
 * Deal velocity: average days to close by stage.
 */
export async function getDealVelocityReport() {
  const wonDeals = await db
    .select({
      count: sql<number>`count(*)::int`,
      avgDaysToClose: sql<string>`round(avg(extract(epoch from (updated_at - created_at)) / 86400), 1)::text`,
      avgAmountMicros: sql<string>`round(avg(amount_micros::numeric), 0)::text`,
    })
    .from(opportunities)
    .where(and(isNull(opportunities.deletedAt), eq(opportunities.stage, 'CLOSED_WON')));

  const stageDistribution = await db
    .select({
      stage: opportunities.stage,
      avgDaysInStage: sql<string>`round(avg(extract(epoch from (now() - updated_at)) / 86400), 1)::text`,
      count: sql<number>`count(*)::int`,
    })
    .from(opportunities)
    .where(and(isNull(opportunities.deletedAt), sql`stage NOT IN ('CLOSED_WON','CLOSED_LOST')`))
    .groupBy(opportunities.stage);

  return {
    reportType: 'DEAL_VELOCITY',
    generatedAt: new Date().toISOString(),
    closedWonSummary: wonDeals[0] ?? null,
    stageDistribution,
  };
}

/**
 * Account engagement: activity count by entity.
 */
export async function getEngagementReport(entityType: 'company' | 'opportunity' | 'person' = 'company', limit = 20) {
  const rows = await db
    .select({
      entityId: timelineActivities.entityId,
      activityCount: sql<number>`count(*)::int`,
      lastActivityAt: sql<string>`max(happened_at)::text`,
    })
    .from(timelineActivities)
    .where(eq(timelineActivities.entityType, entityType))
    .groupBy(timelineActivities.entityId)
    .orderBy(desc(sql`count(*)`))
    .limit(limit);

  return {
    reportType: 'ENGAGEMENT',
    entityType,
    generatedAt: new Date().toISOString(),
    topEntities: rows,
  };
}

/**
 * Create a saved dashboard.
 */
export async function createDashboard(input: {
  name: string;
  description?: string;
  organizationId?: string | null;
  ownerId?: string | null;
  isShared?: boolean;
}) {
  const [dash] = await db.insert(dashboards).values({
    name: input.name,
    description: input.description ?? null,
    organizationId: input.organizationId ?? null,
    ownerId: input.ownerId ?? null,
    isShared: input.isShared ?? false,
  }).returning();
  return dash;
}

/**
 * Add a widget to a dashboard.
 */
export async function addDashboardWidget(input: {
  dashboardId: string;
  widgetType: WidgetType;
  title: string;
  config?: Record<string, unknown>;
  position?: Record<string, unknown>;
}) {
  const [widget] = await db.insert(dashboardWidgets).values({
    dashboardId: input.dashboardId,
    widgetType: input.widgetType,
    title: input.title,
    config: input.config ?? {},
    position: input.position ?? { x: 0, y: 0, w: 6, h: 4 },
  }).returning();
  return widget;
}

/**
 * Execute a dashboard: run all widgets and return their data.
 */
export async function executeDashboard(dashboardId: string) {
  const dashboard = await db.query.dashboards.findFirst({
    where: eq(dashboards.id, dashboardId),
    with: { widgets: true },
  });

  if (!dashboard) throw new Error(`Dashboard ${dashboardId} not found`);

  const widgetResults = await Promise.all(
    dashboard.widgets.map(async (widget) => {
      let data: unknown = null;
      try {
        switch (widget.widgetType) {
          case 'PIPELINE_FUNNEL':
            data = await getPipelineFunnelReport();
            break;
          case 'REP_PERFORMANCE':
            data = await getRepPerformanceReport();
            break;
          case 'DEAL_VELOCITY':
            data = await getDealVelocityReport();
            break;
          case 'ENGAGEMENT':
            data = await getEngagementReport((widget.config as any)?.entityType ?? 'company');
            break;
        }
      } catch (err: any) {
        data = { error: err.message };
      }

      return { widget, data };
    })
  );

  return {
    dashboardId,
    name: dashboard.name,
    renderedAt: new Date().toISOString(),
    widgets: widgetResults,
  };
}
