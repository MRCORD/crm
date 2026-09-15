import { db } from '../db';
import {
  companies,
  opportunities,
  fieldPermissions,
} from '../db/schema';
import { eq, and } from 'drizzle-orm';

export type Role = 'admin' | 'member' | 'guest';
export type Visibility = 'OPEN' | 'PRIVATE';

/**
 * Check whether a user with a given role can read a specific record.
 * PRIVATE records are only visible to the owner and admin-role users.
 */
export async function canReadRecord(options: {
  entityType: 'companies' | 'opportunities';
  recordId: string;
  userId: string;
  role: Role;
}): Promise<boolean> {
  const { entityType, recordId, userId, role } = options;

  if (role === 'admin') return true;

  if (entityType === 'companies') {
    const rec = await db.query.companies.findFirst({
      where: eq(companies.id, recordId),
    });
    if (!rec) return false;
    if (rec.visibility === 'OPEN') return true;
    return rec.ownerId === userId;
  }

  if (entityType === 'opportunities') {
    const rec = await db.query.opportunities.findFirst({
      where: eq(opportunities.id, recordId),
    });
    if (!rec) return false;
    if (rec.visibility === 'OPEN') return true;
    return rec.ownerId === userId;
  }

  return true;
}

/**
 * Set the visibility of a company or opportunity record.
 */
export async function setRecordVisibility(options: {
  entityType: 'companies' | 'opportunities';
  recordId: string;
  visibility: Visibility;
}) {
  const { entityType, recordId, visibility } = options;

  if (entityType === 'companies') {
    const [updated] = await db
      .update(companies)
      .set({ visibility, updatedAt: new Date() })
      .where(eq(companies.id, recordId))
      .returning();
    return updated;
  }

  const [updated] = await db
    .update(opportunities)
    .set({ visibility, updatedAt: new Date() })
    .where(eq(opportunities.id, recordId))
    .returning();
  return updated;
}

/**
 * Upsert a field-level permission rule.
 */
export async function setFieldPermission(input: {
  entityType: string;
  fieldName: string;
  role: Role;
  canRead: boolean;
  canWrite: boolean;
  organizationId?: string | null;
}) {
  const existing = await db.query.fieldPermissions.findFirst({
    where: and(
      eq(fieldPermissions.entityType, input.entityType),
      eq(fieldPermissions.fieldName, input.fieldName),
      eq(fieldPermissions.role, input.role)
    ),
  });

  if (existing) {
    const [updated] = await db
      .update(fieldPermissions)
      .set({ canRead: input.canRead, canWrite: input.canWrite })
      .where(eq(fieldPermissions.id, existing.id))
      .returning();
    return updated;
  }

  const [created] = await db.insert(fieldPermissions).values({
    entityType: input.entityType,
    fieldName: input.fieldName,
    role: input.role,
    canRead: input.canRead,
    canWrite: input.canWrite,
    organizationId: input.organizationId ?? null,
  }).returning();
  return created;
}

/**
 * List field permission rules.
 */
export async function listFieldPermissions(entityType?: string) {
  return await db.query.fieldPermissions.findMany({
    where: entityType ? eq(fieldPermissions.entityType, entityType) : undefined,
    orderBy: [eq(fieldPermissions.entityType, entityType ?? ''), eq(fieldPermissions.role, 'admin')],
  });
}

/**
 * Apply field-level masking to a record object based on role.
 */
export async function applyFieldMasking(options: {
  entityType: string;
  record: Record<string, unknown>;
  role: Role;
}): Promise<Record<string, unknown>> {
  const { entityType, record, role } = options;

  if (role === 'admin') return record;

  const perms = await db.query.fieldPermissions.findMany({
    where: and(
      eq(fieldPermissions.entityType, entityType),
      eq(fieldPermissions.role, role),
      eq(fieldPermissions.canRead, false)
    ),
  });

  if (perms.length === 0) return record;

  const masked = { ...record };
  for (const perm of perms) {
    delete masked[perm.fieldName];
  }
  return masked;
}
