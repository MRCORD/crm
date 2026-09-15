/**
 * system schema — internal team identity.
 *
 * `users.id` = Clerk user ID (e.g. "user_2abc123").
 * Clerk is the source of truth for authentication.
 * This table is synced from Clerk webhooks and used for CRM ownership/assignment FKs.
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
 * API keys for autonomous MCP clients (agent swarms, stdio scripts).
 * These are separate from Clerk sessions — long-lived bearer tokens
 * that bypass the browser OAuth flow for machine callers.
 */
export const apiKeys = systemSchema.table('api_keys', {
  id: text('id').primaryKey(), // crm_live_<32hex>
  userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  name: text('name').notNull(),
  keyHash: text('key_hash').notNull(), // bcrypt hash of the raw key
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
