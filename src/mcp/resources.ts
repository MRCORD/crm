import { db } from '../db';
import { companies, opportunities, interactionTranscripts } from '../db/schema';
import { eq, sql } from 'drizzle-orm';
import { getTimelineActivities, formatTimelineActivity } from '../lib/timeline';

/**
 * Static and Dynamic MCP Resources
 */
export const crmResources = [
  {
    uri: 'crm://pipeline/summary',
    name: 'Active Sales Pipeline Summary',
    description: 'Aggregated active opportunities broken down by stage with total values and counts.',
    mimeType: 'application/json',
  },
  {
    uriTemplate: 'crm://companies/{id}',
    name: 'Company 360 Context',
    description: 'Complete context of a company including associated contacts, active opportunities, and interaction transcripts.',
    mimeType: 'application/json',
  },
  {
    uriTemplate: 'crm://transcripts/{id}',
    name: 'Call Transcript Detail',
    description: 'Full verbatim transcript, summary, and action items for an interaction.',
    mimeType: 'application/json',
  },
];

export async function readCrmResource(uri: string) {
  const url = new URL(uri);

  // 1. Pipeline Summary
  if (uri === 'crm://pipeline/summary') {
    const summary = await db
      .select({
        stage: opportunities.stage,
        count: sql<number>`count(*)`,
        totalAmountMicros: sql<string>`sum(amount_micros)`,
      })
      .from(opportunities)
      .where(sql`deleted_at IS NULL`)
      .groupBy(opportunities.stage);

    return JSON.stringify(summary, null, 2);
  }

  // 2. Company 360
  if (uri.startsWith('crm://companies/')) {
    const companyId = uri.replace('crm://companies/', '');
    const company = await db.query.companies.findFirst({
      where: eq(companies.id, companyId),
      with: {
        people: true,
        opportunities: true,
        transcripts: true,
      },
    });

    if (!company) {
      throw new Error(`Resource ${uri} not found`);
    }
    const timeline = await getTimelineActivities({
      entityType: 'company',
      entityId: companyId,
      limit: 25,
    });

    return JSON.stringify({
      ...company,
      timeline: timeline.map(t => ({
        id: t.id,
        activityType: t.activityType,
        actorSource: t.actorSource,
        actorName: t.actorName,
        properties: t.properties,
        happenedAt: t.happenedAt,
        summary: formatTimelineActivity(t),
      })),
    }, null, 2);
  }

  // 3. Transcript Detail
  if (uri.startsWith('crm://transcripts/')) {
    const transcriptId = uri.replace('crm://transcripts/', '');
    const transcript = await db.query.interactionTranscripts.findFirst({
      where: eq(interactionTranscripts.id, transcriptId),
      with: {
        company: true,
        person: true,
        opportunity: true,
      },
    });

    if (!transcript) {
      throw new Error(`Resource ${uri} not found`);
    }

    return JSON.stringify(transcript, null, 2);
  }

  throw new Error(`Unknown resource URI: ${uri}`);
}
