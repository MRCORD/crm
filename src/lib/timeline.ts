import { db } from '../db';
import { timelineActivities } from '../db/schema';
import { eq, and, desc } from 'drizzle-orm';

export type ActorSource = 'MANUAL' | 'API' | 'AGENT' | 'SYSTEM';

export type ActivityType =
  | 'RECORD_CREATED'
  | 'STAGE_CHANGED'
  | 'FIELD_UPDATED'
  | 'NOTE_ADDED'
  | 'TASK_CREATED'
  | 'TASK_COMPLETED'
  | 'CALL_LOGGED'
  | 'EMAIL_SENT'
  | 'TAG_ADDED'
  | 'TAG_REMOVED'
  | 'EXTERNAL_EVENT';

export interface LogTimelineActivityInput {
  entityType: string;
  entityId: string;
  activityType: ActivityType | string;
  actorSource?: ActorSource;
  actorUserId?: string | null;
  actorName?: string | null;
  organizationId?: string | null;
  properties?: Record<string, unknown>;
  happenedAt?: Date;
}

export interface GetTimelineOptions {
  entityType: string;
  entityId: string;
  limit?: number;
}

/**
 * Log an event into the unified chronological timeline for any CRM entity.
 * Append-only, never throws on failure (logs error to console).
 */
export async function logTimelineActivity(input: LogTimelineActivityInput) {
  try {
    const [activity] = await db
      .insert(timelineActivities)
      .values({
        entityType: input.entityType,
        entityId: input.entityId,
        activityType: input.activityType,
        actorSource: input.actorSource ?? 'SYSTEM',
        actorUserId: input.actorUserId ?? null,
        actorName: input.actorName ?? null,
        organizationId: input.organizationId ?? null,
        properties: input.properties ?? {},
        happenedAt: input.happenedAt ?? new Date(),
      })
      .returning();

    return activity;
  } catch (error) {
    console.error('[Timeline Activity Log Error]', error);
    return null;
  }
}

/**
 * Retrieve chronological activity timeline for an entity, newest first.
 */
export async function getTimelineActivities(options: GetTimelineOptions) {
  const limit = Math.min(Math.max(options.limit ?? 20, 1), 100);

  const activities = await db.query.timelineActivities.findMany({
    where: and(
      eq(timelineActivities.entityType, options.entityType),
      eq(timelineActivities.entityId, options.entityId)
    ),
    orderBy: [desc(timelineActivities.happenedAt)],
    limit,
    with: {
      actorUser: true,
    },
  });

  return activities;
}

/**
 * Format a timeline activity into a clean, human-readable summary line
 * ideal for agents, pre-call dossiers, and CLI output.
 */
export function formatTimelineActivity(act: {
  activityType: string;
  actorSource: string;
  actorName?: string | null;
  actorUser?: { name: string; email: string } | null;
  properties?: unknown;
  happenedAt: Date;
}): string {
  const actor = act.actorName || act.actorUser?.name || act.actorSource;
  const time = act.happenedAt instanceof Date ? act.happenedAt.toISOString() : String(act.happenedAt);
  const p = (typeof act.properties === 'object' && act.properties !== null ? act.properties : {}) as Record<string, any>;
  switch (act.activityType) {
    case 'RECORD_CREATED':
      return `[${time}] ${actor} created record (${p.name || p.title || 'unnamed'})`;
    case 'STAGE_CHANGED':
      return `[${time}] ${actor} changed stage: ${p.from ?? '?'} → ${p.to ?? '?'}${p.reason ? ` (${p.reason})` : ''}`;
    case 'FIELD_UPDATED':
      return `[${time}] ${actor} updated field '${p.field}': ${p.oldValue ?? 'none'} → ${p.newValue}`;
    case 'NOTE_ADDED':
      return `[${time}] ${actor} added note: "${p.noteTitle || p.title || 'Untitled'}"`;
    case 'TASK_CREATED':
      return `[${time}] ${actor} created task: "${p.taskTitle || p.title || 'Untitled'}"`;
    case 'CALL_LOGGED':
      return `[${time}] ${actor} logged call: "${p.title || 'Call Transcript'}" (${p.channel || 'meeting'})`;
    case 'TAG_ADDED':
      return `[${time}] ${actor} attached tag: "${p.tagName || 'Tag'}"`;
    case 'TAG_REMOVED':
      return `[${time}] ${actor} removed tag: "${p.tagName || 'Tag'}"`;
    default:
      return `[${time}] ${actor} performed ${act.activityType}: ${JSON.stringify(p)}`;
  }
}
