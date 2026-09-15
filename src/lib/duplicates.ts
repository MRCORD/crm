import { db } from '../db';
import {
  companies,
  people,
  opportunities,
  notes,
  noteTargets,
  tasks,
  taskTargets,
  calendarEventTargets,
  interactionTranscripts,
  customObjectRecords,
  taggables,
  timelineActivities,
  mergeCandidates,
} from '../db/schema';
import { eq, and, or, sql, desc, inArray, isNull, ne } from 'drizzle-orm';
import { logTimelineActivity } from './timeline';

/**
 * Normalizes website domains for accurate deduplication.
 * Strips protocol, www., paths, and trailing slashes.
 */
export function normalizeDomain(rawDomain?: string | null): string | null {
  if (!rawDomain) return null;
  let d = rawDomain.trim().toLowerCase();
  d = d.replace(/^https?:\/\//, '');
  d = d.replace(/^www\./, '');
  d = d.split('/')[0]!;
  d = d.split('?')[0]!;
  return d || null;
}

/**
 * Normalizes company names by removing corporate suffixes and punctuation.
 */
export function normalizeCompanyName(name: string): string {
  let n = name.trim().toLowerCase();
  // Remove common corporate suffixes
  n = n.replace(/\b(inc|incorporated|corp|corporation|llc|ltd|limited|gmbh|co|company)\b\.?/gi, '');
  // Remove punctuation and extra whitespace
  n = n.replace(/[^\w\s]/g, ' ');
  n = n.replace(/\s+/g, ' ').trim();
  return n;
}

/**
 * Dice coefficient / Bigram similarity metric (0.0 to 1.0).
 */
export function computeStringSimilarity(str1: string, str2: string): number {
  const s1 = str1.trim().toLowerCase();
  const s2 = str2.trim().toLowerCase();
  if (s1 === s2) return 1.0;
  if (s1.length < 2 || s2.length < 2) return 0.0;

  const getBigrams = (str: string) => {
    const bigrams = new Map<string, number>();
    for (let i = 0; i < str.length - 1; i++) {
      const bg = str.substring(i, i + 2);
      bigrams.set(bg, (bigrams.get(bg) || 0) + 1);
    }
    return bigrams;
  };

  const bg1 = getBigrams(s1);
  const bg2 = getBigrams(s2);

  let intersection = 0;
  for (const [bg, count1] of bg1.entries()) {
    const count2 = bg2.get(bg) || 0;
    intersection += Math.min(count1, count2);
  }

  const total = (s1.length - 1) + (s2.length - 1);
  return Number(((2.0 * intersection) / total).toFixed(2));
}

export interface DuplicateCandidate {
  entityType: 'company' | 'person';
  primaryRecordId: string;
  duplicateRecordId: string;
  confidenceScore: number;
  matchReason: 'DOMAIN_MATCH' | 'EMAIL_MATCH' | 'EXACT_NAME' | 'FUZZY_NAME';
  primarySummary: string;
  duplicateSummary: string;
}

/**
 * Find duplicate candidates across companies or people.
 */
export async function findDuplicates(options: {
  entityType: 'company' | 'person';
  recordId?: string;
  minConfidence?: number;
  persist?: boolean;
}): Promise<DuplicateCandidate[]> {
  const minConfidence = options.minConfidence ?? 0.75;
  const candidates: DuplicateCandidate[] = [];

  if (options.entityType === 'company') {
    // Query active companies
    const allCompanies = await db.query.companies.findMany({
      where: isNull(companies.deletedAt),
      orderBy: [desc(companies.createdAt)],
    });

    const targetList = options.recordId
      ? allCompanies.filter((c) => c.id === options.recordId)
      : allCompanies;

    for (let i = 0; i < targetList.length; i++) {
      const primary = targetList[i]!;
      const primaryNormDomain = normalizeDomain(primary.domainName);
      const primaryNormName = normalizeCompanyName(primary.name);

      for (let j = 0; j < allCompanies.length; j++) {
        const other = allCompanies[j]!;
        if (primary.id === other.id) continue;

        const otherNormDomain = normalizeDomain(other.domainName);
        const otherNormName = normalizeCompanyName(other.name);

        let matchReason: DuplicateCandidate['matchReason'] | null = null;
        let score = 0;

        // 1. Exact domain match
        if (primaryNormDomain && otherNormDomain && primaryNormDomain === otherNormDomain) {
          matchReason = 'DOMAIN_MATCH';
          score = 0.98;
        } else if (primaryNormName && otherNormName && primaryNormName === otherNormName) {
          matchReason = 'EXACT_NAME';
          score = 0.95;
        } else {
          // Fuzzy name match
          const nameSim = computeStringSimilarity(primaryNormName, otherNormName);
          if (nameSim >= minConfidence) {
            matchReason = 'FUZZY_NAME';
            score = nameSim;
          }
        }

        if (matchReason && score >= minConfidence) {
          // Keep primary as the older record (created first)
          const isPrimaryOlder = primary.createdAt <= other.createdAt;
          const [older, newer] = isPrimaryOlder ? [primary, other] : [other, primary];

          // Avoid duplicate pairs in candidate array
          const pairExists = candidates.some(
            (c) =>
              (c.primaryRecordId === older.id && c.duplicateRecordId === newer.id) ||
              (c.primaryRecordId === newer.id && c.duplicateRecordId === older.id)
          );

          if (!pairExists) {
            candidates.push({
              entityType: 'company',
              primaryRecordId: older.id,
              duplicateRecordId: newer.id,
              confidenceScore: score,
              matchReason,
              primarySummary: `${older.name} (${older.domainName || 'no domain'})`,
              duplicateSummary: `${newer.name} (${newer.domainName || 'no domain'})`,
            });
          }
        }
      }
    }
  } else if (options.entityType === 'person') {
    // Query active people
    const allPeople = await db.query.people.findMany({
      where: isNull(people.deletedAt),
      orderBy: [desc(people.createdAt)],
    });

    const targetList = options.recordId
      ? allPeople.filter((p) => p.id === options.recordId)
      : allPeople;

    for (let i = 0; i < targetList.length; i++) {
      const primary = targetList[i]!;
      const primaryEmail = primary.email.trim().toLowerCase();
      const primaryName = `${primary.firstName || ''} ${primary.lastName || ''}`.trim().toLowerCase();

      for (let j = 0; j < allPeople.length; j++) {
        const other = allPeople[j]!;
        if (primary.id === other.id) continue;

        const otherEmail = other.email.trim().toLowerCase();
        const otherName = `${other.firstName || ''} ${other.lastName || ''}`.trim().toLowerCase();

        let matchReason: DuplicateCandidate['matchReason'] | null = null;
        let score = 0;

        // 1. Exact email match
        if (primaryEmail === otherEmail) {
          matchReason = 'EMAIL_MATCH';
          score = 0.99;
        } else if (primary.companyId && primary.companyId === other.companyId && primaryName && primaryName === otherName) {
          matchReason = 'EXACT_NAME';
          score = 0.92;
        } else if (primaryName && otherName) {
          const sim = computeStringSimilarity(primaryName, otherName);
          if (sim >= minConfidence) {
            matchReason = 'FUZZY_NAME';
            score = sim;
          }
        }

        if (matchReason && score >= minConfidence) {
          const isPrimaryOlder = primary.createdAt <= other.createdAt;
          const [older, newer] = isPrimaryOlder ? [primary, other] : [other, primary];

          const pairExists = candidates.some(
            (c) =>
              (c.primaryRecordId === older.id && c.duplicateRecordId === newer.id) ||
              (c.primaryRecordId === newer.id && c.duplicateRecordId === older.id)
          );

          if (!pairExists) {
            candidates.push({
              entityType: 'person',
              primaryRecordId: older.id,
              duplicateRecordId: newer.id,
              confidenceScore: score,
              matchReason,
              primarySummary: `${older.firstName || ''} ${older.lastName || ''} (${older.email})`,
              duplicateSummary: `${newer.firstName || ''} ${newer.lastName || ''} (${newer.email})`,
            });
          }
        }
      }
    }
  }

  // Persist new candidates into crm.merge_candidates if requested
  if (options.persist !== false && candidates.length > 0) {
    for (const c of candidates) {
      const existing = await db.query.mergeCandidates.findFirst({
        where: and(
          eq(mergeCandidates.entityType, c.entityType),
          eq(mergeCandidates.primaryRecordId, c.primaryRecordId),
          eq(mergeCandidates.duplicateRecordId, c.duplicateRecordId)
        ),
      });

      if (!existing) {
        await db.insert(mergeCandidates).values({
          entityType: c.entityType,
          primaryRecordId: c.primaryRecordId,
          duplicateRecordId: c.duplicateRecordId,
          confidenceScore: c.confidenceScore.toFixed(2),
          matchReason: c.matchReason,
          status: 'PENDING',
        }).catch(() => {});
      }
    }
  }

  return candidates;
}

/**
 * Execute record merge:
 * Re-points all relational foreign keys from duplicate to primary,
 * records a timeline activity, and soft-deletes the duplicate record.
 */
export async function mergeRecords(options: {
  entityType: 'company' | 'person';
  primaryRecordId: string;
  duplicateRecordId: string;
  userId?: string;
}) {
  const { entityType, primaryRecordId, duplicateRecordId, userId } = options;

  if (primaryRecordId === duplicateRecordId) {
    throw new Error('Cannot merge a record into itself');
  }

  const rePointedCounts: Record<string, number> = {};

  if (entityType === 'company') {
    const [primary, duplicate] = await Promise.all([
      db.query.companies.findFirst({ where: eq(companies.id, primaryRecordId) }),
      db.query.companies.findFirst({ where: eq(companies.id, duplicateRecordId) }),
    ]);

    if (!primary) throw new Error(`Primary company ${primaryRecordId} not found`);
    if (!duplicate) throw new Error(`Duplicate company ${duplicateRecordId} not found`);

    // 1. Re-point people
    const repPeople = await db
      .update(people)
      .set({ companyId: primaryRecordId })
      .where(eq(people.companyId, duplicateRecordId))
      .returning();
    rePointedCounts.people = repPeople.length;

    // 2. Re-point opportunities
    const repOpps = await db
      .update(opportunities)
      .set({ companyId: primaryRecordId })
      .where(eq(opportunities.companyId, duplicateRecordId))
      .returning();
    rePointedCounts.opportunities = repOpps.length;

    // 3. Re-point note_targets
    const repNotes = await db
      .update(noteTargets)
      .set({ companyId: primaryRecordId })
      .where(eq(noteTargets.companyId, duplicateRecordId))
      .returning();
    rePointedCounts.noteTargets = repNotes.length;

    // 4. Re-point task_targets
    const repTasks = await db
      .update(taskTargets)
      .set({ companyId: primaryRecordId })
      .where(eq(taskTargets.companyId, duplicateRecordId))
      .returning();
    rePointedCounts.taskTargets = repTasks.length;

    // 5. Re-point calendar_event_targets
    const repCal = await db
      .update(calendarEventTargets)
      .set({ companyId: primaryRecordId })
      .where(eq(calendarEventTargets.companyId, duplicateRecordId))
      .returning();
    rePointedCounts.calendarEvents = repCal.length;

    // 6. Re-point interaction_transcripts
    const repTrans = await db
      .update(interactionTranscripts)
      .set({ companyId: primaryRecordId })
      .where(eq(interactionTranscripts.companyId, duplicateRecordId))
      .returning();
    rePointedCounts.transcripts = repTrans.length;

    // 7. Re-point custom_object_records
    const repCustom = await db
      .update(customObjectRecords)
      .set({ companyId: primaryRecordId })
      .where(eq(customObjectRecords.companyId, duplicateRecordId))
      .returning();
    rePointedCounts.customObjectRecords = repCustom.length;

    // 8. Re-point taggables (avoid duplicate tag links)
    const duplicateTags = await db.query.taggables.findMany({
      where: and(
        eq(taggables.taggableType, 'company'),
        eq(taggables.taggableId, duplicateRecordId)
      ),
    });

    for (const t of duplicateTags) {
      const primaryHasTag = await db.query.taggables.findFirst({
        where: and(
          eq(taggables.tagId, t.tagId),
          eq(taggables.taggableType, 'company'),
          eq(taggables.taggableId, primaryRecordId)
        ),
      });

      if (!primaryHasTag) {
        await db.update(taggables)
          .set({ taggableId: primaryRecordId })
          .where(eq(taggables.id, t.id));
      } else {
        await db.delete(taggables).where(eq(taggables.id, t.id));
      }
    }
    rePointedCounts.tags = duplicateTags.length;

    // 9. Re-point timeline_activities
    const repTimeline = await db
      .update(timelineActivities)
      .set({ entityId: primaryRecordId })
      .where(and(
        eq(timelineActivities.entityType, 'company'),
        eq(timelineActivities.entityId, duplicateRecordId)
      ))
      .returning();
    rePointedCounts.timelineActivities = repTimeline.length;

    // 10. Soft-delete duplicate company
    await db
      .update(companies)
      .set({ deletedAt: new Date() })
      .where(eq(companies.id, duplicateRecordId));

    // 11. Log merge in timeline of primary record
    await logTimelineActivity({
      entityType: 'company',
      entityId: primaryRecordId,
      activityType: 'RECORD_MERGED',
      actorSource: userId ? 'MANUAL' : 'AGENT',
      actorUserId: userId ?? null,
      actorName: userId ? 'CRM User' : 'CRM MCP Agent',
      properties: {
        mergedDuplicateId: duplicateRecordId,
        duplicateName: duplicate.name,
        rePointedCounts,
      },
    });

    // 12. Mark merge candidates as MERGED
    await db
      .update(mergeCandidates)
      .set({
        status: 'MERGED',
        reviewedByUserId: userId ?? null,
        updatedAt: new Date(),
      })
      .where(
        or(
          and(
            eq(mergeCandidates.primaryRecordId, primaryRecordId),
            eq(mergeCandidates.duplicateRecordId, duplicateRecordId)
          ),
          and(
            eq(mergeCandidates.primaryRecordId, duplicateRecordId),
            eq(mergeCandidates.duplicateRecordId, primaryRecordId)
          )
        )
      );

    return {
      success: true,
      entityType: 'company',
      primaryCompany: primary,
      mergedDuplicateCompany: duplicate,
      rePointedCounts,
    };
  } else {
    // Person merge
    const [primary, duplicate] = await Promise.all([
      db.query.people.findFirst({ where: eq(people.id, primaryRecordId) }),
      db.query.people.findFirst({ where: eq(people.id, duplicateRecordId) }),
    ]);

    if (!primary) throw new Error(`Primary contact ${primaryRecordId} not found`);
    if (!duplicate) throw new Error(`Duplicate contact ${duplicateRecordId} not found`);

    // 1. Opportunities point of contact
    const repOpps = await db
      .update(opportunities)
      .set({ pointOfContactId: primaryRecordId })
      .where(eq(opportunities.pointOfContactId, duplicateRecordId))
      .returning();
    rePointedCounts.opportunities = repOpps.length;

    // 2. Note targets
    const repNotes = await db
      .update(noteTargets)
      .set({ personId: primaryRecordId })
      .where(eq(noteTargets.personId, duplicateRecordId))
      .returning();
    rePointedCounts.noteTargets = repNotes.length;

    // 3. Task targets
    const repTasks = await db
      .update(taskTargets)
      .set({ personId: primaryRecordId })
      .where(eq(taskTargets.personId, duplicateRecordId))
      .returning();
    rePointedCounts.taskTargets = repTasks.length;

    // 4. Calendar event targets
    const repCal = await db
      .update(calendarEventTargets)
      .set({ personId: primaryRecordId })
      .where(eq(calendarEventTargets.personId, duplicateRecordId))
      .returning();
    rePointedCounts.calendarEvents = repCal.length;

    // 5. Interaction transcripts
    const repTrans = await db
      .update(interactionTranscripts)
      .set({ personId: primaryRecordId })
      .where(eq(interactionTranscripts.personId, duplicateRecordId))
      .returning();
    rePointedCounts.transcripts = repTrans.length;

    // 6. Custom object records
    const repCustom = await db
      .update(customObjectRecords)
      .set({ personId: primaryRecordId })
      .where(eq(customObjectRecords.personId, duplicateRecordId))
      .returning();
    rePointedCounts.customObjectRecords = repCustom.length;

    // 7. Taggables
    const duplicateTags = await db.query.taggables.findMany({
      where: and(
        eq(taggables.taggableType, 'person'),
        eq(taggables.taggableId, duplicateRecordId)
      ),
    });

    for (const t of duplicateTags) {
      const primaryHasTag = await db.query.taggables.findFirst({
        where: and(
          eq(taggables.tagId, t.tagId),
          eq(taggables.taggableType, 'person'),
          eq(taggables.taggableId, primaryRecordId)
        ),
      });

      if (!primaryHasTag) {
        await db.update(taggables)
          .set({ taggableId: primaryRecordId })
          .where(eq(taggables.id, t.id));
      } else {
        await db.delete(taggables).where(eq(taggables.id, t.id));
      }
    }
    rePointedCounts.tags = duplicateTags.length;

    // 8. Timeline activities
    const repTimeline = await db
      .update(timelineActivities)
      .set({ entityId: primaryRecordId })
      .where(and(
        eq(timelineActivities.entityType, 'person'),
        eq(timelineActivities.entityId, duplicateRecordId)
      ))
      .returning();
    rePointedCounts.timelineActivities = repTimeline.length;

    // 9. Soft-delete duplicate contact
    await db
      .update(people)
      .set({ deletedAt: new Date() })
      .where(eq(people.id, duplicateRecordId));

    // 10. Log merge on primary contact timeline
    await logTimelineActivity({
      entityType: 'person',
      entityId: primaryRecordId,
      activityType: 'RECORD_MERGED',
      actorSource: userId ? 'MANUAL' : 'AGENT',
      actorUserId: userId ?? null,
      actorName: userId ? 'CRM User' : 'CRM MCP Agent',
      properties: {
        mergedDuplicateId: duplicateRecordId,
        duplicateEmail: duplicate.email,
        duplicateName: `${duplicate.firstName || ''} ${duplicate.lastName || ''}`.trim(),
        rePointedCounts,
      },
    });

    // 11. Mark merge candidate as MERGED
    await db
      .update(mergeCandidates)
      .set({
        status: 'MERGED',
        reviewedByUserId: userId ?? null,
        updatedAt: new Date(),
      })
      .where(
        or(
          and(
            eq(mergeCandidates.primaryRecordId, primaryRecordId),
            eq(mergeCandidates.duplicateRecordId, duplicateRecordId)
          ),
          and(
            eq(mergeCandidates.primaryRecordId, duplicateRecordId),
            eq(mergeCandidates.duplicateRecordId, primaryRecordId)
          )
        )
      );

    return {
      success: true,
      entityType: 'person',
      primaryPerson: primary,
      mergedDuplicatePerson: duplicate,
      rePointedCounts,
    };
  }
}

/**
 * List existing merge candidates from crm.merge_candidates.
 */
export async function listMergeCandidates(options: {
  entityType?: 'company' | 'person';
  status?: 'PENDING' | 'MERGED' | 'DISMISSED';
  limit?: number;
}) {
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 200);
  const conditions = [];

  if (options.entityType) {
    conditions.push(eq(mergeCandidates.entityType, options.entityType));
  }
  if (options.status) {
    conditions.push(eq(mergeCandidates.status, options.status));
  }

  return await db.query.mergeCandidates.findMany({
    where: conditions.length > 0 ? and(...conditions) : undefined,
    orderBy: [desc(mergeCandidates.confidenceScore), desc(mergeCandidates.createdAt)],
    limit,
    with: {
      reviewedByUser: true,
    },
  });
}

/**
 * Dismiss a merge candidate pair.
 */
export async function dismissMergeCandidate(candidateId: string, userId?: string) {
  const [updated] = await db
    .update(mergeCandidates)
    .set({
      status: 'DISMISSED',
      reviewedByUserId: userId ?? null,
      updatedAt: new Date(),
    })
    .where(eq(mergeCandidates.id, candidateId))
    .returning();

  return updated;
}
