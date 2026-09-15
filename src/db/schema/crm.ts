import { pgSchema, uuid, text, timestamp, numeric, integer, doublePrecision, boolean, jsonb, index } from 'drizzle-orm/pg-core';
import { users, organizations } from './system';

export const crmSchema = pgSchema('crm');

// ============================================================================
// 1. COMPANIES (ACCOUNTS)
// ============================================================================
export const companies = crmSchema.table('companies', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: text('organization_id').references(() => organizations.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  domainName: text('domain_name'),
  industry: text('industry'),
  employeesCount: integer('employees_count'),
  linkedinUrl: text('linkedin_url'),

  // Composite Column Flattening (Twenty CRM pattern)
  annualRevenueAmountMicros: numeric('annual_revenue_amount_micros'),
  annualRevenueCurrency: text('annual_revenue_currency').default('USD'),

  addressStreet1: text('address_street1'),
  addressCity: text('address_city'),
  addressState: text('address_state'),
  addressPostcode: text('address_postcode'),
  addressCountry: text('address_country'),
  addressLat: numeric('address_lat', { precision: 10, scale: 7 }),
  addressLng: numeric('address_lng', { precision: 10, scale: 7 }),

  // Runtime Dynamic Custom Fields (Indexed by Polygres via registerJsonbPath)
  customFields: jsonb('custom_fields').default({}).notNull(),

  // Account owner (Account Manager / CSM responsible for this account)
  ownerId: text('owner_id').references(() => users.id, { onDelete: 'set null' }),

  // Account Hierarchy: Self-referencing parent company (subsidiary / corporate tree)
  parentCompanyId: uuid('parent_company_id').references((): any => companies.id, { onDelete: 'set null' }),
  // Full-Text Search Vector placeholder
  searchVector: text('search_vector'),
  position: doublePrecision('position').default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  // Field/Record-Level Permissions: 'OPEN' (visible to all org members) | 'PRIVATE' (owner + admins only)
  visibility: text('visibility').default('OPEN').notNull(),
}, (table) => [
  index('idx_companies_parent').on(table.parentCompanyId),
]);

// ============================================================================
// 2. PEOPLE (CONTACTS / LEADS)
// ============================================================================
export const people = crmSchema.table('people', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id').references(() => companies.id, { onDelete: 'set null' }), // Polygres Graph Edge 1

  firstName: text('first_name'),
  lastName: text('last_name'),
  jobTitle: text('job_title'),
  email: text('email').notNull(),
  phone: text('phone'),
  linkedinUrl: text('linkedin_url'),
  avatarUrl: text('avatar_url'),

  // Runtime Dynamic Custom Fields
  customFields: jsonb('custom_fields').default({}).notNull(),

  searchVector: text('search_vector'),
  position: doublePrecision('position').default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

// ============================================================================
// 3. OPPORTUNITIES (DEALS / PIPELINE)
// ============================================================================
export const opportunities = crmSchema.table('opportunities', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: text('organization_id').references(() => organizations.id, { onDelete: 'cascade' }),
  companyId: uuid('company_id').references(() => companies.id, { onDelete: 'cascade' }).notNull(), // Polygres Graph Edge 2
  pointOfContactId: uuid('point_of_contact_id').references(() => people.id, { onDelete: 'set null' }), // Polygres Graph Edge 3
  ownerId: text('owner_id').references(() => users.id, { onDelete: 'set null' }), // Account Executive who owns this deal
  name: text('name').notNull(),
  stage: text('stage').default('DISCOVERY').notNull(), // 'DISCOVERY', 'PROPOSAL', 'NEGOTIATION', 'CLOSED_WON', 'CLOSED_LOST'
  amountMicros: numeric('amount_micros').default('0').notNull(),
  currency: text('currency').default('USD').notNull(),
  closeDate: timestamp('close_date', { withTimezone: true }),
  probabilityPercent: integer('probability_percent').default(20),

  healthScore: numeric('health_score'), // AI-computed deal sentiment (-1.0 to +1.0)
  lossReason: text('loss_reason'),

  // Runtime Dynamic Custom Fields
  customFields: jsonb('custom_fields').default({}).notNull(),

  position: doublePrecision('position').default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  // Field/Record-Level Permissions: 'OPEN' | 'PRIVATE'
  visibility: text('visibility').default('OPEN').notNull(),
});

// ============================================================================
// 4. RUNTIME DYNAMIC CUSTOM FIELD DEFINITIONS (No-Code UI Custom Fields)
// ============================================================================
export const customFieldDefinitions = crmSchema.table('custom_field_definitions', {
  id: uuid('id').primaryKey().defaultRandom(),
  targetEntity: text('target_entity').notNull(), // 'companies', 'people', 'opportunities', or custom object name
  name: text('name').notNull(), // e.g. 'contractTier', 'hairColor', 'renewalDate'
  label: text('label').notNull(), // e.g. 'Contract Tier'
  fieldType: text('field_type').notNull(), // 'TEXT', 'NUMBER', 'BOOLEAN', 'DATE', 'SELECT', 'MULTI_SELECT'
  options: jsonb('options'), // Array of options for SELECT fields
  isRequired: boolean('is_required').default(false).notNull(),
  isSearchable: boolean('is_searchable').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// ============================================================================
// 5. RUNTIME DYNAMIC CUSTOM OBJECTS (No-Code Custom Entities)
// ============================================================================
export const customObjectDefinitions = crmSchema.table('custom_object_definitions', {
  id: uuid('id').primaryKey().defaultRandom(),
  nameSingular: text('name_singular').unique().notNull(), // e.g. 'listing', 'subscription', 'vehicle'
  namePlural: text('name_plural').unique().notNull(),     // e.g. 'listings', 'subscriptions', 'vehicles'
  labelSingular: text('label_singular').notNull(),        // e.g. 'Listing'
  labelPlural: text('label_plural').notNull(),            // e.g. 'Listings'
  description: text('description'),
  icon: text('icon'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const customObjectRecords = crmSchema.table('custom_object_records', {
  id: uuid('id').primaryKey().defaultRandom(),
  customObjectId: uuid('custom_object_id').references(() => customObjectDefinitions.id, { onDelete: 'cascade' }).notNull(),
  name: text('name').notNull(), // Primary display name / title

  // Relational Graph Edges to Core CRM Entities
  companyId: uuid('company_id').references(() => companies.id, { onDelete: 'set null' }),
  personId: uuid('person_id').references(() => people.id, { onDelete: 'set null' }),

  // Dynamic entity attributes stored as structured JSONB
  data: jsonb('data').default({}).notNull(),

  searchVector: text('search_vector'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

// ============================================================================
// 6. NOTES & TASKS
// ============================================================================
export const notes = crmSchema.table('notes', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title'),
  body: text('body').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const tasks = crmSchema.table('tasks', {
  id: uuid('id').primaryKey().defaultRandom(),
  assigneeId: text('assignee_id').references(() => users.id, { onDelete: 'set null' }),
  title: text('title').notNull(),
  body: text('body'),
  dueAt: timestamp('due_at', { withTimezone: true }),
  status: text('status').default('TODO').notNull(), // 'TODO', 'IN_PROGRESS', 'DONE', 'CANCELLED'
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// ============================================================================
// 7. TYPED POLYMORPHIC JUNCTIONS (Cascade-safe Graph Connections)
// ============================================================================
export const noteTargets = crmSchema.table('note_targets', {
  id: uuid('id').primaryKey().defaultRandom(),
  noteId: uuid('note_id').references(() => notes.id, { onDelete: 'cascade' }).notNull(),
  companyId: uuid('company_id').references(() => companies.id, { onDelete: 'cascade' }),
  personId: uuid('person_id').references(() => people.id, { onDelete: 'cascade' }),
  opportunityId: uuid('opportunity_id').references(() => opportunities.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const taskTargets = crmSchema.table('task_targets', {
  id: uuid('id').primaryKey().defaultRandom(),
  taskId: uuid('task_id').references(() => tasks.id, { onDelete: 'cascade' }).notNull(),
  companyId: uuid('company_id').references(() => companies.id, { onDelete: 'cascade' }),
  personId: uuid('person_id').references(() => people.id, { onDelete: 'cascade' }),
  opportunityId: uuid('opportunity_id').references(() => opportunities.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// ============================================================================
// 8. CALENDAR & COMMUNICATIONS
// ============================================================================
export const calendarEvents = crmSchema.table('calendar_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  description: text('description'),
  startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
  endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
  meetingUrl: text('meeting_url'),
  externalId: text('external_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const calendarEventTargets = crmSchema.table('calendar_event_targets', {
  id: uuid('id').primaryKey().defaultRandom(),
  calendarEventId: uuid('calendar_event_id').references(() => calendarEvents.id, { onDelete: 'cascade' }).notNull(),
  companyId: uuid('company_id').references(() => companies.id, { onDelete: 'cascade' }),
  personId: uuid('person_id').references(() => people.id, { onDelete: 'cascade' }),
  opportunityId: uuid('opportunity_id').references(() => opportunities.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// ============================================================================
// 9. TAGS (Polymorphic Labels Across Any Object — Standard or Custom)
// ============================================================================

/**
 * Tag definitions. Shared across all taggable entities so the same tag
 * ("Hot Lead", "Enterprise", "Churn Risk") can be reused everywhere.
 */
export const tags = crmSchema.table('tags', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: text('organization_id').references(() => organizations.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  color: text('color').default('gray'), // UI chip color: 'red', 'green', 'blue', 'gray', ...
  category: text('category'), // optional grouping: 'priority', 'industry', 'lifecycle'
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

/**
 * Polymorphic junction: attaches a tag to any record, standard or custom.
 * `taggableType` is a discriminator ('company', 'person', 'opportunity', or a
 * custom object's nameSingular); `taggableId` is that record's UUID.
 *
 * No physical FK on (taggableType, taggableId) — Postgres cannot enforce a
 * foreign key across a dynamic set of tables. Application code validates the
 * pair on write. This is the deliberate trade-off that lets tags work
 * uniformly across standard objects AND runtime-created custom objects
 * without a schema migration every time a new object type appears.
 */
export const taggables = crmSchema.table('taggables', {
  id: uuid('id').primaryKey().defaultRandom(),
  tagId: uuid('tag_id').references(() => tags.id, { onDelete: 'cascade' }).notNull(),
  taggableType: text('taggable_type').notNull(), // 'company' | 'person' | 'opportunity' | <custom object nameSingular>
  taggableId: uuid('taggable_id').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// ============================================================================
// 10. ACTIVITY TIMELINE (Unified Audit Feed Across Any Record)
// ============================================================================

/**
 * Append-only activity timeline for any CRM entity (company, person, opportunity,
 * or custom object record). Captures stage changes, field updates, emails,
 * calls, notes, tasks, and tag modifications in a single chronological feed.
 */
export const timelineActivities = crmSchema.table(
  'timeline_activities',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: text('organization_id').references(() => organizations.id, { onDelete: 'cascade' }),
    entityType: text('entity_type').notNull(), // 'company' | 'person' | 'opportunity' | <custom_object_name>
    entityId: uuid('entity_id').notNull(),
    activityType: text('activity_type').notNull(), // 'STAGE_CHANGED', 'FIELD_UPDATED', 'NOTE_ADDED', 'TASK_CREATED', 'CALL_LOGGED', 'TAG_ADDED', 'TAG_REMOVED', 'RECORD_CREATED'
    actorSource: text('actor_source').default('SYSTEM').notNull(), // 'MANUAL' | 'API' | 'AGENT' | 'SYSTEM'
    actorUserId: text('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
    actorName: text('actor_name'), // e.g. "Claude (AI Agent)", "Oscar Rivas", "Recall.ai Webhook"
    properties: jsonb('properties').default({}).notNull(), // structured payload: { from, to, noteTitle, tagName, ... }
    happenedAt: timestamp('happened_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_timeline_entity').on(table.entityType, table.entityId, table.happenedAt),
    index('idx_timeline_org').on(table.organizationId),
  ]
);

// ============================================================================
// 11. SAVED VIEWS & SEGMENTATION (Table, Kanban, Calendar Configurations)
// ============================================================================

/**
 * Saved views and segment definitions.
 * Stores reusable filter, sort, column visibility, and grouping configurations
 * for standard entities (companies, people, opportunities) or custom objects.
 */
export const views = crmSchema.table(
  'views',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: text('organization_id').references(() => organizations.id, { onDelete: 'cascade' }),
    ownerId: text('owner_id').references(() => users.id, { onDelete: 'cascade' }),
    targetEntity: text('target_entity').notNull(), // 'companies' | 'opportunities' | 'people' | <custom_object_name>
    name: text('name').notNull(), // e.g. "Q3 High Value Pipeline", "My Key Accounts"
    viewType: text('view_type').default('TABLE').notNull(), // 'TABLE' | 'KANBAN' | 'CALENDAR'
    filters: jsonb('filters').default([]).notNull(), // [{ field: 'stage', operator: 'eq', value: 'PROPOSAL' }]
    sortBy: jsonb('sort_by').default([]).notNull(), // [{ field: 'amountMicros', direction: 'desc' }]
    groupByField: text('group_by_field'), // for Kanban: 'stage', for calendar: 'closeDate'
    visibleFields: text('visible_fields').array().default([]).notNull(), // list of columns to display
    isShared: boolean('is_shared').default(false).notNull(), // true = visible to entire organization
    position: doublePrecision('position').default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_views_target_entity').on(table.targetEntity),
    index('idx_views_owner').on(table.ownerId),
    index('idx_views_org').on(table.organizationId),
  ]
);

// ============================================================================
// 12. DUPLICATE DETECTION & RECORD MERGE
// ============================================================================

/**
 * Merge candidate pairs identified by automated duplicate detection rules
 * (exact domain match, exact email match, fuzzy name similarity).
 */
export const mergeCandidates = crmSchema.table(
  'merge_candidates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: text('organization_id').references(() => organizations.id, { onDelete: 'cascade' }),
    entityType: text('entity_type').notNull(), // 'company' | 'person'
    primaryRecordId: uuid('primary_record_id').notNull(),
    duplicateRecordId: uuid('duplicate_record_id').notNull(),
    confidenceScore: numeric('confidence_score', { precision: 3, scale: 2 }).notNull(), // 0.00 to 1.00
    matchReason: text('match_reason').notNull(), // 'DOMAIN_MATCH', 'EMAIL_MATCH', 'FUZZY_NAME'
    status: text('status').default('PENDING').notNull(), // 'PENDING' | 'MERGED' | 'DISMISSED'
    reviewedByUserId: text('reviewed_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_merge_status').on(table.status),
    index('idx_merge_entity').on(table.entityType, table.primaryRecordId),
    index('idx_merge_org').on(table.organizationId),
  ]
);

// ============================================================================
// 13. OUTBOUND SEQUENCES & CADENCES (Outreach / Salesloft Automation Engine)
// ============================================================================

/**
 * Multi-touch outbound cadence definitions.
 */
export const sequences = crmSchema.table(
  'sequences',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: text('organization_id').references(() => organizations.id, { onDelete: 'cascade' }),
    ownerId: text('owner_id').references(() => users.id, { onDelete: 'set null' }),
    name: text('name').notNull(), // e.g. "Enterprise Cold Outbound - 7 Touch"
    description: text('description'),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_sequences_org').on(table.organizationId),
  ]
);

/**
 * Ordered steps within an outbound sequence.
 */
export const sequenceSteps = crmSchema.table(
  'sequence_steps',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sequenceId: uuid('sequence_id').references(() => sequences.id, { onDelete: 'cascade' }).notNull(),
    stepOrder: integer('step_order').notNull(), // 1, 2, 3, ...
    delayDays: integer('delay_days').default(0).notNull(), // Delay in days before executing this step
    channel: text('channel').notNull(), // 'EMAIL' | 'LINKEDIN' | 'PHONE_CALL' | 'TASK'
    templateSubject: text('template_subject'),
    templateBody: text('template_body'),
    promptInstructions: text('prompt_instructions'), // AI SDR prompt instructions for dynamic generation
    exitOnReply: boolean('exit_on_reply').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_sequence_steps_seq').on(table.sequenceId, table.stepOrder),
  ]
);

/**
 * Contact enrollments tracking state machine progress through a sequence.
 */
export const sequenceEnrollments = crmSchema.table(
  'sequence_enrollments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: text('organization_id').references(() => organizations.id, { onDelete: 'cascade' }),
    sequenceId: uuid('sequence_id').references(() => sequences.id, { onDelete: 'cascade' }).notNull(),
    personId: uuid('person_id').references(() => people.id, { onDelete: 'cascade' }).notNull(),
    companyId: uuid('company_id').references(() => companies.id, { onDelete: 'set null' }),
    currentStep: integer('current_step').default(1).notNull(),
    status: text('status').default('ACTIVE').notNull(), // 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'EXITED_REPLY'
    enrolledAt: timestamp('enrolled_at', { withTimezone: true }).defaultNow().notNull(),
    nextStepDueAt: timestamp('next_step_due_at', { withTimezone: true }).defaultNow().notNull(),
    lastStepExecutedAt: timestamp('last_step_executed_at', { withTimezone: true }),
    metadata: jsonb('metadata').default({}).notNull(),
  },
  (table) => [
    index('idx_sequence_enrollments_status').on(table.status, table.nextStepDueAt),
    index('idx_sequence_enrollments_person').on(table.personId),
    index('idx_sequence_enrollments_seq').on(table.sequenceId),
  ]
);

// ============================================================================
// 14. LEAD ROUTING & ASSIGNMENT RULES (Territory, Deal Size, Round-Robin)
// ============================================================================

/**
 * Lead routing and ownership assignment rules.
 * Directs newly created or unassigned records to reps based on
 * criteria (territory, revenue thresholds) and assignment strategy (round-robin, load-balanced).
 */
export const assignmentRules = crmSchema.table(
  'assignment_rules',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: text('organization_id').references(() => organizations.id, { onDelete: 'cascade' }),
    name: text('name').notNull(), // e.g. "Enterprise Deals to Strategic AEs"
    targetEntity: text('target_entity').notNull(), // 'opportunities' | 'people' | 'companies'
    conditions: jsonb('conditions').default([]).notNull(), // [{ field: 'annualRevenueAmountMicros', operator: 'gt', value: 1000000000000 }]
    assignmentStrategy: text('assignment_strategy').default('ROUND_ROBIN').notNull(), // 'ROUND_ROBIN' | 'LOAD_BALANCED' | 'SPECIFIC_USER'
    candidateUserIds: text('candidate_user_ids').array().default([]).notNull(), // Array of system.users.id
    lastAssignedUserId: text('last_assigned_user_id'), // Pointer for stateful round-robin cycle
    priority: integer('priority').default(0).notNull(), // Lower number runs first
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_assignment_rules_target').on(table.targetEntity, table.isActive, table.priority),
    index('idx_assignment_rules_org').on(table.organizationId),
  ]
);

// ============================================================================
// 15. PRODUCTS, PRICE BOOKS & QUOTES (CPQ - Configure, Price, Quote)
// ============================================================================

/**
 * Product catalog entries.
 */
export const products = crmSchema.table(
  'products',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: text('organization_id').references(() => organizations.id, { onDelete: 'cascade' }),
    name: text('name').notNull(), // e.g. "Enterprise Annual License"
    sku: text('sku').unique(), // e.g. "ENT-ANN-001"
    description: text('description'),
    defaultPriceMicros: numeric('default_price_micros').notNull(), // standard price in USD micros ($1 = 1,000,000)
    currency: text('currency').default('USD').notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_products_sku').on(table.sku),
    index('idx_products_org').on(table.organizationId),
  ]
);

/**
 * Line items attached to an opportunity.
 */
export const opportunityLineItems = crmSchema.table(
  'opportunity_line_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    opportunityId: uuid('opportunity_id').references(() => opportunities.id, { onDelete: 'cascade' }).notNull(),
    productId: uuid('product_id').references(() => products.id, { onDelete: 'restrict' }).notNull(),
    quantity: integer('quantity').default(1).notNull(),
    unitPriceMicros: numeric('unit_price_micros').notNull(),
    discountPercent: numeric('discount_percent', { precision: 5, scale: 2 }).default('0.00').notNull(),
    totalPriceMicros: numeric('total_price_micros').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_line_items_opp').on(table.opportunityId),
    index('idx_line_items_prod').on(table.productId),
  ]
);

/**
 * Formal quotes generated from opportunity line items.
 */
export const quotes = crmSchema.table(
  'quotes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: text('organization_id').references(() => organizations.id, { onDelete: 'cascade' }),
    opportunityId: uuid('opportunity_id').references(() => opportunities.id, { onDelete: 'cascade' }).notNull(),
    quoteNumber: text('quote_number').notNull(), // e.g. "Q-2026-0042"
    status: text('status').default('DRAFT').notNull(), // 'DRAFT' | 'SENT' | 'ACCEPTED' | 'EXPIRED' | 'REJECTED'
    totalAmountMicros: numeric('total_amount_micros').notNull(),
    currency: text('currency').default('USD').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    notes: text('notes'),
    pdfUrl: text('pdf_url'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_quotes_opp').on(table.opportunityId),
    index('idx_quotes_number').on(table.quoteNumber),
    index('idx_quotes_org').on(table.organizationId),
  ]
);

// ============================================================================
// 16. OUTBOUND WEBHOOKS (Public Notification & Integration API)
// ============================================================================

/**
 * External webhook subscriptions.
 * Emits authenticated payloads when CRM lifecycle events occur.
 */
export const webhookSubscriptions = crmSchema.table(
  'webhook_subscriptions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: text('organization_id').references(() => organizations.id, { onDelete: 'cascade' }),
    name: text('name').notNull(), // e.g. "Zapier Pipeline Ingestion"
    targetUrl: text('target_url').notNull(), // e.g. "https://hooks.zapier.com/..."
    eventTypes: text('event_types').array().default(['*']).notNull(), // e.g. ['opportunity.stage_changed', 'company.created']
    secret: text('secret').notNull(), // HMAC SHA-256 signing secret (whsec_...)
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_webhook_subs_org').on(table.organizationId),
  ]
);

/**
 * Outbound webhook delivery log and audit trail.
 */
export const webhookDeliveries = crmSchema.table(
  'webhook_deliveries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    subscriptionId: uuid('subscription_id').references(() => webhookSubscriptions.id, { onDelete: 'cascade' }).notNull(),
    eventType: text('event_type').notNull(),
    payload: jsonb('payload').notNull(),
    status: text('status').default('PENDING').notNull(), // 'PENDING' | 'DELIVERED' | 'FAILED'
    responseStatusCode: integer('response_status_code'),
    responseBody: text('response_body'),
    attempts: integer('attempts').default(1).notNull(),
    errorMessage: text('error_message'),
    deliveredAt: timestamp('delivered_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_webhook_deliveries_sub').on(table.subscriptionId, table.status),
    index('idx_webhook_deliveries_created').on(table.createdAt),
  ]
);

// ============================================================================
// 17. REPORTING & DASHBOARDS
// ============================================================================

export const dashboards = crmSchema.table('dashboards', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: text('organization_id').references(() => organizations.id, { onDelete: 'cascade' }),
  ownerId: text('owner_id').references(() => users.id, { onDelete: 'set null' }),
  name: text('name').notNull(),
  description: text('description'),
  isShared: boolean('is_shared').default(false).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const dashboardWidgets = crmSchema.table(
  'dashboard_widgets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    dashboardId: uuid('dashboard_id').references(() => dashboards.id, { onDelete: 'cascade' }).notNull(),
    widgetType: text('widget_type').notNull(), // 'PIPELINE_FUNNEL' | 'REP_PERFORMANCE' | 'DEAL_VELOCITY' | 'ENGAGEMENT' | 'NUMBER' | 'TABLE'
    title: text('title').notNull(),
    config: jsonb('config').default({}).notNull(), // widget-specific parameters
    position: jsonb('position').default({}).notNull(), // { x, y, w, h } for UI grid layout
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_dashboard_widgets_dash').on(table.dashboardId),
  ]
);

// ============================================================================
// 18. FIELD-LEVEL PERMISSION CONFIGURATION
// ============================================================================

/**
 * Per-role, per-entity field visibility and editability constraints.
 * Used to mask sensitive columns (e.g. salary, revenue) from non-admin roles.
 */
export const fieldPermissions = crmSchema.table(
  'field_permissions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: text('organization_id').references(() => organizations.id, { onDelete: 'cascade' }),
    entityType: text('entity_type').notNull(), // 'companies' | 'opportunities' | 'people'
    fieldName: text('field_name').notNull(), // column or customFields key
    role: text('role').notNull(), // 'guest' | 'member' | 'admin'
    canRead: boolean('can_read').default(true).notNull(),
    canWrite: boolean('can_write').default(false).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_field_perms_role').on(table.entityType, table.role),
    index('idx_field_perms_org').on(table.organizationId),
  ]
);
