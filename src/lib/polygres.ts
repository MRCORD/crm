import { Polygres } from 'polygres-sdk-ts';

// Singleton Polygres client using Project API Key
export const polygres = new Polygres({
  apiKey: process.env.POLYGRES_API_KEY || 'poly_live_00000000000000000000000000000000',
  runtimeUrl: process.env.POLYGRES_RUNTIME_URL || 'https://runtime.polygres.com',
});

/**
 * Initialize Polygres pgContext collection over the retrieval.interaction_transcripts table.
 * Run once during boilerplate setup or project initialization.
 */
export async function initPolygresRetrieval() {
  const ctx = polygres.project().context;

  // 1. Create pgContext collection targeting the retrieval schema
  const operation = await ctx.createCollection('crm_transcripts', {
    source: {
      mode: 'existing',
      schema_name: 'retrieval',
      table_name: 'interaction_transcripts',
      source_key_column: 'id',
    },
    vector: {
      column_name: 'content_embedding',
      dimensions: 1536,
      metric: 'cosine',
    },
    text_column: 'executive_summary',
    filter_columns: ['company_id', 'opportunity_id', 'channel'],
    index_kind: 'hnsw',
    max_search_limit: 500,
  });

  // Await background HNSW index compilation
  await ctx.waitForOperation(operation);

  // 2. Register multi-vector support for high-level summary/intent embeddings
  await ctx.registerVector('crm_transcripts', 'summary_embedding', 1536, {
    metric: 'cosine',
  });

  console.log('[Polygres] crm_transcripts collection initialized successfully.');
}

/**
 * Perform an entity-anchored semantic search starting from a Company in the 'crm' schema.
 * Polygres natively traverses: crm.companies -> crm.people -> retrieval.interaction_transcripts
 */
export async function searchCompanyContext(companyId: string, queryEmbedding: number[], limit = 5) {
  return await polygres.project().context.graphFirst(
    'crm_transcripts',
    queryEmbedding,
    {
      start: {
        schema_name: 'crm',
        table: 'companies',
        id: companyId,
      },
      max_depth: 2,
      graph_limit: 50,
      limit,
    }
  );
}

/**
 * Tri-lane joint search: Blends Vector + Lexical Full-Text (tsvector) + Graph Topology.
 */
export async function jointSearchOpportunity(
  opportunityId: string,
  lexicalQuery: string,
  queryEmbedding: number[],
  limit = 10
) {
  return await polygres.project().context.joint(
    'crm_transcripts',
    queryEmbedding,
    {
      query: lexicalQuery,
      starts: [{ schema_name: 'crm', table: 'opportunities', id: opportunityId }],
      semanticWeight: 0.5,
      lexicalWeight: 0.3,
      graphWeight: 0.2,
      limit,
    }
  );
}

/**
 * Log a new interaction transcript with atomic pgContext vector & graph reconciliation.
 * Eliminates read-after-write agent consistency gaps.
 */
export async function logCallTranscriptAtomically(data: {
  channel: string;
  companyId: string;
  opportunityId?: string;
  rawTranscript: string;
  summary: string;
  sentimentScore?: number;
  contentEmbedding: number[];
  summaryEmbedding?: number[];
}) {
  return await polygres.project().rows.insert({
    schema: 'retrieval',
    table: 'interaction_transcripts',
    row: {
      channel: data.channel,
      company_id: data.companyId,
      opportunity_id: data.opportunityId ?? null,
      raw_transcript: data.rawTranscript,
      executive_summary: data.summary,
      sentiment_score: data.sentimentScore ?? null,
      content_embedding: JSON.stringify(data.contentEmbedding),
      summary_embedding: data.summaryEmbedding ? JSON.stringify(data.summaryEmbedding) : null,
    },
    reconcileContext: true, // Indexes vector & graph immediately
    waitForContext: true,   // Blocks until verified current
    waitTimeout: 5.0,
  });
}
