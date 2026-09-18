import { pgSchema, uuid, text, timestamp, numeric, jsonb } from 'drizzle-orm/pg-core';
import { companies, people, opportunities } from './crm';

export const retrievalSchema = pgSchema('retrieval');

// ============================================================================
// 1. INTERACTION TRANSCRIPTS (Ambient Audio, Call & Email Grounding)
// ============================================================================
export const interactionTranscripts = retrievalSchema.table('interaction_transcripts', {
  id: uuid('id').primaryKey().defaultRandom(),
  channel: text('channel').notNull(), // 'ZOOM', 'MEET', 'PHONE_CALL', 'EMAIL', 'WHATSAPP'
  externalCallId: text('external_call_id'),

  // Cross-schema Relational Anchors (Polygres Graph Edges)
  companyId: uuid('company_id').references(() => companies.id, { onDelete: 'cascade' }),
  personId: uuid('person_id').references(() => people.id, { onDelete: 'set null' }),
  opportunityId: uuid('opportunity_id').references(() => opportunities.id, { onDelete: 'set null' }),

  // Unstructured Content
  rawTranscript: text('raw_transcript').notNull(),
  executiveSummary: text('executive_summary'),
  actionItems: jsonb('action_items').default([]).notNull(),
  objectionsRaised: jsonb('objections_raised').default([]).notNull(),
  competitorsMentioned: text('competitors_mentioned').array().default([]).notNull(),
  sentimentScore: numeric('sentiment_score', { precision: 3, scale: 2 }), // -1.00 to +1.00

  // Multi-Vector Embeddings for Polygres pgContext
  // Stored as text representation in Drizzle; Polygres manages the HNSW vector index
  contentEmbedding: text('content_embedding'), // 1536-dim conversation vector
  summaryEmbedding: text('summary_embedding'), // 1536-dim topic/intent vector

  searchVector: text('search_vector'),
  happenedAt: timestamp('happened_at', { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// ============================================================================
// 2. KNOWLEDGE DOCUMENTS (Company Battlecards, FAQs, Product Specs)
// ============================================================================
export const knowledgeDocuments = retrievalSchema.table('knowledge_documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  category: text('category').notNull(), // 'BATTLECARD', 'PRICING_RULE', 'TECHNICAL_SPEC', 'CASE_STUDY'
  content: text('content').notNull(),
  embedding: text('embedding'), // 1536-dim vector for semantic search
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
