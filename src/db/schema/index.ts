import { relations } from 'drizzle-orm';
import { users, apiKeys } from './system';
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
}));

export const companiesRelations = relations(companies, ({ one, many }) => ({
  owner: one(users, {
    fields: [companies.ownerId],
    references: [users.id],
  }),
  people: many(people),
  opportunities: many(opportunities),
  noteTargets: many(noteTargets),
  taskTargets: many(taskTargets),
  transcripts: many(interactionTranscripts),
  telemetryEvents: many(telemetryEvents),
  customObjectRecords: many(customObjectRecords),
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
}));

export const opportunitiesRelations = relations(opportunities, ({ one, many }) => ({
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
