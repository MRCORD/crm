# Master System Architecture: Next-Generation Agentic CRM

This document establishes the end-to-end system design and master technical blueprint for this CRM. It synthesizes:
1. **Twenty CRM's Dynamic Relational Metadata Engine:** Dynamic schema-per-workspace PostgreSQL isolation, runtime metadata catalogs, composite column flattening, and typed junction associations.
2. **SOTA Agentic Architecture:** 5-tier agent taxonomy, ambient data capture, "System 2" deliberative reasoning, Anthropic Model Context Protocol (MCP) tool execution, and risk-tiered Human-in-the-Loop (HITL) governance.
3. **Polygres & pgContext Hybrid Retrieval (`polygres-sdk-ts`):** Relational knowledge graph traversal, entity-anchored `graphFirst` search, tri-lane `joint` search (Vector + Full-Text + Graph), and atomic context reconciliation.

---

## 1. System Topology & Architecture

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   EXTERNAL AI CLIENTS & AGENTS                                  │
│   • Claude Desktop / Claude Code            • Cursor / Windsurf IDE                              │
│   • Custom Python Swarms (LangGraph, CrewAI)• Automation Workflows (n8n, Make, Zapier)           │
└────────────────────────────────────────────────┬─────────────────────────────────────────────────┘
                                                 │ JSON-RPC 2.0 via stdio or HTTP/SSE
                                                 ▼
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                 CRM MCP SERVER & SAFETY GATEWAY                                  │
│                                  (`@modelcontextprotocol/sdk`)                                   │
│                                                                                                  │
│  • MCP Tools: crm_search_companies, crm_get_company, crm_update_stage, log_meeting_transcript... │
│  • MCP Resources: crm://pipeline/summary, crm://companies/{id}, crm://transcripts/{id}           │
│  • MCP Prompts: pre_call_dossier, deal_risk_review                                               │
│  • Safety & Governance:                                                                         │
│    - Risk Tier Evaluator (Tier 1-4)                                                              │
│    - Human-in-the-Loop (HITL) Interceptor: mcp.mcp_approvals                                     │
│    - Immutable Audit Ledger: mcp.mcp_tool_call_receipts                                          │
└───────────────────────┬──────────────────────────────────────────────────┬───────────────────────┘
                        │                                                  │
                        ▼                                                  ▼
┌──────────────────────────────────────────────┐   ┌──────────────────────────────────────────────┐
│       POLYGRESS HYBRID RETRIEVAL ENGINE      │   │           DRIZZLE ORM DATABASE LAYER         │
│             (`polygres-sdk-ts`)              │   │            (5 Clean Logical Schemas)         │
│                                              │   │                                              │
│  • graphFirst: Entity-anchored search        │   │  • system: users, api_keys                   │
│  • joint: Vector + Lexical + Graph co-rank   │   │  • crm: companies, people, opportunities...  │
│  • groupedSearch: Balanced context coverage  │   │  • mcp: mcp_clients, receipts, approvals     │
│  • recommend: Math ICP lookalike scoring     │   │  • retrieval: transcripts, knowledge docs    │
│  • Atomic Context Reconciliation on writes   │   │  • ingest: source_connections, outbox        │
└───────────────────────┬──────────────────────┘   └──────────────────────┬───────────────────────┘
                        │                                                 │
                        ▼                                                 ▼
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                      POSTGRESQL STORAGE ENGINE                                   │
│                                                                                                  │
│  • High-performance Relational Foreign Keys serving natively as Polygres Knowledge Graph Edges   │
│  • Co-located pgContext HNSW Vector Indexes & tsvector Full-Text Generated Columns               │
│  • Multi-schema Organization: system, crm, mcp, retrieval, ingest                               │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. The Three Architectural Pillars

### Pillar 1: The Relational Foundation (Twenty CRM Pattern)
* **Schema-per-Workspace:** Strict data isolation in PostgreSQL (`workspace_<base36(uuid)>`), preventing cross-tenant data leaks and allowing non-blocking DDL alterations.
* **Declarative Metadata Engine:** All entities are defined in `core.objectMetadata` and `core.fieldMetadata`. New objects and fields alter the physical schema at runtime without server downtime.
* **Physical Column Decomposition:** Complex domain types are flattened into discrete typed columns rather than opaque JSONB:
  * `CURRENCY` $\rightarrow$ `amountMicros` (`numeric`) + `currencyCode` (`text`).
  * `ADDRESS` $\rightarrow$ `street1`, `city`, `state`, `country`, `lat`, `lng`.
  * `ACTOR` $\rightarrow$ `source`, `workspaceMemberId`, `name`, `context`.
* **Polymorphic Junction Objects:** Cross-entity links use concrete typed junction tables (`noteTarget`, `taskTarget`) with foreign keys and `ON DELETE CASCADE`.

### Pillar 2: The Agentic Execution Layer (SOTA Agentforce & Ambient Pattern)
* **5-Tier Agent Taxonomy:**
  1. *Conversational:* Interactive copilots.
  2. *Proactive:* Event-driven database monitors reacting to CDC/Outbox events.
  3. *Ambient:* Headless listeners capturing audio, video, calendar, and email streams.
  4. *Autonomous:* Goal-oriented digital workers (e.g. AI SDR/BDR).
  5. *Collaborative Swarms:* Orchestrator distributing tasks across specialized sub-agents.
* **Deliberative "System 2" Reasoning:** Multi-pass planning loops evaluating intent, decomposing goals into DAGs, selecting MCP tools, and validating against business policies.
* **Risk-Tiered Human-in-the-Loop (HITL):** High-risk actions (sending cold outreach, modifying contracts, deleting records) pause execution, serialize state, and await human approval.

### Pillar 3: Grounding & Retrieval (Polygres & pgContext Pattern)
* **PostgreSQL-Native:** No external vector DB synchronization lag; vector indexes and graph edges reside natively in PostgreSQL.
* **`graphFirst` Search:** Scopes semantic vector search strictly within a starting entity's graph neighborhood (e.g. Account $\rightarrow$ Contacts $\rightarrow$ Transcripts), eliminating cross-account semantic pollution.
* **`joint` Tri-Lane Search:** Simultaneously co-ranks dense semantic vectors, exact lexical matches (`tsvector`), and graph proximity.
* **Atomic Context Reconciliation:** Ensures row writes (`rows.insert({ reconcileContext: true, waitForContext: true })`) are immediately indexed for downstream agent retrieval, eliminating read-after-write race conditions.

---

## 3. Core Database Schemas

### 3.1. System & Metadata Schema (`core`)

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- Workspaces & Tenants
CREATE TABLE core.workspace (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    database_schema VARCHAR(64) UNIQUE NOT NULL, -- e.g. 'workspace_1a2b3c'
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Metadata Catalog: Objects (Tables)
CREATE TABLE core.object_metadata (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES core.workspace(id) ON DELETE CASCADE,
    name_singular VARCHAR(64) NOT NULL,
    name_plural VARCHAR(64) NOT NULL,
    label_singular VARCHAR(64) NOT NULL,
    label_plural VARCHAR(64) NOT NULL,
    target_table_name VARCHAR(64) NOT NULL, -- 'company' or '_customDeal'
    is_custom BOOLEAN DEFAULT FALSE,
    is_system BOOLEAN DEFAULT FALSE,
    readability VARCHAR(32) DEFAULT 'OPEN', -- 'OPEN', 'INHERITED', 'PRIVATE', 'SYSTEM'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (workspace_id, name_singular)
);

-- Metadata Catalog: Fields (Columns)
CREATE TABLE core.field_metadata (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES core.workspace(id) ON DELETE CASCADE,
    object_metadata_id UUID NOT NULL REFERENCES core.object_metadata(id) ON DELETE CASCADE,
    name VARCHAR(64) NOT NULL,
    label VARCHAR(64) NOT NULL,
    type VARCHAR(32) NOT NULL, -- 'TEXT', 'NUMERIC', 'CURRENCY', 'ACTOR', etc.
    is_nullable BOOLEAN DEFAULT TRUE,
    default_value JSONB,
    settings JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (object_metadata_id, name)
);

-- Agent Definitions
CREATE TABLE core.agent_definition (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES core.workspace(id) ON DELETE CASCADE,
    name VARCHAR(64) NOT NULL,
    role VARCHAR(64) NOT NULL, -- 'BDR', 'DEAL_ANALYST', 'DATA_HYGIENE'
    system_prompt TEXT NOT NULL,
    allowed_tools TEXT[] NOT NULL DEFAULT '{}',
    model_name VARCHAR(64) DEFAULT 'claude-3-5-sonnet-20241022',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Durable Agent Runs
CREATE TABLE core.agent_run (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES core.workspace(id) ON DELETE CASCADE,
    agent_id UUID NOT NULL REFERENCES core.agent_definition(id) ON DELETE CASCADE,
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'RUNNING', 'WAITING_FOR_APPROVAL', 'COMPLETED', 'FAILED'
    goal_description TEXT NOT NULL,
    working_memory JSONB DEFAULT '{}'::jsonb,
    execution_plan JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- Agent Action Receipts (Audit Log)
CREATE TABLE core.agent_action_receipt (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_run_id UUID NOT NULL REFERENCES core.agent_run(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES core.workspace(id) ON DELETE CASCADE,
    tool_name VARCHAR(64) NOT NULL,
    tool_input JSONB NOT NULL,
    tool_output JSONB,
    reasoning_trace TEXT,
    status VARCHAR(32) NOT NULL, -- 'SUCCESS', 'FAILED', 'ROLLED_BACK'
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Human-In-The-Loop Approval Requests
CREATE TABLE core.agent_approval_request (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_run_id UUID NOT NULL REFERENCES core.agent_run(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES core.workspace(id) ON DELETE CASCADE,
    action_type VARCHAR(64) NOT NULL,
    action_payload JSONB NOT NULL,
    risk_tier INT NOT NULL CHECK (risk_tier IN (3, 4)),
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'APPROVED', 'REJECTED'
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Transactional Event Outbox
CREATE TABLE core.event_outbox (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES core.workspace(id) ON DELETE CASCADE,
    event_type VARCHAR(64) NOT NULL,
    entity_name VARCHAR(64) NOT NULL,
    entity_id UUID NOT NULL,
    payload JSONB NOT NULL,
    is_processed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 3.2. Tenant Schema Structure (`workspace_<id>`)

```sql
-- Standard Entities Example: Company
CREATE TABLE workspace_1a2b3c.company (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    position FLOAT8 DEFAULT 0,
    search_vector TSVECTOR GENERATED ALWAYS AS (to_tsvector('english', coalesce(name, '') || ' ' || coalesce(domain_name, ''))) STORED,
    
    -- Business Fields
    name TEXT NOT NULL,
    domain_name TEXT,
    
    -- Composite Field: annualRevenue (CURRENCY)
    annual_revenue_amount_micros NUMERIC,
    annual_revenue_currency_code TEXT,
    
    -- Composite Field: address (ADDRESS)
    address_street1 TEXT,
    address_city TEXT,
    address_state TEXT,
    address_country TEXT,
    address_lat NUMERIC,
    address_lng NUMERIC,
    
    -- Composite Field: createdBy (ACTOR)
    created_by_source TEXT,
    created_by_workspace_member_id UUID,
    created_by_name TEXT,
    created_by_context JSONB
);

-- Polymorphic Junction Example: Note Targets
CREATE TABLE workspace_1a2b3c.note_target (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    note_id UUID NOT NULL REFERENCES workspace_1a2b3c.note(id) ON DELETE CASCADE,
    target_company_id UUID REFERENCES workspace_1a2b3c.company(id) ON DELETE CASCADE,
    target_person_id UUID REFERENCES workspace_1a2b3c.person(id) ON DELETE CASCADE,
    target_opportunity_id UUID REFERENCES workspace_1a2b3c.opportunity(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 4. Polygres Integration: Retrieval & Grounding Flows

### 4.1. Entity-Scoped Search via `graphFirst`
When an agent is asked to analyze communications regarding a specific Account, it invokes `graphFirst` through `polygres-sdk-ts`:

```typescript
import { Polygres } from 'polygres-sdk-ts';

const client = new Polygres({
  apiKey: process.env.POLYGRES_API_KEY!,
  runtimeUrl: process.env.POLYGRES_RUNTIME_URL!,
});

// Ground query within Acme Corp's relational neighborhood
export async function getCompanyInsights(companyId: string, questionEmbedding: number[]) {
  return await client.project().context.graphFirst(
    'interaction_transcripts',
    questionEmbedding,
    {
      start: { schema: 'workspace_1a2b3c', table: 'company', id: companyId },
      maxDepth: 2, // company -> contacts -> transcripts
      graphLimit: 50,
      limit: 10,
    }
  );
}
```

### 4.2. Atomic Ingestion with Context Reconciliation
When ambient bots capture a call or incoming email, mutations must be indexed synchronously to prevent read-after-write agent hallucinations:

```typescript
export async function logCallTranscript(schema: string, transcriptData: any) {
  return await client.project().rows.insert({
    schema,
    table: 'interaction_transcript',
    row: {
      id: crypto.randomUUID(),
      channel: 'ZOOM',
      transcript_text: transcriptData.text,
      summary: transcriptData.summary,
      associated_company_id: transcriptData.companyId,
    },
    reconcileContext: true, // Triggers immediate pgContext indexing
    waitForContext: true,   // Awaits index readiness
    waitTimeout: 5.0,
  });
}
```

---

## 5. Implementation Roadmap for This CRM

| Phase | Core Objective | Key Deliverables |
| :--- | :--- | :--- |
| **Phase 1: Foundation** | Database & Metadata Layer | Initialize PostgreSQL schemas (`core` + tenant schema factory); implement `object_metadata` and `field_metadata` catalogs; build physical composite type flattener. |
| **Phase 2: Polygres Integration** | Hybrid Search & Grounding | Connect `polygres-sdk-ts`; configure pgContext collections for interaction transcripts and company knowledge; implement `graphFirst` and `joint` search services. |
| **Phase 3: Ambient Ingestion** | Zero-Entry Communication Pipelines | Implement email & calendar webhook ingesters; build audio/transcript ingestion pipeline with atomic context reconciliation. |
| **Phase 4: Agentic Core** | Orchestration & Tool Execution | Set up deliberative reasoning engine (LangGraph / state machine); implement MCP tool endpoints (`crm_find`, `crm_update`, `crm_recommend`); build 4-tier HITL approval queue. |
| **Phase 5: User Interface** | Reactive Front-End | Build Next.js interface with real-time pipeline views, interactive record pages, and the Human Approval Inbox. |

---

## 6. Directory Structure Blueprint

```
crm/
├── docs/
│   ├── twentycrm-database-architecture.md   # Twenty CRM deep-dive
│   ├── sota-and-agentic-crms.md             # SOTA CRM research & taxonomy
│   ├── polygres-agentic-crm-integration.md  # Polygres & pgContext integration guide
│   └── ARCHITECTURE.md                      # (This master architecture document)
│
├── packages/
│   ├── db/                                  # PostgreSQL migrations & TwentyORM core
│   │   ├── migrations/                      # Core schema DDL
│   │   ├── metadata/                        # Object & Field metadata catalogs
│   │   └── schema-manager/                  # Dynamic tenant schema generator
│   │
│   ├── polygres-client/                     # Polygres wrapper & pgContext search services
│   │   ├── collections/                     # Transcript, email & knowledge collections
│   │   └── retrieval/                       # graphFirst, joint, and recommend helpers
│   │
│   ├── agents/                              # Agentic reasoning & MCP tools
│   │   ├── orchestrator/                    # LangGraph / state machine planner
│   │   ├── tools/                           # MCP tools (CRM CRUD, Web search, Invoicing)
│   │   ├── guardrails/                      # Risk tiering & HITL approval triggers
│   │   └── receipts/                        # Action audit trail loggers
│   │
│   └── api/                                 # Next.js / NestJS API Gateway
│       ├── rest/                            # Dynamic /rest/:object routes
│       └── graphql/                         # In-memory GraphQL compiler
│
├── README.md                                # Root repository guide
└── ARCHITECTURE.md                          # Symlink / mirror of master system architecture
```
