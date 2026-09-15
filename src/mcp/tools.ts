import { z } from 'zod';
import { db } from '../db';
import {
  companies,
  people,
  opportunities,
  customFieldDefinitions,
  customObjectDefinitions,
  customObjectRecords,
  mcpApprovals,
  tags,
  taggables,
} from '../db/schema';
import { polygres, searchCompanyContext, jointSearchOpportunity, logCallTranscriptAtomically } from '../lib/polygres';
import { eq, ilike, and, inArray } from 'drizzle-orm';
import { logTimelineActivity, getTimelineActivities, formatTimelineActivity } from '../lib/timeline';
import {
  createView,
  listViews,
  runView,
  deleteView,
  FilterCondition,
  SortCondition,
} from '../lib/views';
import {
  findDuplicates,
  mergeRecords,
  listMergeCandidates,
  dismissMergeCandidate,
} from '../lib/duplicates';
import {
  getCompanyHierarchy,
  setParentCompany,
} from '../lib/hierarchy';

/**
 * Tool Schemas for Model Context Protocol
 */
export const crmToolSchemas = {
  // 1. Search Companies
  searchCompanies: {
    description: 'Search for companies by name, domain, or industry.',
    parameters: z.object({
      query: z.string().describe('Search query matching company name or domain'),
      limit: z.number().default(10).optional(),
    }),
  },

  // 2. Get Company 360
  getCompany: {
    description: 'Get complete 360-degree view of a company including contacts, open opportunities, notes, and custom fields.',
    parameters: z.object({
      companyId: z.string().uuid().describe('The UUID of the company'),
    }),
  },

  // 3. Create Company (Supports standard fields and personalized customFields)
  createCompany: {
    description: 'Create a new company in the CRM with standard and personalized custom fields.',
    parameters: z.object({
      name: z.string().describe('Company legal or brand name'),
      domainName: z.string().optional().describe('Primary website domain, e.g. acme.com'),
      industry: z.string().optional(),
      annualRevenueMicros: z.number().optional().describe('Annual revenue in USD micro-units ($1 = 1,000,000 micros)'),
      customFields: z.record(z.unknown()).optional().describe('Personalized custom fields defined for companies'),
    }),
  },

  // 4. Update Opportunity Stage (Gated with HITL risk tiering)
  updateOpportunityStage: {
    description: 'Update the pipeline stage of an opportunity. Moving to CLOSED_WON triggers a human approval check.',
    parameters: z.object({
      opportunityId: z.string().uuid().describe('The UUID of the opportunity'),
      newStage: z.enum(['DISCOVERY', 'PROPOSAL', 'NEGOTIATION', 'CLOSED_WON', 'CLOSED_LOST']),
      healthScore: z.number().min(-1.0).max(1.0).optional().describe('AI assessed deal sentiment score (-1.0 to 1.0)'),
      reason: z.string().describe('Reasoning for the stage change'),
    }),
  },

  // 5. Define Custom Field
  createCustomField: {
    description: 'Define a new personalized custom field for companies, people, or opportunities at runtime.',
    parameters: z.object({
      targetEntity: z.enum(['companies', 'people', 'opportunities']).describe('Target CRM entity to attach the field to'),
      name: z.string().describe('Identifier in camelCase, e.g. contractTier, hairColor'),
      label: z.string().describe('Human readable label, e.g. Contract Tier'),
      fieldType: z.enum(['TEXT', 'NUMBER', 'BOOLEAN', 'DATE', 'SELECT', 'MULTI_SELECT']),
      options: z.array(z.string()).optional().describe('List of string choices for SELECT or MULTI_SELECT fields'),
      isRequired: z.boolean().default(false).optional(),
    }),
  },

  // 6. Define Custom Object Type
  createCustomObject: {
    description: 'Define a brand new custom object type in the CRM at runtime (e.g. listing, subscription, vehicle).',
    parameters: z.object({
      nameSingular: z.string().describe('Unique singular identifier, e.g. listing'),
      namePlural: z.string().describe('Unique plural identifier, e.g. listings'),
      labelSingular: z.string().describe('Display label singular, e.g. Listing'),
      labelPlural: z.string().describe('Display label plural, e.g. Listings'),
      description: z.string().optional(),
      icon: z.string().optional(),
    }),
  },

  // 7. Create Custom Object Record
  createCustomRecord: {
    description: 'Create a new record belonging to a defined custom object type.',
    parameters: z.object({
      customObjectName: z.string().describe('The singular name of the custom object, e.g. listing'),
      name: z.string().describe('Primary title or label for this specific record'),
      companyId: z.string().uuid().optional().describe('Optional company to link this record to'),
      personId: z.string().uuid().optional().describe('Optional person to link this record to'),
      data: z.record(z.unknown()).describe('Attributes and property values for this custom record'),
    }),
  },

  // 8. Search Custom Object Records
  searchCustomRecords: {
    description: 'Search for records belonging to a custom object type.',
    parameters: z.object({
      customObjectName: z.string().describe('The singular name of the custom object, e.g. listing'),
      query: z.string().optional().describe('Optional query matching record name'),
      limit: z.number().default(10).optional(),
    }),
  },

  // 9. Log Interaction Transcript (With atomic Polygres vector & graph sync)
  logMeetingTranscript: {
    description: 'Log an ambient call or meeting transcript with immediate Polygres vector & graph indexing.',
    parameters: z.object({
      channel: z.enum(['ZOOM', 'MEET', 'PHONE_CALL', 'EMAIL', 'WHATSAPP']),
      companyId: z.string().uuid(),
      opportunityId: z.string().uuid().optional(),
      rawTranscript: z.string().describe('Full verbatim conversation transcript'),
      summary: z.string().describe('Concise executive summary of agreements, sentiment, and blockers'),
      sentimentScore: z.number().min(-1.0).max(1.0).optional(),
      contentEmbedding: z.array(z.number()).describe('1536-dimension dense embedding of transcript'),
      summaryEmbedding: z.array(z.number()).optional().describe('1536-dimension dense embedding of summary'),
    }),
  },

  // 10. Polygres Graph-First Search (Entity-Anchored)
  polygresGraphSearch: {
    description: 'Perform an entity-anchored semantic search starting from a company node, traversing graph connections (people, notes, transcripts).',
    parameters: z.object({
      companyId: z.string().uuid(),
      queryEmbedding: z.array(z.number()).describe('1536-dimension dense query embedding'),
      limit: z.number().default(5).optional(),
    }),
  },

  // 11. Polygres Tri-Lane Joint Search
  polygresJointSearch: {
    description: 'Simultaneously co-rank dense vectors, exact lexical text matches (tsvector), and graph proximity around an opportunity.',
    parameters: z.object({
      opportunityId: z.string().uuid(),
      lexicalQuery: z.string().describe('Exact keywords to find, e.g. "SOC2 audit exception"'),
      queryEmbedding: z.array(z.number()).describe('1536-dimension dense query vector'),
      limit: z.number().default(10).optional(),
    }),
  },

  // 12. Polygres Recommend Lookalike Accounts
  polygresRecommendLookalikes: {
    description: 'Use vector mathematics across positive (won) and negative (churned) account exemplars to score and recommend lookalikes.',
    parameters: z.object({
      positiveCompanyIds: z.array(z.string().uuid()).describe('IDs of ideal won accounts'),
      negativeCompanyIds: z.array(z.string().uuid()).optional().describe('IDs of churned or disqualified accounts'),
      limit: z.number().default(10).optional(),
    }),
  },

  // 13. Create or Get Tag
  createTag: {
    description: 'Create a new tag (or return the existing one with the same name) for labeling any CRM record.',
    parameters: z.object({
      name: z.string().describe('Tag name, e.g. "Hot Lead", "Enterprise", "Churn Risk"'),
      color: z.enum(['red', 'orange', 'yellow', 'green', 'blue', 'purple', 'gray']).default('gray').optional(),
      category: z.string().optional().describe('Optional grouping, e.g. "priority", "industry", "lifecycle"'),
    }),
  },

  // 14. Attach Tag to Any Record (Standard or Custom Object)
  tagRecord: {
    description: 'Attach a tag to any CRM record — a company, person, opportunity, or custom object record.',
    parameters: z.object({
      tagName: z.string().describe('Name of the tag to attach (created automatically if it does not exist)'),
      taggableType: z.string().describe('Entity type: "company", "person", "opportunity", or a custom object nameSingular'),
      taggableId: z.string().uuid().describe('UUID of the record to tag'),
    }),
  },

  // 15. Remove Tag from a Record
  untagRecord: {
    description: 'Remove a tag from a CRM record.',
    parameters: z.object({
      tagName: z.string(),
      taggableType: z.string(),
      taggableId: z.string().uuid(),
    }),
  },

  // 16. List Tags on a Record
  getRecordTags: {
    description: 'List all tags currently attached to a specific record.',
    parameters: z.object({
      taggableType: z.string(),
      taggableId: z.string().uuid(),
    }),
  },

  // 17. Search Records by Tag
  searchByTag: {
    description: 'Find all records of a given type that have a specific tag attached.',
    parameters: z.object({
      tagName: z.string(),
      taggableType: z.string().describe('Filter to one entity type, e.g. "company" or "opportunity"'),
      limit: z.number().default(50).optional(),
    }),
  },

  // 18. Get Activity Timeline (Chronological audit feed for any entity)
  getTimeline: {
    description: 'Retrieve the unified chronological activity timeline for any CRM entity (company, person, opportunity, or custom object). Returns stage transitions, field changes, call transcripts, notes, tasks, and tags.',
    parameters: z.object({
      entityType: z.string().describe("Entity type: 'company', 'person', 'opportunity', or custom object name"),
      entityId: z.string().uuid().describe('UUID of the target record'),
      limit: z.number().min(1).max(100).default(20).optional().describe('Maximum number of activities to return (default 20)'),
    }),
  },

  // 19. Log Timeline Activity (Record an activity explicitly)
  logTimelineActivity: {
    description: 'Explicitly record an event into a CRM entity\'s chronological activity timeline (e.g. outreach touchpoint, external note, status update).',
    parameters: z.object({
      entityType: z.string().describe("Entity type: 'company', 'person', 'opportunity', or custom object name"),
      entityId: z.string().uuid().describe('UUID of the target record'),
      activityType: z.string().describe("Event type: e.g. 'MEETING_HELD', 'EMAIL_SENT', 'NOTE_ADDED', 'STAGE_CHANGED', 'FIELD_UPDATED', 'EXTERNAL_EVENT'"),
      actorSource: z.enum(['MANUAL', 'API', 'AGENT', 'SYSTEM']).default('AGENT').optional().describe('Origin of the action'),
      actorName: z.string().optional().describe("Display name of the actor, e.g. 'Outbound Agent', 'Clerk'"),
      actorUserId: z.string().optional().describe('Optional Clerk user ID if performed on behalf of a specific user'),
      properties: z.record(z.unknown()).default({}).optional().describe('Arbitrary structured metadata about the event'),
    }),
  },

  // 20. Create Saved View
  createView: {
    description: 'Create a reusable saved view (Table, Kanban, or Calendar) with custom filters, sorting, and grouping for any entity.',
    parameters: z.object({
      targetEntity: z.string().describe("Target entity: 'companies', 'opportunities', 'people', or custom object name"),
      name: z.string().describe("Human-friendly name, e.g. 'Enterprise Pipeline', 'Stale Deals'"),
      viewType: z.enum(['TABLE', 'KANBAN', 'CALENDAR']).default('TABLE').optional(),
      filters: z.array(z.object({
        field: z.string().describe("Field name to filter on, e.g. 'stage', 'industry', or a custom field name"),
        operator: z.enum(['eq', 'neq', 'contains', 'gt', 'gte', 'lt', 'lte', 'in', 'is_null', 'is_not_null']),
        value: z.unknown().optional(),
      })).default([]).optional(),
      sortBy: z.array(z.object({
        field: z.string(),
        direction: z.enum(['asc', 'desc']),
      })).default([]).optional(),
      groupByField: z.string().optional().describe("Field used to group Kanban columns (e.g. 'stage') or Calendar dates (e.g. 'closeDate')"),
      visibleFields: z.array(z.string()).default([]).optional().describe('Columns to show in the view'),
      isShared: z.boolean().default(false).optional().describe('Whether this view is shared across the entire organization'),
    }),
  },

  // 21. List Saved Views
  listViews: {
    description: 'List saved views and segment configurations, optionally filtered by target entity.',
    parameters: z.object({
      targetEntity: z.string().optional().describe("Filter views for one entity, e.g. 'opportunities', 'companies'"),
      organizationId: z.string().optional(),
      ownerId: z.string().optional(),
    }),
  },

  // 22. Run Saved View
  runView: {
    description: 'Execute a saved view by ID (or an ad-hoc view specification) and return filtered, sorted, and grouped records.',
    parameters: z.object({
      viewId: z.string().uuid().optional().describe('The UUID of an existing saved view to run'),
      targetEntity: z.string().optional().describe("For ad-hoc execution: 'companies', 'opportunities', 'people', or custom object name"),
      filters: z.array(z.object({
        field: z.string(),
        operator: z.enum(['eq', 'neq', 'contains', 'gt', 'gte', 'lt', 'lte', 'in', 'is_null', 'is_not_null']),
        value: z.unknown().optional(),
      })).optional(),
      sortBy: z.array(z.object({
        field: z.string(),
        direction: z.enum(['asc', 'desc']),
      })).optional(),
      groupByField: z.string().optional(),
      limit: z.number().min(1).max(250).default(50).optional(),
      offset: z.number().min(0).default(0).optional(),
    }),
  },

  // 23. Delete Saved View
  deleteView: {
    description: 'Delete an existing saved view by its UUID.',
    parameters: z.object({
      viewId: z.string().uuid().describe('The UUID of the view to delete'),
    }),
  },

  // 24. Find Duplicates
  findDuplicates: {
    description: 'Scan the CRM for potential duplicate companies (by domain, exact name, or fuzzy name similarity) or contacts (by email, company match, or fuzzy name).',
    parameters: z.object({
      entityType: z.enum(['company', 'person']).describe('Target entity type to scan for duplicates'),
      recordId: z.string().uuid().optional().describe('Optional UUID to check a specific record rather than scanning all records'),
      minConfidence: z.number().min(0.5).max(1.0).default(0.75).optional().describe('Minimum similarity confidence threshold (0.50 to 1.00)'),
    }),
  },

  // 25. List Merge Candidates
  listMergeCandidates: {
    description: 'List detected duplicate candidate pairs waiting for review or already merged/dismissed.',
    parameters: z.object({
      entityType: z.enum(['company', 'person']).optional(),
      status: z.enum(['PENDING', 'MERGED', 'DISMISSED']).default('PENDING').optional(),
      limit: z.number().min(1).max(200).default(50).optional(),
    }),
  },

  // 26. Merge Records (Tier 4 Irreversible Action - HITL Gated)
  mergeRecords: {
    description: 'Merge a duplicate record into a primary record. Re-points all related records (opportunities, contacts, notes, tasks, transcripts, tags) and soft-deletes the duplicate. Unapproved calls trigger Human-in-the-Loop review.',
    parameters: z.object({
      entityType: z.enum(['company', 'person']).describe('Type of records being merged'),
      primaryRecordId: z.string().uuid().describe('The surviving canonical record UUID'),
      duplicateRecordId: z.string().uuid().describe('The duplicate record UUID to be merged and soft-deleted'),
      approved: z.boolean().default(false).optional().describe('Set to true if human has explicitly authorized this irreversible merge'),
      reason: z.string().optional().describe('Justification for the merge'),
    }),
  },

  // 27. Dismiss Merge Candidate
  dismissMergeCandidate: {
    description: 'Dismiss a detected duplicate candidate pair as a false positive.',
    parameters: z.object({
      candidateId: z.string().uuid().describe('UUID of the merge_candidates record'),
    }),
  },

  // 28. Get Company Hierarchy & Rollup
  getCompanyHierarchy: {
    description: 'Retrieve the corporate hierarchy tree for an account, including root parent, ancestors, subsidiaries, and rolled-up active pipeline across all family entities.',
    parameters: z.object({
      companyId: z.string().uuid().describe('The UUID of the company to query'),
    }),
  },

  // 29. Set Parent Company (Subsidiary linking)
  setParentCompany: {
    description: 'Link a company to its corporate parent entity (subsidiary relationship) or detach it by setting parentCompanyId to null. Enforces loop/cycle prevention.',
    parameters: z.object({
      companyId: z.string().uuid().describe('The UUID of the subsidiary company'),
      parentCompanyId: z.string().uuid().nullable().describe('The UUID of the parent company, or null to detach'),
    }),
  },
};

/**
 * Handlers executing the tools against Drizzle DB & Polygres
 */
export const crmToolHandlers = {
  async searchCompanies({ query, limit = 10 }: { query: string; limit?: number }) {
    const results = await db.query.companies.findMany({
      where: ilike(companies.name, `%${query}%`),
      limit,
    });
    return { count: results.length, companies: results };
  },

  async getCompany({ companyId }: { companyId: string }) {
    const company = await db.query.companies.findFirst({
      where: eq(companies.id, companyId),
      with: {
        people: true,
        opportunities: true,
        transcripts: true,
        customObjectRecords: true,
      },
    });
    if (!company) {
      throw new Error(`Company with ID ${companyId} not found`);
    }
    return company;
  },

  async createCompany({ name, domainName, industry, annualRevenueMicros, customFields }: {
    name: string;
    domainName?: string;
    industry?: string;
    annualRevenueMicros?: number;
    customFields?: Record<string, unknown>;
  }) {
    const [created] = await db.insert(companies).values({
      name,
      domainName,
      industry,
      annualRevenueAmountMicros: annualRevenueMicros ? annualRevenueMicros.toString() : null,
      customFields: customFields ?? {},
    }).returning();
    await logTimelineActivity({
      entityType: 'company',
      entityId: created.id,
      activityType: 'RECORD_CREATED',
      actorSource: 'AGENT',
      actorName: 'CRM MCP Server',
      properties: { name, domainName, industry },
    });
    return { success: true, company: created };
  },

  async updateOpportunityStage({ opportunityId, newStage, healthScore, reason }: {
    opportunityId: string;
    newStage: 'DISCOVERY' | 'PROPOSAL' | 'NEGOTIATION' | 'CLOSED_WON' | 'CLOSED_LOST';
    healthScore?: number;
    reason: string;
  }) {
    // Risk Gate: If moving to CLOSED_WON or CLOSED_LOST, require Human-in-the-Loop approval
    if (newStage === 'CLOSED_WON' || newStage === 'CLOSED_LOST') {
      const [approval] = await db.insert(mcpApprovals).values({
        toolName: 'updateOpportunityStage',
        actionType: 'CHANGE_STAGE_HIGH_RISK',
        payload: { opportunityId, newStage, healthScore, reason },
        proposedText: `Agent requests to move opportunity ${opportunityId} to ${newStage}. Reason: ${reason}`,
        riskTier: 4,
        status: 'PENDING',
      }).returning();

      return {
        status: 'PENDING_APPROVAL',
        message: `High-risk action intercepted. Human approval request #${approval.id} created in the CRM inbox.`,
        approvalId: approval.id,
      };
    }

    const [updated] = await db.update(opportunities)
      .set({
        stage: newStage,
        healthScore: healthScore ? healthScore.toString() : undefined,
        updatedAt: new Date(),
      })
      .where(eq(opportunities.id, opportunityId))
      .returning();

    if (updated) {
      await logTimelineActivity({
        entityType: 'opportunity',
        entityId: opportunityId,
        activityType: 'STAGE_CHANGED',
        actorSource: 'AGENT',
        actorName: 'CRM MCP Server',
        properties: { to: newStage, reason, healthScore },
      });
      if (updated.companyId) {
        await logTimelineActivity({
          entityType: 'company',
          entityId: updated.companyId,
          activityType: 'STAGE_CHANGED',
          actorSource: 'AGENT',
          actorName: 'CRM MCP Server',
          properties: { opportunityId, opportunityName: updated.name, to: newStage, reason },
        });
      }
    }

    return { success: true, opportunity: updated };
  },

  async createCustomField({ targetEntity, name, label, fieldType, options, isRequired = false }: {
    targetEntity: 'companies' | 'people' | 'opportunities';
    name: string;
    label: string;
    fieldType: 'TEXT' | 'NUMBER' | 'BOOLEAN' | 'DATE' | 'SELECT' | 'MULTI_SELECT';
    options?: string[];
    isRequired?: boolean;
  }) {
    const [created] = await db.insert(customFieldDefinitions).values({
      targetEntity,
      name,
      label,
      fieldType,
      options: options ?? null,
      isRequired,
      isSearchable: true,
    }).returning();

    // Register JSONB path in Polygres if applicable
    try {
      await polygres.project().context.registerJsonbPath('crm_transcripts', name, 'custom_fields', [name]);
    } catch {
      // Non-blocking if collection is not yet ready
    }

    return { success: true, customField: created };
  },

  async createCustomObject({ nameSingular, namePlural, labelSingular, labelPlural, description, icon }: {
    nameSingular: string;
    namePlural: string;
    labelSingular: string;
    labelPlural: string;
    description?: string;
    icon?: string;
  }) {
    const [created] = await db.insert(customObjectDefinitions).values({
      nameSingular,
      namePlural,
      labelSingular,
      labelPlural,
      description,
      icon,
    }).returning();
    return { success: true, customObject: created };
  },

  async createCustomRecord({ customObjectName, name, companyId, personId, data }: {
    customObjectName: string;
    name: string;
    companyId?: string;
    personId?: string;
    data: Record<string, unknown>;
  }) {
    const definition = await db.query.customObjectDefinitions.findFirst({
      where: eq(customObjectDefinitions.nameSingular, customObjectName),
    });

    if (!definition) {
      throw new Error(`Custom object type "${customObjectName}" does not exist`);
    }

    const [created] = await db.insert(customObjectRecords).values({
      customObjectId: definition.id,
      name,
      companyId: companyId ?? null,
      personId: personId ?? null,
      data,
    }).returning();

    await logTimelineActivity({
      entityType: customObjectName,
      entityId: created.id,
      activityType: 'RECORD_CREATED',
      actorSource: 'AGENT',
      actorName: 'CRM MCP Server',
      properties: { name, customObjectName, data },
    });
    if (companyId) {
      await logTimelineActivity({
        entityType: 'company',
        entityId: companyId,
        activityType: 'RECORD_CREATED',
        actorSource: 'AGENT',
        actorName: 'CRM MCP Server',
        properties: { customRecordId: created.id, customObjectName, name },
      });
    }

    return { success: true, record: created };
  },

  async searchCustomRecords({ customObjectName, query, limit = 10 }: {
    customObjectName: string;
    query?: string;
    limit?: number;
  }) {
    const definition = await db.query.customObjectDefinitions.findFirst({
      where: eq(customObjectDefinitions.nameSingular, customObjectName),
    });

    if (!definition) {
      throw new Error(`Custom object type "${customObjectName}" does not exist`);
    }

    const records = await db.query.customObjectRecords.findMany({
      where: query
        ? ilike(customObjectRecords.name, `%${query}%`)
        : eq(customObjectRecords.customObjectId, definition.id),
      limit,
      with: {
        company: true,
        person: true,
      },
    });

    return { count: records.length, records };
  },

  async logMeetingTranscript(data: {
    channel: 'ZOOM' | 'MEET' | 'PHONE_CALL' | 'EMAIL' | 'WHATSAPP';
    companyId: string;
    opportunityId?: string;
    rawTranscript: string;
    summary: string;
    sentimentScore?: number;
    contentEmbedding: number[];
    summaryEmbedding?: number[];
  }) {
    const result = await logCallTranscriptAtomically(data);
    if (result.rowCommitted) {
      await logTimelineActivity({
        entityType: 'company',
        entityId: data.companyId,
        activityType: 'CALL_LOGGED',
        actorSource: 'AGENT',
        actorName: 'Ambient Ingestion Bot',
        properties: {
          channel: data.channel,
          summary: data.summary,
          opportunityId: data.opportunityId,
        },
      });
    }
    return {
      success: true,
      rowCommitted: result.rowCommitted,
      polygresSyncStatus: result.context?.status,
    };
  },

  async polygresGraphSearch({ companyId, queryEmbedding, limit = 5 }: {
    companyId: string;
    queryEmbedding: number[];
    limit?: number;
  }) {
    const results = await searchCompanyContext(companyId, queryEmbedding, limit);
    return { results };
  },

  async polygresJointSearch({ opportunityId, lexicalQuery, queryEmbedding, limit = 10 }: {
    opportunityId: string;
    lexicalQuery: string;
    queryEmbedding: number[];
    limit?: number;
  }) {
    const results = await jointSearchOpportunity(opportunityId, lexicalQuery, queryEmbedding, limit);
    return { results };
  },

  async polygresRecommendLookalikes({ positiveCompanyIds, negativeCompanyIds = [], limit = 10 }: {
    positiveCompanyIds: string[];
    negativeCompanyIds?: string[];
    limit?: number;
  }) {
    // Polygres pgContext assigns each indexed row an internal numeric point ID;
    // recommend() takes those, not source-table UUIDs. Company IDs pass through
    // as opaque identifiers to the collection's configured source_key_column,
    // which Polygres resolves server-side to the matching point IDs.
    const recs = await polygres.project().context.recommend('crm_transcripts', {
      positive_point_ids: positiveCompanyIds as unknown as number[],
      negative_point_ids: negativeCompanyIds as unknown as number[],
      limit,
    });
    return { recommendations: recs };
  },

  async createTag({ name, color = 'gray', category }: {
    name: string;
    color?: string;
    category?: string;
  }) {
    const existing = await db.query.tags.findFirst({ where: eq(tags.name, name) });
    if (existing) {
      return { success: true, tag: existing, wasExisting: true };
    }
    const [created] = await db.insert(tags).values({ name, color, category }).returning();
    return { success: true, tag: created, wasExisting: false };
  },

  async tagRecord({ tagName, taggableType, taggableId }: {
    tagName: string;
    taggableType: string;
    taggableId: string;
  }) {
    let tag = await db.query.tags.findFirst({ where: eq(tags.name, tagName) });
    if (!tag) {
      [tag] = await db.insert(tags).values({ name: tagName }).returning();
    }

    const existingLink = await db.query.taggables.findFirst({
      where: and(
        eq(taggables.tagId, tag.id),
        eq(taggables.taggableType, taggableType),
        eq(taggables.taggableId, taggableId),
      ),
    });
    if (existingLink) {
      return { success: true, alreadyTagged: true, tag };
    }

    const [link] = await db.insert(taggables).values({
      tagId: tag.id,
      taggableType,
      taggableId,
    }).returning();

    await logTimelineActivity({
      entityType: taggableType,
      entityId: taggableId,
      activityType: 'TAG_ADDED',
      actorSource: 'AGENT',
      actorName: 'CRM MCP Server',
      properties: { tagId: tag.id, tagName: tag.name },
    });

    return { success: true, alreadyTagged: false, tag, link };
  },

  async untagRecord({ tagName, taggableType, taggableId }: {
    tagName: string;
    taggableType: string;
    taggableId: string;
  }) {
    const tag = await db.query.tags.findFirst({ where: eq(tags.name, tagName) });
    if (!tag) {
      return { success: false, message: `Tag "${tagName}" does not exist` };
    }

    await db.delete(taggables).where(and(
      eq(taggables.tagId, tag.id),
      eq(taggables.taggableType, taggableType),
      eq(taggables.taggableId, taggableId),
    ));

    await logTimelineActivity({
      entityType: taggableType,
      entityId: taggableId,
      activityType: 'TAG_REMOVED',
      actorSource: 'AGENT',
      actorName: 'CRM MCP Server',
      properties: { tagId: tag.id, tagName: tag.name },
    });

    return { success: true };
  },

  async getRecordTags({ taggableType, taggableId }: {
    taggableType: string;
    taggableId: string;
  }) {
    const links = await db.query.taggables.findMany({
      where: and(
        eq(taggables.taggableType, taggableType),
        eq(taggables.taggableId, taggableId),
      ),
      with: { tag: true },
    });
    return { tags: links.map(l => l.tag) };
  },

  async searchByTag({ tagName, taggableType, limit = 50 }: {
    tagName: string;
    taggableType: string;
    limit?: number;
  }) {
    const tag = await db.query.tags.findFirst({ where: eq(tags.name, tagName) });
    if (!tag) {
      return { count: 0, recordIds: [] };
    }

    const links = await db.query.taggables.findMany({
      where: and(
        eq(taggables.tagId, tag.id),
        eq(taggables.taggableType, taggableType),
      ),
      limit,
    });

    const recordIds = links.map(l => l.taggableId);

    // Resolve full records for the two most common standard types
    if (taggableType === 'company' && recordIds.length > 0) {
      const records = await db.query.companies.findMany({ where: inArray(companies.id, recordIds) });
      return { count: records.length, records };
    }
    if (taggableType === 'opportunity' && recordIds.length > 0) {
      const records = await db.query.opportunities.findMany({ where: inArray(opportunities.id, recordIds) });
      return { count: records.length, records };
    }

    return { count: recordIds.length, recordIds };
  },

  async getTimeline({ entityType, entityId, limit = 20 }: {
    entityType: string;
    entityId: string;
    limit?: number;
  }) {
    const activities = await getTimelineActivities({ entityType, entityId, limit });
    return {
      entityType,
      entityId,
      totalCount: activities.length,
      activities: activities.map(a => ({
        id: a.id,
        activityType: a.activityType,
        actorSource: a.actorSource,
        actorName: a.actorName,
        actorUser: a.actorUser ? { id: a.actorUser.id, name: a.actorUser.name, email: a.actorUser.email } : null,
        properties: a.properties,
        happenedAt: a.happenedAt,
        summary: formatTimelineActivity(a),
      })),
    };
  },

  async logTimelineActivity({ entityType, entityId, activityType, actorSource = 'AGENT', actorName, actorUserId, properties = {} }: {
    entityType: string;
    entityId: string;
    activityType: string;
    actorSource?: 'MANUAL' | 'API' | 'AGENT' | 'SYSTEM';
    actorName?: string;
    actorUserId?: string;
    properties?: Record<string, unknown>;
  }) {
    const activity = await logTimelineActivity({
      entityType,
      entityId,
      activityType,
      actorSource,
      actorName,
      actorUserId,
      properties,
    });
    return {
      success: true,
      activity,
      summary: activity ? formatTimelineActivity(activity) : null,
    };
  },

  async createView(input: {
    targetEntity: string;
    name: string;
    viewType?: 'TABLE' | 'KANBAN' | 'CALENDAR';
    filters?: FilterCondition[];
    sortBy?: SortCondition[];
    groupByField?: string;
    visibleFields?: string[];
    isShared?: boolean;
  }) {
    const view = await createView(input);
    return { success: true, view };
  },

  async listViews(input: { targetEntity?: string; organizationId?: string; ownerId?: string }) {
    const viewsList = await listViews(input);
    return { count: viewsList.length, views: viewsList };
  },

  async runView(input: {
    viewId?: string;
    targetEntity?: string;
    filters?: FilterCondition[];
    sortBy?: SortCondition[];
    groupByField?: string;
    limit?: number;
    offset?: number;
  }) {
    if (input.viewId) {
      const result = await runView({ viewId: input.viewId, limit: input.limit, offset: input.offset });
      return result;
    }
    if (!input.targetEntity) {
      throw new Error('Either viewId or targetEntity must be provided to runView');
    }
    const result = await runView({
      view: {
        targetEntity: input.targetEntity,
        filters: input.filters,
        sortBy: input.sortBy,
        groupByField: input.groupByField,
        viewType: input.groupByField ? 'KANBAN' : 'TABLE',
      },
      limit: input.limit,
      offset: input.offset,
    });
    return result;
  },

  async deleteView({ viewId }: { viewId: string }) {
    const deleted = await deleteView(viewId);
    return { success: true, deletedView: deleted };
  },

  async findDuplicates({ entityType, recordId, minConfidence = 0.75 }: {
    entityType: 'company' | 'person';
    recordId?: string;
    minConfidence?: number;
  }) {
    const candidates = await findDuplicates({ entityType, recordId, minConfidence, persist: true });
    return {
      entityType,
      foundCount: candidates.length,
      candidates,
    };
  },

  async listMergeCandidates(options: {
    entityType?: 'company' | 'person';
    status?: 'PENDING' | 'MERGED' | 'DISMISSED';
    limit?: number;
  }) {
    const candidates = await listMergeCandidates(options);
    return { count: candidates.length, candidates };
  },

  async mergeRecords({ entityType, primaryRecordId, duplicateRecordId, approved = false, reason }: {
    entityType: 'company' | 'person';
    primaryRecordId: string;
    duplicateRecordId: string;
    approved?: boolean;
    reason?: string;
  }) {
    // Tier 4 HITL Risk Gate: If not explicitly authorized, route to human approval queue
    if (!approved) {
      const [approval] = await db.insert(mcpApprovals).values({
        toolName: 'mergeRecords',
        actionType: 'MERGE_RECORDS_IRREVERSIBLE',
        payload: { entityType, primaryRecordId, duplicateRecordId, reason },
        proposedText: `Agent requested merge of duplicate ${entityType} ${duplicateRecordId} into primary ${primaryRecordId}. Reason: ${reason || 'Automated deduplication'}`,
        riskTier: 4,
        status: 'PENDING',
      }).returning();

      return {
        status: 'PENDING_APPROVAL',
        message: `Irreversible merge intercepted. Human approval request #${approval.id} created in the CRM inbox.`,
        approvalId: approval.id,
      };
    }

    const result = await mergeRecords({
      entityType,
      primaryRecordId,
      duplicateRecordId,
    });

    return {
      status: 'SUCCESS',
      message: `Successfully merged ${entityType} ${duplicateRecordId} into ${primaryRecordId}`,
      ...result,
    };
  },

  async dismissMergeCandidate({ candidateId }: { candidateId: string }) {
    const updated = await dismissMergeCandidate(candidateId);
    return { success: true, candidate: updated };
  },

  async getCompanyHierarchy({ companyId }: { companyId: string }) {
    const hierarchy = await getCompanyHierarchy(companyId);
    return hierarchy;
  },

  async setParentCompany({ companyId, parentCompanyId }: {
    companyId: string;
    parentCompanyId: string | null;
  }) {
    const updated = await setParentCompany({ companyId, parentCompanyId });
    return {
      success: true,
      message: parentCompanyId
        ? `Company ${companyId} linked to parent ${parentCompanyId}`
        : `Company ${companyId} detached from parent`,
      company: updated,
    };
  },
};
