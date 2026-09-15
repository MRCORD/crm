import { pgSchema, uuid, text, timestamp, numeric, integer, doublePrecision, boolean, jsonb } from 'drizzle-orm/pg-core';
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
  ownerId: uuid('owner_id').references(() => users.id, { onDelete: 'set null' }),

  // Full-Text Search Vector placeholder
  searchVector: text('search_vector'),
  position: doublePrecision('position').default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

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
  ownerId: uuid('owner_id').references(() => users.id, { onDelete: 'set null' }), // Account Executive who owns this deal
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
  assigneeId: uuid('assignee_id').references(() => users.id, { onDelete: 'set null' }),
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
