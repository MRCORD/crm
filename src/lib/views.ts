import { db } from '../db';
import {
  views,
  companies,
  people,
  opportunities,
  customObjectDefinitions,
  customObjectRecords,
} from '../db/schema';
import { eq, and, or, sql, desc, asc, SQL } from 'drizzle-orm';
import { PgTable } from 'drizzle-orm/pg-core';

export type ViewType = 'TABLE' | 'KANBAN' | 'CALENDAR';

export type FilterOperator =
  | 'eq'
  | 'neq'
  | 'contains'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'in'
  | 'is_null'
  | 'is_not_null';

export interface FilterCondition {
  field: string;
  operator: FilterOperator;
  value?: unknown;
}

export interface SortCondition {
  field: string;
  direction: 'asc' | 'desc';
}

export interface CreateViewInput {
  targetEntity: string;
  name: string;
  viewType?: ViewType;
  filters?: FilterCondition[];
  sortBy?: SortCondition[];
  groupByField?: string | null;
  visibleFields?: string[];
  isShared?: boolean;
  position?: number;
  organizationId?: string | null;
  ownerId?: string | null;
}

export interface RunViewOptions {
  viewId?: string;
  view?: {
    targetEntity: string;
    viewType?: string;
    filters?: FilterCondition[];
    sortBy?: SortCondition[];
    groupByField?: string | null;
    visibleFields?: string[];
  };
  limit?: number;
  offset?: number;
}

/**
 * Maps camelCase JS field names to snake_case Postgres column names for standard tables.
 */
function toSnakeCase(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

/**
 * Build a SQL filter expression for a column or JSONB field.
 */
function buildFilterSql(
  targetEntity: string,
  field: string,
  operator: FilterOperator,
  value: unknown
): SQL | null {
  const snakeField = toSnakeCase(field);

  // Determine standard column identifier vs jsonb custom_fields accessor
  let columnExpr: SQL;
  if (['companies', 'people', 'opportunities'].includes(targetEntity)) {
    // Check if it's a known standard column or a customField
    const standardFields: Record<string, string[]> = {
      companies: [
        'id', 'name', 'domain_name', 'industry', 'employees_count',
        'annual_revenue_amount_micros', 'annual_revenue_currency',
        'owner_id', 'created_at', 'updated_at',
      ],
      people: [
        'id', 'company_id', 'first_name', 'last_name', 'job_title',
        'email', 'phone', 'created_at', 'updated_at',
      ],
      opportunities: [
        'id', 'company_id', 'point_of_contact_id', 'owner_id',
        'name', 'stage', 'amount_micros', 'currency', 'close_date',
        'probability_percent', 'health_score', 'created_at', 'updated_at',
      ],
    };

    if (standardFields[targetEntity]?.includes(snakeField)) {
      columnExpr = sql.raw(`"${targetEntity}"."${snakeField}"`);
    } else {
      // Dynamic custom field inside custom_fields JSONB
      columnExpr = sql`"${sql.raw(targetEntity)}"."custom_fields"->>${field}`;
    }
  } else {
    // Custom object records table — check standard record fields vs data JSONB
    if (['id', 'name', 'company_id', 'person_id', 'created_at'].includes(snakeField)) {
      columnExpr = sql.raw(`"custom_object_records"."${snakeField}"`);
    } else {
      columnExpr = sql`"custom_object_records"."data"->>${field}`;
    }
  }

  switch (operator) {
    case 'eq':
      return sql`${columnExpr} = ${value}`;
    case 'neq':
      return sql`${columnExpr} != ${value}`;
    case 'contains':
      return sql`${columnExpr} ILIKE ${'%' + String(value) + '%'}`;
    case 'gt':
      return sql`${columnExpr} > ${value}`;
    case 'gte':
      return sql`${columnExpr} >= ${value}`;
    case 'lt':
      return sql`${columnExpr} < ${value}`;
    case 'lte':
      return sql`${columnExpr} <= ${value}`;
    case 'in':
      if (Array.isArray(value) && value.length > 0) {
        return sql`${columnExpr} IN ${sql`(${sql.join(value.map(v => sql`${v}`), sql`, `)})`}`;
      }
      return null;
    case 'is_null':
      return sql`${columnExpr} IS NULL`;
    case 'is_not_null':
      return sql`${columnExpr} IS NOT NULL`;
    default:
      return null;
  }
}

/**
 * Build SQL order expression.
 */
function buildSortSql(targetEntity: string, field: string, direction: 'asc' | 'desc'): SQL {
  const snakeField = toSnakeCase(field);
  let columnExpr: SQL;

  if (['companies', 'people', 'opportunities'].includes(targetEntity)) {
    columnExpr = sql.raw(`"${targetEntity}"."${snakeField}"`);
  } else {
    columnExpr = ['id', 'name', 'created_at'].includes(snakeField)
      ? sql.raw(`"custom_object_records"."${snakeField}"`)
      : sql`"custom_object_records"."data"->>${field}`;
  }

  return direction === 'desc' ? sql`${columnExpr} DESC` : sql`${columnExpr} ASC`;
}

/**
 * Create a new Saved View.
 */
export async function createView(input: CreateViewInput) {
  const [created] = await db
    .insert(views)
    .values({
      targetEntity: input.targetEntity,
      name: input.name,
      viewType: input.viewType ?? 'TABLE',
      filters: input.filters ?? [],
      sortBy: input.sortBy ?? [],
      groupByField: input.groupByField ?? null,
      visibleFields: input.visibleFields ?? [],
      isShared: input.isShared ?? false,
      position: input.position ?? 0,
      organizationId: input.organizationId ?? null,
      ownerId: input.ownerId ?? null,
    })
    .returning();

  return created;
}

/**
 * List saved views matching optional filters.
 */
export async function listViews(filters: {
  targetEntity?: string;
  organizationId?: string;
  ownerId?: string;
}) {
  const conditions: SQL[] = [];
  if (filters.targetEntity) {
    conditions.push(eq(views.targetEntity, filters.targetEntity));
  }
  if (filters.organizationId) {
    conditions.push(
      or(eq(views.organizationId, filters.organizationId), eq(views.isShared, true))!
    );
  }
  if (filters.ownerId) {
    conditions.push(
      or(eq(views.ownerId, filters.ownerId), eq(views.isShared, true))!
    );
  }

  return await db.query.views.findMany({
    where: conditions.length > 0 ? and(...conditions) : undefined,
    orderBy: [asc(views.position), desc(views.createdAt)],
  });
}

/**
 * Retrieve one saved view by ID.
 */
export async function getViewById(viewId: string) {
  return await db.query.views.findFirst({
    where: eq(views.id, viewId),
  });
}

/**
 * Delete a saved view.
 */
export async function deleteView(viewId: string) {
  const [deleted] = await db
    .delete(views)
    .where(eq(views.id, viewId))
    .returning();
  return deleted;
}

/**
 * Execute a Saved View and return filtered, sorted, and optionally grouped records.
 */
export async function runView(options: RunViewOptions) {
  let viewSpec = options.view;

  if (options.viewId) {
    const saved = await getViewById(options.viewId);
    if (!saved) {
      throw new Error(`View with ID "${options.viewId}" not found`);
    }
    viewSpec = {
      targetEntity: saved.targetEntity,
      viewType: saved.viewType,
      filters: (saved.filters as FilterCondition[]) ?? [],
      sortBy: (saved.sortBy as SortCondition[]) ?? [],
      groupByField: saved.groupByField,
      visibleFields: saved.visibleFields,
    };
  }

  if (!viewSpec) {
    throw new Error('Either viewId or view specification must be provided');
  }

  const { targetEntity, viewType = 'TABLE', filters = [], sortBy = [], groupByField } = viewSpec;
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 250);
  const offset = Math.max(options.offset ?? 0, 0);

  // Build filter conditions
  const filterClauses: SQL[] = [];
  for (const f of filters) {
    const clause = buildFilterSql(targetEntity, f.field, f.operator, f.value);
    if (clause) filterClauses.push(clause);
  }

  // Build sort clauses
  const sortClauses: SQL[] = [];
  for (const s of sortBy) {
    sortClauses.push(buildSortSql(targetEntity, s.field, s.direction));
  }
  if (sortClauses.length === 0) {
    // Default sort: newest first
    sortClauses.push(buildSortSql(targetEntity, 'createdAt', 'desc'));
  }

  let records: Array<Record<string, any>> = [];

  if (targetEntity === 'companies') {
    let query = db.select().from(companies).$dynamic();
    if (filterClauses.length > 0) {
      query = query.where(and(...filterClauses));
    }
    records = await query.orderBy(...sortClauses).limit(limit).offset(offset);
  } else if (targetEntity === 'opportunities') {
    let query = db.select().from(opportunities).$dynamic();
    if (filterClauses.length > 0) {
      query = query.where(and(...filterClauses));
    }
    records = await query.orderBy(...sortClauses).limit(limit).offset(offset);
  } else if (targetEntity === 'people') {
    let query = db.select().from(people).$dynamic();
    if (filterClauses.length > 0) {
      query = query.where(and(...filterClauses));
    }
    records = await query.orderBy(...sortClauses).limit(limit).offset(offset);
  } else {
    // Custom object definition lookup
    const definition = await db.query.customObjectDefinitions.findFirst({
      where: eq(customObjectDefinitions.nameSingular, targetEntity),
    });

    if (!definition) {
      throw new Error(`Target entity "${targetEntity}" is neither a standard CRM object nor an existing custom object`);
    }

    const baseWhere = eq(customObjectRecords.customObjectId, definition.id);
    let query = db.select().from(customObjectRecords).$dynamic();
    query = query.where(filterClauses.length > 0 ? and(baseWhere, ...filterClauses) : baseWhere);
    records = await query.orderBy(...sortClauses).limit(limit).offset(offset);
  }

  // If KANBAN view or groupByField is specified, group records
  if (viewType === 'KANBAN' && groupByField) {
    const groups: Record<string, Array<Record<string, any>>> = {};

    for (const record of records) {
      const groupKey = String(
        record[groupByField] ??
        record.customFields?.[groupByField] ??
        record.data?.[groupByField] ??
        'Unassigned'
      );
      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(record);
    }

    return {
      targetEntity,
      viewType: 'KANBAN',
      groupByField,
      columns: Object.keys(groups),
      groups,
      totalCount: records.length,
    };
  }

  return {
    targetEntity,
    viewType,
    totalCount: records.length,
    records,
  };
}
