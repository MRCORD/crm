import { relations } from 'drizzle-orm';
import { users, apiKeys, organizations, organizationMembers } from './system';
import {
  companies,
  people,
  opportunities,
  notes,
  tasks,
  noteTargets,
  taskTargets,
  calendarEvents,
  calendarEventTargets,
  customFieldDefinitions,
  customObjectDefinitions,
  customObjectRecords,
  tags,
  taggables,
  timelineActivities,
  views,
  mergeCandidates,
  sequences,
  sequenceSteps,
  sequenceEnrollments,
} from './crm';
import { mcpClients, mcpToolCallReceipts, mcpApprovals } from './mcp';
import { interactionTranscripts, knowledgeDocuments } from './retrieval';
import { sourceConnections, telemetryEvents, eventOutbox } from './ingest';

// Re-export all schemas and tables
export * from './system';
export * from './crm';
export * from './mcp';
export * from './retrieval';
export * from './ingest';

// ============================================================================
// DRIZZLE RELATIONS DEFINITION
// ============================================================================

export const usersRelations = relations(users, ({ many }) => ({
  apiKeys: many(apiKeys),
  assignedTasks: many(tasks),
  reviewedApprovals: many(mcpApprovals),
  ownedCompanies: many(companies),
  ownedOpportunities: many(opportunities),
  organizationMemberships: many(organizationMembers),
  timelineActivities: many(timelineActivities),
  views: many(views),
  reviewedMerges: many(mergeCandidates),
  ownedSequences: many(sequences),
}));

export const organizationsRelations = relations(organizations, ({ many }) => ({
  members: many(organizationMembers),
  companies: many(companies),
  opportunities: many(opportunities),
  tags: many(tags),
  apiKeys: many(apiKeys),
  timelineActivities: many(timelineActivities),
  views: many(views),
  mergeCandidates: many(mergeCandidates),
  sequences: many(sequences),
}));

export const organizationMembersRelations = relations(organizationMembers, ({ one }) => ({
  organization: one(organizations, {
    fields: [organizationMembers.organizationId],
    references: [organizations.id],
  }),
  user: one(users, {
    fields: [organizationMembers.userId],
    references: [users.id],
  }),
}));

export const companiesRelations = relations(companies, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [companies.organizationId],
    references: [organizations.id],
  }),
  owner: one(users, {
    fields: [companies.ownerId],
    references: [users.id],
  }),
  parentCompany: one(companies, {
    fields: [companies.parentCompanyId],
    references: [companies.id],
    relationName: 'subsidiaries',
  }),
  subsidiaries: many(companies, {
    relationName: 'subsidiaries',
  }),
  people: many(people),
  opportunities: many(opportunities),
  noteTargets: many(noteTargets),
  taskTargets: many(taskTargets),
  transcripts: many(interactionTranscripts),
  telemetryEvents: many(telemetryEvents),
  customObjectRecords: many(customObjectRecords),
  sequenceEnrollments: many(sequenceEnrollments),
}));

export const peopleRelations = relations(people, ({ one, many }) => ({
  company: one(companies, {
    fields: [people.companyId],
    references: [companies.id],
  }),
  opportunities: many(opportunities),
  noteTargets: many(noteTargets),
  transcripts: many(interactionTranscripts),
  customObjectRecords: many(customObjectRecords),
  sequenceEnrollments: many(sequenceEnrollments),
}));

export const opportunitiesRelations = relations(opportunities, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [opportunities.organizationId],
    references: [organizations.id],
  }),
  company: one(companies, {
    fields: [opportunities.companyId],
    references: [companies.id],
  }),
  pointOfContact: one(people, {
    fields: [opportunities.pointOfContactId],
    references: [people.id],
  }),
  owner: one(users, {
    fields: [opportunities.ownerId],
    references: [users.id],
  }),
  noteTargets: many(noteTargets),
  transcripts: many(interactionTranscripts),
}));

export const tagsRelations = relations(tags, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [tags.organizationId],
    references: [organizations.id],
  }),
  taggables: many(taggables),
}));

export const taggablesRelations = relations(taggables, ({ one }) => ({
  tag: one(tags, {
    fields: [taggables.tagId],
    references: [tags.id],
  }),
}));

export const customObjectDefinitionsRelations = relations(customObjectDefinitions, ({ many }) => ({
  records: many(customObjectRecords),
}));

export const customObjectRecordsRelations = relations(customObjectRecords, ({ one }) => ({
  definition: one(customObjectDefinitions, {
    fields: [customObjectRecords.customObjectId],
    references: [customObjectDefinitions.id],
  }),
  company: one(companies, {
    fields: [customObjectRecords.companyId],
    references: [companies.id],
  }),
  person: one(people, {
    fields: [customObjectRecords.personId],
    references: [people.id],
  }),
}));

export const mcpClientsRelations = relations(mcpClients, ({ many }) => ({
  receipts: many(mcpToolCallReceipts),
  approvals: many(mcpApprovals),
}));

export const mcpToolCallReceiptsRelations = relations(mcpToolCallReceipts, ({ one }) => ({
  client: one(mcpClients, {
    fields: [mcpToolCallReceipts.clientId],
    references: [mcpClients.id],
  }),
}));

export const mcpApprovalsRelations = relations(mcpApprovals, ({ one }) => ({
  client: one(mcpClients, {
    fields: [mcpApprovals.clientId],
    references: [mcpClients.id],
  }),
  reviewedByUser: one(users, {
    fields: [mcpApprovals.assignedToUserId],
    references: [users.id],
  }),
}));

export const interactionTranscriptsRelations = relations(interactionTranscripts, ({ one }) => ({
  company: one(companies, {
    fields: [interactionTranscripts.companyId],
    references: [companies.id],
  }),
  person: one(people, {
    fields: [interactionTranscripts.personId],
    references: [people.id],
  }),
  opportunity: one(opportunities, {
    fields: [interactionTranscripts.opportunityId],
    references: [opportunities.id],
  }),
}));

export const timelineActivitiesRelations = relations(timelineActivities, ({ one }) => ({
  organization: one(organizations, {
    fields: [timelineActivities.organizationId],
    references: [organizations.id],
  }),
  actorUser: one(users, {
    fields: [timelineActivities.actorUserId],
    references: [users.id],
  }),
}));

export const viewsRelations = relations(views, ({ one }) => ({
  organization: one(organizations, {
    fields: [views.organizationId],
    references: [organizations.id],
  }),
  owner: one(users, {
    fields: [views.ownerId],
    references: [users.id],
  }),
}));

export const mergeCandidatesRelations = relations(mergeCandidates, ({ one }) => ({
  organization: one(organizations, {
    fields: [mergeCandidates.organizationId],
    references: [organizations.id],
  }),
  reviewedByUser: one(users, {
    fields: [mergeCandidates.reviewedByUserId],
    references: [users.id],
  }),
}));

export const sequencesRelations = relations(sequences, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [sequences.organizationId],
    references: [organizations.id],
  }),
  owner: one(users, {
    fields: [sequences.ownerId],
    references: [users.id],
  }),
  steps: many(sequenceSteps),
  enrollments: many(sequenceEnrollments),
}));

export const sequenceStepsRelations = relations(sequenceSteps, ({ one }) => ({
  sequence: one(sequences, {
    fields: [sequenceSteps.sequenceId],
    references: [sequences.id],
  }),
}));

export const sequenceEnrollmentsRelations = relations(sequenceEnrollments, ({ one }) => ({
  sequence: one(sequences, {
    fields: [sequenceEnrollments.sequenceId],
    references: [sequences.id],
  }),
  person: one(people, {
    fields: [sequenceEnrollments.personId],
    references: [people.id],
  }),
  company: one(companies, {
    fields: [sequenceEnrollments.companyId],
    references: [companies.id],
  }),
  organization: one(organizations, {
    fields: [sequenceEnrollments.organizationId],
    references: [organizations.id],
  }),
}));
