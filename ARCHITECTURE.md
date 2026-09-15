# Master System Architecture: Agentic CRM on Polygres

This is the technical blueprint for the CRM boilerplate. It documents what is implemented today: 41 database tables across 5 PostgreSQL schemas, 62 MCP tools, a hybrid Polygres retrieval layer, and a 4-tier Human-in-the-Loop safety gateway.

---

## 1. System Topology

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        AI CLIENTS & AGENT SWARMS                            │
│   Claude Desktop  ·  Cursor / Windsurf  ·  LangGraph / CrewAI  ·  n8n      │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    │  JSON-RPC 2.0 / stdio or HTTP-SSE
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        CRM MCP SERVER  (src/mcp/)                           │
│                                                                             │
│  62 Tools  ·  3 Resources  ·  2 Prompts  ·  Immutable Audit Trail          │
│  Risk-Tiered HITL Gateway: Tier 1 (read) → Tier 4 (HITL-intercepted)       │
└──────────────────┬───────────────────────────┬──────────────────────────────┘
                   │                           │
                   ▼                           ▼
┌──────────────────────────┐   ┌──────────────────────────────────────────────┐
│ POLYGRES HYBRID RETRIEVAL│   │          DRIZZLE ORM  (src/db/)               │
│   (polygres-sdk-ts)      │   │                                              │
│                          │   │  system   users, orgs, api_keys              │
│  graphFirst              │   │  crm      41 tables (see §3)                 │
│  joint (Vec+Lex+Graph)   │   │  mcp      clients, receipts, approvals       │
│  recommend (lookalike)   │   │  retrieval transcripts, knowledge_docs       │
│  rows.insert (atomic)    │   │  ingest   source_connections, outbox         │
└──────────────────┬───────┘   └──────────────────────┬───────────────────────┘
                   │                                   │
                   └───────────────┬───────────────────┘
                                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         POSTGRESQL  (Polygres)                               │
│   HNSW Vector Indexes  ·  tsvector FTS  ·  FK-native Knowledge Graph        │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. The Three Architectural Pillars

### Pillar 1: Relational Foundation
Single-tenant (not workspace-per-schema). Five logical schemas provide clean domain separation:
- `system` — identity (Clerk-synced), organizations, API keys
- `crm` — all CRM objects: standard entities, junction tables, and the full set of CRM primitives
- `mcp` — agent execution layer: clients, audit receipts, approval queue
- `retrieval` — interaction transcripts, knowledge documents (Polygres vectors live here)
- `ingest` — telemetry events, transactional outbox, source connection registry

Complex domain types are flattened into discrete typed columns (Twenty CRM pattern):
- `CURRENCY` → `amountMicros` (`numeric`) + `currency` (`text`)
- `ADDRESS` → `addressStreet1`, `addressCity`, `addressState`, `addressCountry`, `addressLat`, `addressLng`

Runtime extensibility via two mechanisms:
- **Custom Fields:** JSONB `custom_fields` column on every entity, indexed by Polygres `registerJsonbPath`
- **Custom Objects:** `crm.custom_object_definitions` + `crm.custom_object_records` — no migration required to add a new object type

### Pillar 2: Agentic Execution Layer
The MCP server (`src/mcp/`) is the single entrypoint for all AI agent interaction:

```
Tool Call → executeWithReceipt() → mcp.mcp_tool_call_receipts  (audit)
                                 → Risk Tier Check
                                   T1–T3: Execute → return result
                                   T4:    mcp.mcp_approvals (PENDING) → return PENDING_APPROVAL
```

Risk tiers:
| Tier | Category | Gate Behavior |
| :--- | :--- | :--- |
| T1 | Read-only | Execute freely |
| T2 | Additive writes | Execute + audit receipt |
| T3 | Mutative | Execute + audit receipt |
| T4 | Irreversible | Intercepted → human approval queue |

T4 examples: `crm_merge_records`, moving deal to `CLOSED_WON`, deleting records.

### Pillar 3: Polygres Hybrid Retrieval
Retrieval is co-located in PostgreSQL — no external vector DB sync lag.

**`graphFirst` search** — entity-scoped semantic retrieval:
```typescript
await polygres.project().context.graphFirst('crm_transcripts', embedding, {
  start: { schema: 'retrieval', table: 'interaction_transcripts', id: companyId },
  maxDepth: 2,   // company → contacts → transcripts
  limit: 10,
});
```

**`joint` tri-lane search** — simultaneous Vector + Lexical + Graph co-ranking:
```typescript
await polygres.project().context.joint('crm_transcripts', embedding, lexicalQuery, {
  starts: [{ schema: 'crm', table: 'opportunities', id: opportunityId }],
  semanticWeight: 0.5, lexicalWeight: 0.3, graphWeight: 0.2,
  limit: 5,
});
```

**Atomic context reconciliation** — eliminates read-after-write race conditions:
```typescript
await polygres.project().rows.insert({
  schema: 'retrieval', table: 'interaction_transcripts',
  row: { ... },
  reconcileContext: true,   // Immediately indexes vector & graph
  waitForContext: true,     // Blocks until indexing confirmed
  waitTimeout: 5.0,
});
```

---

## 3. Database Schemas

### 3.1 Migration History

| Migration | Name | Key Changes |
| :--- | :--- | :--- |
| `0000` | `shallow_siren` | Initial 5-schema foundation: system, crm, mcp, retrieval, ingest |
| `0001` | `true_talisman` | Custom fields & custom objects; knowledge documents; ingest outbox |
| `0002` | `known_omega_flight` | Teams (Clerk Organizations); polymorphic tags (crm.tags + crm.taggables) |
| `0003` | `concerned_scourge` | Activity Timeline (`crm.timeline_activities`, 2 indexes); text FK alignment |
| `0004` | `dear_nightcrawler` | Saved Views (`crm.views`, JSONB filters/sort, 3 indexes) |
| `0005` | `outgoing_black_knight` | Duplicate Detection (`crm.merge_candidates`, confidence_score) |
| `0006` | `rare_changeling` | Account Hierarchy (`parent_company_id` self-ref FK on crm.companies) |
| `0007` | `crazy_wolverine` | Outbound Sequences (`crm.sequences`, `sequence_steps`, `sequence_enrollments`) |
| `0008` | `neat_arclight` | Lead Routing (`crm.assignment_rules`, strategy + JSONB conditions) |
| `0009` | `peaceful_stick` | CPQ (`crm.products`, `opportunity_line_items`, `quotes`) |
| `0010` | `large_rogue` | Outbound Webhooks (`crm.webhook_subscriptions`, `webhook_deliveries`) |
| `0011` | `nice_the_phantom` | Reporting (`crm.dashboards`, `dashboard_widgets`); Permissions (`crm.field_permissions`, `visibility` on companies+opportunities) |

### 3.2 CRM Schema Table Map

```
crm.companies              id, name, domain_name, industry, ..., parent_company_id, visibility
crm.people                 id, company_id, first_name, last_name, email, ...
crm.opportunities          id, company_id, name, stage, amount_micros, ..., visibility

crm.notes / note_targets
crm.tasks / task_targets
crm.calendar_events / calendar_event_targets

crm.custom_field_definitions
crm.custom_object_definitions
crm.custom_object_records

crm.tags                   id, name, color, category
crm.taggables              tag_id, taggable_type, taggable_id  (polymorphic, no physical FK)

crm.timeline_activities    entity_type, entity_id, activity_type, actor_source, properties

crm.views                  target_entity, view_type (TABLE/KANBAN/CALENDAR), filters, sort_by, group_by_field

crm.merge_candidates       entity_type, primary_record_id, duplicate_record_id, confidence_score, match_reason

crm.sequences              name, is_active
crm.sequence_steps         sequence_id, step_order, delay_days, channel, template, prompt_instructions
crm.sequence_enrollments   sequence_id, person_id, current_step, status, next_step_due_at

crm.assignment_rules       target_entity, conditions JSONB, assignment_strategy, candidate_user_ids, priority

crm.products               name, sku, default_price_micros
crm.opportunity_line_items opportunity_id, product_id, quantity, unit_price_micros, discount_percent, total_price_micros
crm.quotes                 opportunity_id, quote_number, status, total_amount_micros, expires_at

crm.webhook_subscriptions  name, target_url, event_types[], secret
crm.webhook_deliveries     subscription_id, event_type, payload, status, response_status_code

crm.dashboards             name, is_shared
crm.dashboard_widgets      dashboard_id, widget_type, title, config JSONB, position JSONB

crm.field_permissions      entity_type, field_name, role, can_read, can_write
```

### 3.3 Other Schemas

```
system.users               id (Clerk user_id text PK), email, name, role
system.organizations       id (Clerk org_id text PK), name, slug
system.organization_members organization_id, user_id, role
system.api_keys            id, user_id, key_hash, expires_at

mcp.mcp_clients            client_type, api_key_id, allowed_tools
mcp.mcp_tool_call_receipts tool_name, tool_input, tool_output, status, duration_ms
mcp.mcp_approvals          tool_name, action_type, payload, risk_tier, status

retrieval.interaction_transcripts  company_id, opportunity_id, raw_transcript, executive_summary,
                                   content_embedding (vector), sentiment_score
retrieval.knowledge_documents      title, content, embedding, source

ingest.source_connections  provider, config JSONB
ingest.telemetry_events    entity_type, entity_id, event_type, properties
ingest.event_outbox        event_type, entity_id, payload, is_processed
```

---

## 4. Source Code Layout

```
src/
├── db/
│   ├── schema/
│   │   ├── system.ts          users, organizations, api_keys
│   │   ├── crm.ts             all CRM tables (companies → field_permissions)
│   │   ├── mcp.ts             mcp_clients, receipts, approvals
│   │   ├── retrieval.ts       interaction_transcripts, knowledge_documents
│   │   ├── ingest.ts          source_connections, telemetry_events, event_outbox
│   │   └── index.ts           Drizzle relations + barrel re-exports
│   ├── migrations/            0000–0011 SQL files (generated by drizzle-kit)
│   ├── scripts/               test-*.ts E2E scripts against live DB
│   ├── migrate.ts             programmatic drizzle-orm/postgres-js migrator
│   ├── seed.ts                realistic seed data
│   └── index.ts               postgres-js client + db instance
│
├── lib/
│   ├── polygres.ts            Polygres client, graphFirst, joint, logCallTranscriptAtomically
│   ├── clerk.ts               Clerk backend client
│   ├── auth-context.ts        Auth context helpers
│   ├── timeline.ts            logTimelineActivity, getTimelineActivities, formatTimelineActivity
│   ├── views.ts               createView, runView, dynamic query builder (10 operators)
│   ├── duplicates.ts          normalizeDomain, Dice bigram similarity, findDuplicates, mergeRecords
│   ├── hierarchy.ts           getCompanyAncestors, getCompanyDescendants, wouldCreateCycle
│   ├── sequences.ts           createSequence, enrollPersonInSequence, advanceSequenceStep
│   ├── routing.ts             evaluateConditions, selectAssignedUser, routeAndAssignRecord
│   ├── cpq.ts                 addOpportunityLineItem, generateQuote, updateQuoteStatus
│   ├── webhooks.ts            signPayload, dispatchWebhookEvent, listWebhookDeliveries
│   ├── csv.ts                 parseCSV, importCSV, exportCSV
│   ├── reporting.ts           getPipelineFunnelReport, getRepPerformanceReport, getDealVelocityReport
│   └── permissions.ts         canReadRecord, setRecordVisibility, applyFieldMasking
│
├── mcp/
│   ├── server.ts              createCrmMcpServer() — 62 tool registrations + resources + prompts
│   ├── tools.ts               crmToolSchemas (Zod) + crmToolHandlers
│   ├── resources.ts           pipeline/summary, companies/{id}, transcripts/{id}
│   ├── prompts.ts             pre_call_dossier, deal_risk_review
│   └── stdio.ts               stdio transport entry point (pnpm mcp)
│
└── app/
    ├── api/
    │   └── webhooks/clerk/route.ts   Clerk webhook sync (users, orgs, memberships)
    └── middleware.ts                 Clerk auth middleware
```

---

## 5. Key Design Decisions

**Single-tenant, not multi-tenant.** No workspace-per-schema isolation. Designed for one company running their own CRM, or an agency deploying one instance per client. `organization_id` on key tables supports optionally scoping data to a Clerk Organization (for the agency deployment pattern) without a schema change.

**`db:generate` + `db:migrate`, never `db:push`.** Drizzle Kit's `push` command prompts dangerous truncations on live data. All schema changes go through `pnpm db:generate` (produces idempotent SQL) + `pnpm db:migrate` (applies via `drizzle-orm/postgres-js/migrator`).

**Foreign keys are knowledge graph edges.** Polygres infers the graph topology from PostgreSQL foreign key definitions. No separate edge table. Adding a new FK to a Drizzle table definition automatically extends the Polygres graph.

**Polymorphic tags break the typed-junction pattern intentionally.** All other junction tables (`note_targets`, `task_targets`, etc.) use typed FK columns. `crm.taggables` uses a `taggable_type` discriminator + bare UUID instead, because tags must work across dynamically-created custom objects that can't be enumerated at schema-design time. Explicitly not a Polygres graph edge.

**`system.users.id` is a Clerk user ID (`text`), not `uuid`.** Clerk user IDs look like `user_2NNBh3BtqpyEFBR7oM5rQ3p1h7T`. All downstream FK columns (`companies.owner_id`, `opportunities.owner_id`, `tasks.assignee_id`, `mcp_approvals.assigned_to_user_id`) are `text` to match.

**Activity Timeline is append-only and auto-populated.** `crm.timeline_activities` is written by `src/lib/timeline.ts` hooks inside every mutating MCP tool handler — `createCompany`, `updateOpportunityStage`, `tagRecord`, `advanceSequenceStep`, `routeAndAssignRecord`, `mergeRecords`, `addOpportunityLineItem`, `generateQuote`, `setRecordVisibility`, etc. Agents never need to explicitly call `crm_log_timeline_activity` for standard mutations; it's only needed for external events (calls placed manually, emails sent via external client, etc.).

---

## 6. CRM Primitives Implementation Status

All standard CRM primitives identified in `docs/missing-crm-primitives.md` are implemented except Native Email & Calendar Sync (OAuth infra not in scope for a self-hosted boilerplate).

| Primitive | Status | Lib | Key Tables |
| :--- | :---: | :--- | :--- |
| Activity Timeline | ✅ | `timeline.ts` | `crm.timeline_activities` |
| Saved Views | ✅ | `views.ts` | `crm.views` |
| Duplicate Detection & Merge | ✅ | `duplicates.ts` | `crm.merge_candidates` |
| Outbound Sequences | ✅ | `sequences.ts` | `crm.sequences`, `sequence_steps`, `sequence_enrollments` |
| Lead Routing | ✅ | `routing.ts` | `crm.assignment_rules` |
| Account Hierarchy | ✅ | `hierarchy.ts` | `companies.parent_company_id` (self-ref FK) |
| CPQ (Products, Quotes) | ✅ | `cpq.ts` | `crm.products`, `opportunity_line_items`, `quotes` |
| Outbound Webhooks | ✅ | `webhooks.ts` | `crm.webhook_subscriptions`, `webhook_deliveries` |
| Import / Export (CSV) | ✅ | `csv.ts` | — |
| Reporting & Dashboards | ✅ | `reporting.ts` | `crm.dashboards`, `dashboard_widgets` |
| Field/Record Permissions | ✅ | `permissions.ts` | `crm.field_permissions`, `visibility` column |
| Native Email & Calendar Sync | ❌ | — | Blocked: OAuth app registration required |
