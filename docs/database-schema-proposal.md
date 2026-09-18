# Production Database Schema Proposal: Modular Multi-Schema Boilerplate

This proposal presents the database schema architecture for this CRM project. Instead of an unorganized single-table dump in `public` or complex multi-tenant SaaS schema generation (`workspace_<id>`), this architecture employs **5 distinct logical PostgreSQL schemas inside a single database**:

```
PostgreSQL Database
│
├── system (Identity, Authentication & Permissions)
│   ├── users (Sales reps, managers, system users)
│   └── api_keys (Scoped system and developer keys)
│
├── crm (Core Business Domain & Relational Graph)
│   ├── companies (Accounts with flattened composite columns)
│   ├── people (Contacts & Leads with phone/email arrays)
│   ├── opportunities (Deals, pipeline stages, health scores)
│   ├── notes, tasks (Activity records)
│   └── note_targets, task_targets, calendar_event_targets (Polymorphic Junctions)
│
├── ai (Agentic Runtime, Reasoning & HITL Governance)
│   ├── agent_definitions (Personas, system prompts, tool whitelists)
│   ├── agent_runs (Durable execution state machine & working memory)
│   ├── agent_receipts (Immutable audit ledger with reasoning traces)
│   └── agent_approvals (Risk-tiered Human-in-the-Loop approval requests)
│
├── retrieval (Polygres pgContext & Semantic Grounding)
│   ├── interaction_transcripts (Multi-vector HNSW embeddings, summaries, sentiment)
│   └── knowledge_documents (Battlecards, pricing rules, FAQ embeddings)
│
└── ingest (Ambient Telemetry & Change Data Capture)
    ├── source_connections (PostHog, Stripe, Google Workspace auth)
    ├── telemetry_events (In-app usage, PQL signals, feature milestones)
    └── event_outbox (Transactional CDC Outbox triggering agent loops)
```

---

## 1. Why 5 Dedicated Schemas Inside One Database?

1. **Domain-Driven Modularity:** Tables are grouped by responsibility. Developers can inspect `crm`, `ai`, `retrieval`, `ingest`, and `system` cleanly in TablePlus, DBeaver, or psql.
2. **Native Drizzle ORM Support:** Drizzle provides first-class support for PostgreSQL schemas via `pgSchema()` (`schemaFilter: ['system', 'crm', 'ai', 'retrieval', 'ingest']`).
3. **Polygres Cross-Schema Graph Traversal:** Standard PostgreSQL foreign keys across schemas (e.g. `retrieval.interaction_transcripts.company_id REFERENCES crm.companies(id)`) are natively discovered and indexed by Polygres (`polygres --json graph discover`).
4. **Isolated Access Control:** Granular PostgreSQL `GRANT` privileges can restrict microservices or read-replicas to specific schemas (e.g. `GRANT USAGE ON SCHEMA retrieval TO agent_worker`).

---

## 2. Complete SQL DDL Specification

```sql
-- Required Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";

-- 1. Create Logical Schemas
CREATE SCHEMA IF NOT EXISTS system;
CREATE SCHEMA IF NOT EXISTS crm;
CREATE SCHEMA IF NOT EXISTS ai;
CREATE SCHEMA IF NOT EXISTS retrieval;
CREATE SCHEMA IF NOT EXISTS ingest;

-- ============================================================================
-- SCHEMA: system (Identity & Auth)
-- ============================================================================

CREATE TABLE system.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'MEMBER', -- 'ADMIN', 'MEMBER', 'GUEST'
    avatar_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE system.api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES system.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    key_hash TEXT NOT NULL,
    expires_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- SCHEMA: crm (Business Domain Entities)
-- ============================================================================

-- Companies (Accounts)
CREATE TABLE crm.companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    domain_name TEXT,
    industry TEXT,
    employees_count INT,
    linkedin_url TEXT,
    
    -- Flattened Composite: annualRevenue (CURRENCY)
    annual_revenue_amount_micros NUMERIC,
    annual_revenue_currency TEXT DEFAULT 'USD',
    
    -- Flattened Composite: address (ADDRESS)
    address_street1 TEXT,
    address_city TEXT,
    address_state TEXT,
    address_postcode TEXT,
    address_country TEXT,
    address_lat NUMERIC(10, 7),
    address_lng NUMERIC(10, 7),
    
    search_vector TSVECTOR GENERATED ALWAYS AS (
        to_tsvector('english', coalesce(name, '') || ' ' || coalesce(domain_name, '') || ' ' || coalesce(industry, ''))
    ) STORED,
    
    position DOUBLE PRECISION DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_companies_search_vector ON crm.companies USING GIN(search_vector);
CREATE INDEX idx_companies_domain ON crm.companies(domain_name) WHERE deleted_at IS NULL;

-- People (Contacts / Leads)
CREATE TABLE crm.people (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES crm.companies(id) ON DELETE SET NULL, -- Polygres Graph Edge 1
    
    first_name TEXT,
    last_name TEXT,
    job_title TEXT,
    email TEXT NOT NULL,
    phone TEXT,
    linkedin_url TEXT,
    avatar_url TEXT,
    
    search_vector TSVECTOR GENERATED ALWAYS AS (
        to_tsvector('english', coalesce(first_name, '') || ' ' || coalesce(last_name, '') || ' ' || coalesce(job_title, ''))
    ) STORED,
    
    position DOUBLE PRECISION DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_people_company ON crm.people(company_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_people_email ON crm.people(email) WHERE deleted_at IS NULL;

-- Opportunities (Deals / Pipeline)
CREATE TABLE crm.opportunities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES crm.companies(id) ON DELETE CASCADE,     -- Polygres Graph Edge 2
    point_of_contact_id UUID REFERENCES crm.people(id) ON DELETE SET NULL,     -- Polygres Graph Edge 3
    
    name TEXT NOT NULL,
    stage TEXT NOT NULL DEFAULT 'DISCOVERY', -- 'DISCOVERY', 'PROPOSAL', 'NEGOTIATION', 'CLOSED_WON', 'CLOSED_LOST'
    amount_micros NUMERIC NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'USD',
    close_date TIMESTAMPTZ,
    probability_percent INT DEFAULT 20,
    
    health_score NUMERIC(3,2), -- AI-computed score (-1.00 to +1.00)
    loss_reason TEXT,
    
    position DOUBLE PRECISION DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_opportunities_company ON crm.opportunities(company_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_opportunities_stage ON crm.opportunities(stage) WHERE deleted_at IS NULL;

-- Notes & Tasks
CREATE TABLE crm.notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT,
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE crm.tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assignee_id UUID REFERENCES system.users(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    body TEXT,
    due_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'TODO', -- 'TODO', 'IN_PROGRESS', 'DONE', 'CANCELLED'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Typed Polymorphic Junctions (Cascade-Safe Relational Graph Edges)
CREATE TABLE crm.note_targets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    note_id UUID NOT NULL REFERENCES crm.notes(id) ON DELETE CASCADE,
    company_id UUID REFERENCES crm.companies(id) ON DELETE CASCADE,
    person_id UUID REFERENCES crm.people(id) ON DELETE CASCADE,
    opportunity_id UUID REFERENCES crm.opportunities(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE crm.task_targets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES crm.tasks(id) ON DELETE CASCADE,
    company_id UUID REFERENCES crm.companies(id) ON DELETE CASCADE,
    person_id UUID REFERENCES crm.people(id) ON DELETE CASCADE,
    opportunity_id UUID REFERENCES crm.opportunities(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE crm.calendar_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    starts_at TIMESTAMPTZ NOT NULL,
    ends_at TIMESTAMPTZ NOT NULL,
    meeting_url TEXT,
    external_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE crm.calendar_event_targets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    calendar_event_id UUID NOT NULL REFERENCES crm.calendar_events(id) ON DELETE CASCADE,
    company_id UUID REFERENCES crm.companies(id) ON DELETE CASCADE,
    person_id UUID REFERENCES crm.people(id) ON DELETE CASCADE,
    opportunity_id UUID REFERENCES crm.opportunities(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- SCHEMA: ai (Agentic Runtime & Governance)
-- ============================================================================

CREATE TABLE ai.agent_definitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL, -- e.g. 'Alice (Outbound SDR)', 'Deal Copilot'
    role TEXT NOT NULL, -- 'SDR', 'ANALYST', 'CHURN_PREDICTOR', 'DATA_STEWARD'
    system_prompt TEXT NOT NULL,
    model_name TEXT NOT NULL DEFAULT 'claude-3-5-sonnet-20241022',
    temperature NUMERIC(3,2) DEFAULT 0.20,
    allowed_tools TEXT[] NOT NULL DEFAULT '{}', -- Tool whitelists
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE ai.agent_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL REFERENCES ai.agent_definitions(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'PLANNING', 'RUNNING', 'WAITING_FOR_APPROVAL', 'COMPLETED', 'FAILED'
    trigger_source TEXT NOT NULL, -- 'WEBHOOK', 'CDC_OUTBOX', 'USER_GOAL', 'CRON', 'POSTHOG_EVENT'
    goal_description TEXT NOT NULL,
    execution_plan JSONB,
    working_memory JSONB NOT NULL DEFAULT '{}'::jsonb,
    error_details JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX idx_agent_runs_status ON ai.agent_runs(status);

CREATE TABLE ai.agent_receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID NOT NULL REFERENCES ai.agent_runs(id) ON DELETE CASCADE,
    tool_name TEXT NOT NULL,
    tool_input JSONB NOT NULL,
    tool_output JSONB,
    target_object TEXT, -- 'companies', 'opportunities'
    target_record_id UUID,
    reasoning_trace TEXT,
    duration_ms INT,
    status TEXT NOT NULL, -- 'SUCCESS', 'FAILED', 'ROLLED_BACK'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_agent_receipts_run ON ai.agent_receipts(run_id);

CREATE TABLE ai.agent_approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID NOT NULL REFERENCES ai.agent_runs(id) ON DELETE CASCADE,
    action_type TEXT NOT NULL, -- 'SEND_OUTBOUND_EMAIL', 'DISCOUNT_APPROVAL', 'DELETE_RECORD'
    action_payload JSONB NOT NULL,
    proposed_content TEXT,
    risk_tier INT NOT NULL CHECK (risk_tier IN (3, 4)),
    status TEXT NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'APPROVED', 'REJECTED', 'MODIFIED'
    assigned_to_user_id UUID REFERENCES system.users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    review_comments TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_agent_approvals_pending ON ai.agent_approvals(status) WHERE status = 'PENDING';

-- ============================================================================
-- SCHEMA: retrieval (Polygres pgContext Layer)
-- ============================================================================

CREATE TABLE retrieval.interaction_transcripts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel TEXT NOT NULL, -- 'ZOOM', 'MEET', 'PHONE_CALL', 'EMAIL', 'WHATSAPP'
    external_call_id TEXT,
    
    -- Cross-Schema Foreign Keys (Polygres Graph Edges)
    company_id UUID REFERENCES crm.companies(id) ON DELETE CASCADE,
    person_id UUID REFERENCES crm.people(id) ON DELETE SET NULL,
    opportunity_id UUID REFERENCES crm.opportunities(id) ON DELETE SET NULL,
    
    raw_transcript TEXT NOT NULL,
    executive_summary TEXT,
    action_items JSONB NOT NULL DEFAULT '[]'::jsonb,
    objections_raised JSONB NOT NULL DEFAULT '[]'::jsonb,
    competitors_mentioned TEXT[] NOT NULL DEFAULT '{}',
    sentiment_score NUMERIC(3,2), -- -1.00 to +1.00
    
    -- Vectors (Managed by Polygres pgContext)
    content_embedding vector(1536),
    summary_embedding vector(1536),
    
    search_vector TSVECTOR GENERATED ALWAYS AS (
        to_tsvector('english', coalesce(executive_summary, '') || ' ' || coalesce(raw_transcript, ''))
    ) STORED,
    
    happened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- HNSW Vector Indexes
CREATE INDEX idx_transcripts_content_embedding ON retrieval.interaction_transcripts 
USING hnsw (content_embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);

CREATE INDEX idx_transcripts_summary_embedding ON retrieval.interaction_transcripts 
USING hnsw (summary_embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);

CREATE INDEX idx_transcripts_search_vector ON retrieval.interaction_transcripts USING GIN(search_vector);
CREATE INDEX idx_transcripts_company ON retrieval.interaction_transcripts(company_id);
CREATE INDEX idx_transcripts_opportunity ON retrieval.interaction_transcripts(opportunity_id);

CREATE TABLE retrieval.knowledge_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    category TEXT NOT NULL, -- 'BATTLECARD', 'PRICING_RULE', 'TECHNICAL_SPEC'
    content TEXT NOT NULL,
    embedding vector(1536),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_knowledge_embedding ON retrieval.knowledge_documents 
USING hnsw (embedding vector_cosine_ops);

-- ============================================================================
-- SCHEMA: ingest (Telemetry, PostHog & Outbox)
-- ============================================================================

CREATE TABLE ingest.source_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider TEXT NOT NULL, -- 'POSTHOG', 'STRIPE', 'GOOGLE_WORKSPACE'
    auth_credentials JSONB NOT NULL,
    sync_status TEXT NOT NULL DEFAULT 'ACTIVE',
    last_synced_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE ingest.telemetry_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_connection_id UUID REFERENCES ingest.source_connections(id) ON DELETE CASCADE,
    event_name TEXT NOT NULL, -- 'feature_flag_called', 'trial_expired', 'quota_exceeded'
    
    associated_company_id UUID REFERENCES crm.companies(id) ON DELETE SET NULL,
    associated_person_id UUID REFERENCES crm.people(id) ON DELETE SET NULL,
    
    properties JSONB NOT NULL DEFAULT '{}'::jsonb,
    timestamp TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_telemetry_company ON ingest.telemetry_events(associated_company_id, timestamp DESC);

CREATE TABLE ingest.event_outbox (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type TEXT NOT NULL, -- 'RECORD_CREATED', 'RECORD_UPDATED', 'RECORD_DELETED'
    entity_name TEXT NOT NULL, -- 'companies', 'opportunities', 'interaction_transcripts'
    entity_id UUID NOT NULL,
    payload JSONB NOT NULL,
    is_processed BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_event_outbox_unprocessed ON ingest.event_outbox(created_at) WHERE is_processed = FALSE;
```

---

## 3. Polygres Integration Walkthrough (`src/lib/polygres.ts`)

With this schema layout, Polygres initializes cleanly over `retrieval.interaction_transcripts` and performs cross-schema graph traversals directly:

```typescript
import { Polygres } from 'polygres-sdk-ts';

export const polygres = new Polygres({
  apiKey: process.env.POLYGRES_API_KEY!,
  runtimeUrl: process.env.POLYGRES_RUNTIME_URL!,
});

// 1. One-time collection creation targeting 'retrieval' schema
export async function initPolygres() {
  const ctx = polygres.project().context;

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
  });

  await ctx.waitForOperation(operation);
}

// 2. Cross-Schema graphFirst Search:
// Starts at 'crm.companies', traverses foreign keys into 'retrieval.interaction_transcripts'
export async function getCompanyInsights(companyId: string, queryEmbedding: number[]) {
  return await polygres.project().context.graphFirst(
    'crm_transcripts',
    queryEmbedding,
    {
      start: { schema_name: 'crm', table: 'companies', id: companyId },
      max_depth: 2,
      graph_limit: 50,
      limit: 5,
    }
  );
}

// 3. Atomic Row Insertion with Context Reconciliation
export async function logCallTranscript(data: any) {
  return await polygres.project().rows.insert({
    schema: 'retrieval',
    table: 'interaction_transcripts',
    row: data,
    reconcileContext: true, // Indexes vector & graph synchronously
    waitForContext: true,
    waitTimeout: 5.0,
  });
}
```

---

## 4. Summary of Benefits for the Boilerplate

1. **No SaaS Isolation Overhead:** No complex runtime DDL generators or dynamic schema tenant routing.
2. **Modular Architecture:** Complete separation of concerns between business CRM entities, agent governance, retrieval memory, telemetry, and system identity.
3. **Pure Type-Safety:** Fully supported by Drizzle ORM (`drizzle-kit generate` & `drizzle-kit push`).
4. **Native Knowledge Graph:** Relational foreign keys between `crm` and `retrieval` tables act directly as Polygres graph edges without any manual edge tables.
