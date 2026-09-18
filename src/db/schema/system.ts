/**
 * system schema — internal team identity, organizations, and API access.
 *
 * `users.id` = Clerk user ID (e.g. "user_2abc123").
 * `organizations.id` = Clerk organization ID (e.g. "org_2abc123").
 * Clerk is the source of truth for authentication and team membership.
 * These tables are synced from Clerk webhooks and used for CRM FKs and scoping.
 */
import { pgSchema, text, boolean, timestamp } from 'drizzle-orm/pg-core';

export const systemSchema = pgSchema('system');

export const users = systemSchema.table('users', {
  // Clerk user ID — e.g. user_2NNBh3BtqpyEFBR7oM5rQ3p1h7T
  id: text('id').primaryKey(),
  email: text('email').unique().notNull(),
  name: text('name').notNull(),
  // 'admin' | 'member' | 'guest' — sourced from Clerk publicMetadata.role
  role: text('role').default('member').notNull(),
  avatarUrl: text('avatar_url'),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

/**
 * Organizations = Clerk Organizations (Slack-workspace / Linear-team pattern).
 * A deployment may run single-org (one company using the CRM) or multi-org
 * (an agency managing several client CRMs from one instance).
 */
export const organizations = systemSchema.table('organizations', {
  // Clerk organization ID — e.g. org_2NNBh3BtqpyEFBR7oM5rQ3p1h7T
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').unique().notNull(),
  imageUrl: text('image_url'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

/**
 * Membership + role within an organization (Clerk organizationMembership).
 * A user can belong to multiple organizations with different roles in each.
 */
export const organizationMembers = systemSchema.table('organization_members', {
  id: text('id').primaryKey(), // Clerk membership ID — e.g. orgmem_2abc...
  organizationId: text('organization_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  role: text('role').default('org:member').notNull(), // 'org:admin' | 'org:member' | custom roles
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

/**
 * API keys for autonomous MCP clients (agent swarms, stdio scripts).
 * These are separate from Clerk sessions — long-lived bearer tokens
 * that bypass the browser OAuth flow for machine callers.
 */
export const apiKeys = systemSchema.table('api_keys', {
  id: text('id').primaryKey(), // crm_live_<32hex>
  userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  organizationId: text('organization_id').references(() => organizations.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  keyHash: text('key_hash').notNull(), // bcrypt hash of the raw key
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
