import { db } from '../db';
import {
  assignmentRules,
  companies,
  opportunities,
  people,
  users,
} from '../db/schema';
import { eq, and, sql, asc, inArray, isNull, ne } from 'drizzle-orm';
import { logTimelineActivity } from './timeline';
import { FilterCondition } from './views';

export type AssignmentStrategy = 'ROUND_ROBIN' | 'LOAD_BALANCED' | 'SPECIFIC_USER';

export interface CreateAssignmentRuleInput {
  name: string;
  targetEntity: 'opportunities' | 'people' | 'companies';
  conditions: FilterCondition[];
  assignmentStrategy: AssignmentStrategy;
  candidateUserIds: string[];
  priority?: number;
  isActive?: boolean;
  organizationId?: string | null;
}

/**
 * Evaluate whether an in-memory record satisfies a list of filter conditions.
 */
export function evaluateConditions(record: Record<string, any>, conditions: FilterCondition[]): boolean {
  if (!conditions || conditions.length === 0) return true;

  for (const c of conditions) {
    const val = record[c.field] ?? record.customFields?.[c.field] ?? record.data?.[c.field];

    switch (c.operator) {
      case 'eq':
        if (String(val) !== String(c.value)) return false;
        break;
      case 'neq':
        if (String(val) === String(c.value)) return false;
        break;
      case 'contains':
        if (!val || !String(val).toLowerCase().includes(String(c.value).toLowerCase())) return false;
        break;
      case 'gt':
        if (Number(val) <= Number(c.value)) return false;
        break;
      case 'gte':
        if (Number(val) < Number(c.value)) return false;
        break;
      case 'lt':
        if (Number(val) >= Number(c.value)) return false;
        break;
      case 'lte':
        if (Number(val) > Number(c.value)) return false;
        break;
      case 'in':
        if (!Array.isArray(c.value) || !c.value.map(String).includes(String(val))) return false;
        break;
      case 'is_null':
        if (val !== null && val !== undefined) return false;
        break;
      case 'is_not_null':
        if (val === null || val === undefined) return false;
        break;
      default:
        break;
    }
  }

  return true;
}

/**
 * Select the next assigned user based on rule strategy.
 */
async function selectAssignedUser(
  rule: typeof assignmentRules.$inferSelect,
  targetEntity: 'opportunities' | 'people' | 'companies'
): Promise<string> {
  const candidates = rule.candidateUserIds;
  if (!candidates || candidates.length === 0) {
    throw new Error(`Assignment rule "${rule.name}" has no candidate users configured`);
  }

  if (rule.assignmentStrategy === 'SPECIFIC_USER' || candidates.length === 1) {
    return candidates[0]!;
  }

  if (rule.assignmentStrategy === 'ROUND_ROBIN') {
    const lastIndex = rule.lastAssignedUserId ? candidates.indexOf(rule.lastAssignedUserId) : -1;
    const nextIndex = (lastIndex + 1) % candidates.length;
    const chosenUserId = candidates[nextIndex]!;

    // Update stateful pointer
    await db
      .update(assignmentRules)
      .set({ lastAssignedUserId: chosenUserId, updatedAt: new Date() })
      .where(eq(assignmentRules.id, rule.id));

    return chosenUserId;
  }

  if (rule.assignmentStrategy === 'LOAD_BALANCED') {
    // Workload-aware: Count active open workload per candidate and choose candidate with least records
    const workloadCounts: Record<string, number> = {};
    for (const uId of candidates) {
      workloadCounts[uId] = 0;
    }

    if (targetEntity === 'opportunities') {
      const activeOpps = await db
        .select({
          ownerId: opportunities.ownerId,
          count: sql<number>`count(*)`,
        })
        .from(opportunities)
        .where(
          and(
            inArray(opportunities.ownerId, candidates),
            sql`${opportunities.deletedAt} IS NULL`,
            sql`${opportunities.stage} NOT IN ('CLOSED_WON', 'CLOSED_LOST')`
          )
        )
        .groupBy(opportunities.ownerId);

      for (const row of activeOpps) {
        if (row.ownerId && workloadCounts[row.ownerId] !== undefined) {
          workloadCounts[row.ownerId] = Number(row.count);
        }
      }
    } else if (targetEntity === 'companies') {
      const activeCompanies = await db
        .select({
          ownerId: companies.ownerId,
          count: sql<number>`count(*)`,
        })
        .from(companies)
        .where(and(inArray(companies.ownerId, candidates), sql`${companies.deletedAt} IS NULL`))
        .groupBy(companies.ownerId);

      for (const row of activeCompanies) {
        if (row.ownerId && workloadCounts[row.ownerId] !== undefined) {
          workloadCounts[row.ownerId] = Number(row.count);
        }
      }
    }

    // Pick candidate with lowest count
    let minCandidate = candidates[0]!;
    let minCount = Infinity;
    for (const uId of candidates) {
      const count = workloadCounts[uId] ?? 0;
      if (count < minCount) {
        minCount = count;
        minCandidate = uId;
      }
    }

    return minCandidate;
  }

  return candidates[0]!;
}

/**
 * Create a new assignment rule.
 */
export async function createAssignmentRule(input: CreateAssignmentRuleInput) {
  const [created] = await db
    .insert(assignmentRules)
    .values({
      name: input.name,
      targetEntity: input.targetEntity,
      conditions: input.conditions ?? [],
      assignmentStrategy: input.assignmentStrategy,
      candidateUserIds: input.candidateUserIds,
      priority: input.priority ?? 0,
      isActive: input.isActive ?? true,
      organizationId: input.organizationId ?? null,
    })
    .returning();

  return created;
}

/**
 * List active assignment rules ordered by priority.
 */
export async function listAssignmentRules(options?: {
  targetEntity?: string;
  isActive?: boolean;
}) {
  const conditions = [];
  if (options?.targetEntity) {
    conditions.push(eq(assignmentRules.targetEntity, options.targetEntity));
  }
  if (options?.isActive !== undefined) {
    conditions.push(eq(assignmentRules.isActive, options.isActive));
  }

  return await db.query.assignmentRules.findMany({
    where: conditions.length > 0 ? and(...conditions) : undefined,
    orderBy: [asc(assignmentRules.priority), asc(assignmentRules.createdAt)],
  });
}

/**
 * Delete an assignment rule.
 */
export async function deleteAssignmentRule(ruleId: string) {
  const [deleted] = await db
    .delete(assignmentRules)
    .where(eq(assignmentRules.id, ruleId))
    .returning();
  return deleted;
}

/**
 * Route and assign a record to an owner based on priority rules.
 */
export async function routeAndAssignRecord(options: {
  targetEntity: 'opportunities' | 'people' | 'companies';
  recordId: string;
  forceRuleId?: string;
}) {
  const { targetEntity, recordId, forceRuleId } = options;

  // 1. Fetch the target record
  let record: Record<string, any> | undefined;
  if (targetEntity === 'opportunities') {
    record = await db.query.opportunities.findFirst({ where: eq(opportunities.id, recordId) });
  } else if (targetEntity === 'companies') {
    record = await db.query.companies.findFirst({ where: eq(companies.id, recordId) });
  } else if (targetEntity === 'people') {
    record = await db.query.people.findFirst({ where: eq(people.id, recordId) });
  }

  if (!record) {
    throw new Error(`${targetEntity} record with ID ${recordId} not found`);
  }

  // 2. Fetch active rules for this entity
  let matchingRule: typeof assignmentRules.$inferSelect | undefined;

  if (forceRuleId) {
    matchingRule = await db.query.assignmentRules.findFirst({
      where: eq(assignmentRules.id, forceRuleId),
    });
    if (!matchingRule) throw new Error(`Rule ${forceRuleId} not found`);
  } else {
    const rules = await listAssignmentRules({ targetEntity, isActive: true });
    for (const r of rules) {
      const match = evaluateConditions(record, r.conditions as FilterCondition[]);
      if (match) {
        matchingRule = r;
        break;
      }
    }
  }

  if (!matchingRule) {
    return {
      success: false,
      message: `No active assignment rule matched ${targetEntity} ${recordId}`,
      record,
    };
  }

  // 3. Select assignee
  const assignedUserId = await selectAssignedUser(matchingRule, targetEntity);
  const assignedUser = await db.query.users.findFirst({ where: eq(users.id, assignedUserId) });

  // 4. Update the record owner
  if (targetEntity === 'opportunities') {
    await db.update(opportunities).set({ ownerId: assignedUserId, updatedAt: new Date() }).where(eq(opportunities.id, recordId));
  } else if (targetEntity === 'companies') {
    await db.update(companies).set({ ownerId: assignedUserId, updatedAt: new Date() }).where(eq(companies.id, recordId));
  }

  // 5. Log activity timeline event
  await logTimelineActivity({
    entityType: targetEntity === 'opportunities' ? 'opportunity' : targetEntity === 'companies' ? 'company' : 'person',
    entityId: recordId,
    activityType: 'RECORD_ASSIGNED',
    actorSource: 'SYSTEM',
    actorName: 'Lead Routing Engine',
    properties: {
      ruleId: matchingRule.id,
      ruleName: matchingRule.name,
      strategy: matchingRule.assignmentStrategy,
      assignedUserId,
      assignedUserName: assignedUser?.name ?? 'Assigned Rep',
    },
  });

  return {
    success: true,
    matchedRule: matchingRule,
    assignedUserId,
    assignedUserName: assignedUser?.name,
    recordId,
  };
}
