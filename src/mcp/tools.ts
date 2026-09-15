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
} from '../db/schema';
import { polygres, searchCompanyContext, jointSearchOpportunity, logCallTranscriptAtomically } from '../lib/polygres';
import { eq, ilike } from 'drizzle-orm';

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
    const recs = await polygres.project().context.recommend('crm_transcripts', {
      positive_point_ids: positiveCompanyIds,
      negative_point_ids: negativeCompanyIds,
      limit,
    });
    return { recommendations: recs };
  },
};
