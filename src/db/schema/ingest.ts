import { pgSchema, uuid, text, timestamp, boolean, jsonb } from 'drizzle-orm/pg-core';
import { companies, people } from './crm';

export const ingestSchema = pgSchema('ingest');

// ============================================================================
// 1. EXTERNAL SOURCE CONNECTIONS (PostHog, Stripe, Google, etc.)
// ============================================================================
export const sourceConnections = ingestSchema.table('source_connections', {
  id: uuid('id').primaryKey().defaultRandom(),
  provider: text('provider').notNull(), // 'POSTHOG', 'STRIPE', 'GOOGLE_WORKSPACE', 'SLACK'
  authCredentials: jsonb('auth_credentials').notNull(), // Encrypted tokens/keys
  syncStatus: text('sync_status').default('ACTIVE').notNull(), // 'ACTIVE', 'PAUSED', 'ERROR'
  lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// ============================================================================
// 2. PRODUCT TELEMETRY EVENTS (PQL & In-App Usage Ingestion)
// ============================================================================
export const telemetryEvents = ingestSchema.table('telemetry_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  sourceConnectionId: uuid('source_connection_id').references(() => sourceConnections.id, { onDelete: 'cascade' }),
  eventName: text('event_name').notNull(), // e.g. 'feature_flag_called', 'trial_expired', 'quota_exceeded'
  
  // Cross-schema links to CRM entities
  associatedCompanyId: uuid('associated_company_id').references(() => companies.id, { onDelete: 'set null' }),
  associatedPersonId: uuid('associated_person_id').references(() => people.id, { onDelete: 'set null' }),

  properties: jsonb('properties').default({}).notNull(),
  timestamp: timestamp('timestamp', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// ============================================================================
// 3. TRANSACTIONAL EVENT OUTBOX (Change Data Capture / Agent Triggers)
// ============================================================================
export const eventOutbox = ingestSchema.table('event_outbox', {
  id: uuid('id').primaryKey().defaultRandom(),
  eventType: text('event_type').notNull(), // 'RECORD_CREATED', 'RECORD_UPDATED', 'RECORD_DELETED'
  entityName: text('entity_name').notNull(), // 'companies', 'opportunities', 'interaction_transcripts'
  entityId: uuid('entity_id').notNull(),
  payload: jsonb('payload').notNull(),
  isProcessed: boolean('is_processed').default(false).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
