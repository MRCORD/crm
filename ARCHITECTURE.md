# Master System Architecture: Agentic CRM on Polygres

This is the technical blueprint for the CRM boilerplate. It documents what is implemented today: 42+ database tables across 5 PostgreSQL schemas, 66 MCP tools, a hybrid Polygres retrieval layer, a full 16-route Next.js 16 Web Application, and a 4-tier Human-in-the-Loop safety gateway.

---

## 1. System Topology

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          CLIENTS & OPERATIONAL SURFACES                     │
│    Claude Desktop  ·  Cursor  ·  LangGraph  ·  Next.js 16 Web Application   │
└───────────────────────┬───────────────────────────────┬─────────────────────┘
                        │ JSON-RPC 2.0 / stdio          │ Server Actions
                        ▼                               ▼
┌──────────────────────────────────────────────┐  ┌──────────────────────────┐
│          CRM MCP SERVER  (src/mcp/)          │  │  ACTIONS (src/actions/)  │
│                                              │  │                          │
│  66 Tools  ·  3 Resources  ·  2 Prompts      │  │  Direct Drizzle + Lib    │
│  Immutable Audit Trail  ·  Tier 4 Approvals  │  │  force-dynamic rendering │
└───────────────────────┬──────────────────────┘  └─────────────┬────────────┘
                        │                                       │
                        └───────────────────┬───────────────────┘
                                            ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           DOMAIN LOGIC LAYER  (src/lib/)                    │
│                                                                             │
│  timeline  ·  views  ·  duplicates  ·  hierarchy  ·  sequences  ·  routing  │
│  cpq  ·  webhooks  ·  csv  ·  reporting  ·  permissions  ·  brands         │
└───────────────────────┬───────────────────────────────┬─────────────────────┘
                        │                               │
                        ▼                               ▼
┌──────────────────────────────────────┐  ┌──────────────────────────────────┐
│      POLYGRES HYBRID RETRIEVAL       │  │        DRIZZLE ORM  (src/db/)    │
│          (polygres-sdk-ts)           │  │                                  │
│  graphFirst (entity-scoped search)   │  │  system   users, orgs, api_keys  │
│  joint (Vector + Lexical + Graph)    │  │  crm      42+ tables (see §3)    │
│  recommend (lookalike scoring)       │  │  mcp      clients, receipts, app │
│  rows.insert (atomic reconciliation) │  │  retrieval transcripts, docs     │
│                                      │  │  ingest   connections, outbox    │
└───────────────────────┬──────────────┘  └─────────────┬────────────────────┘
                        │                               │
                        └───────────────┬───────────────┘
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           POSTGRESQL  (Polygres)                            │
│    HNSW Vector Indexes  ·  tsvector FTS  ·  FK-native Knowledge Graph       │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Architectural Pillars

### Pillar 1: Relational Foundation
Single-tenant (not workspace-per-schema). Five logical schemas provide clean domain separation:
- `system` — identity (Clerk-synced), organizations, API keys
- `crm` — all standard entities (companies, people, opportunities), junction tables, and the full set of CRM primitives (CPQ, sequences, routing, webhooks, brands)
- `mcp` — agent execution layer: clients, audit receipts ledger, approval queue
- `retrieval` — interaction transcripts, knowledge documents (Polygres vector indexes live here)
- `ingest` — telemetry events, transactional outbox, source connection registry

Complex domain types are flattened into discrete typed columns (Twenty CRM pattern):
- `CURRENCY` → `amountMicros` (`numeric`) + `currency` (`text`)
- `ADDRESS` → `addressStreet1`, `addressCity`, `addressState`, `addressCountry`, `addressLat`, `addressLng`

Runtime extensibility via two mechanisms:
- **Custom Fields:** JSONB `custom_fields` column on every entity, indexed by Polygres `registerJsonbPath`
- **Custom Objects:** `crm.custom_object_definitions` + `crm.custom_object_records` — no migration required to define a new object type at runtime

### Pillar 2: Agentic Execution Layer
The MCP server (`src/mcp/`) provides 66 registered tools for AI agent interaction:

```
Tool Call → executeWithReceipt() → mcp.mcp_tool_call_receipts  (audit)
                                 → Risk Tier Check
                                   T1–T3: Execute → return result
                                   T4:    mcp.mcp_approvals (PENDING) → return PENDING_APPROVAL
```

Risk tiers:
| Tier | Category | Gate Behavior |
| :--- | :--- | :--- |
| **T1** | Read-only | Execute freely |
| **T2** | Additive writes | Execute + audit receipt |
| **T3** | Mutative | Execute + audit receipt |
| **T4** | Irreversible | Intercepted → human approval queue (`mcp.mcp_approvals`) |

T4 examples: `crm_merge_records`, moving a deal to `CLOSED_WON` or `CLOSED_LOST`, record deletion.

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

### Pillar 4: Modern Web UI & Server Actions
Built with Next.js 16 App Router, React 19, and Tailwind CSS v4:
- **Server Actions (`src/actions/crm.ts`)**: Invokes domain functions (`src/lib/*.ts`) directly without network overhead.
- **Dynamic Data**: Pages configured with `force-dynamic` to guarantee real-time CRM updates.
- **Deep-linkable Record Routes**: Follows Twenty CRM's full-page route convention (`/companies/[id]`, `/opportunities/[id]`).

---

## 3. Database Schemas

### 3.1 Migration History

| Migration | Name | Key Changes |
| :--- | :--- | :--- |
| `0000` | `shallow_siren` | Initial 5-schema foundation: system, crm, mcp, retrieval, ingest |
| `0001` | `true_talisman` | Custom fields & custom objects; knowledge documents; ingest outbox |
| `0002` | `known_omega_flight` | Teams (Clerk Organizations); polymorphic tags (`crm.tags` + `crm.taggables`) |
| `0003` | `concerned_scourge` | Activity Timeline (`crm.timeline_activities`, 2 indexes); text FK alignment |
| `0004` | `dear_nightcrawler` | Saved Views (`crm.views`, JSONB filters/sort, 3 indexes) |
| `0005` | `outgoing_black_knight` | Duplicate Detection (`crm.merge_candidates`, `confidence_score`) |
| `0006` | `rare_changeling` | Account Hierarchy (`parent_company_id` self-ref FK on `crm.companies`) |
| `0007` | `crazy_wolverine` | Outbound Sequences (`crm.sequences`, `sequence_steps`, `sequence_enrollments`) |
| `0008` | `neat_arclight` | Lead Routing (`crm.assignment_rules`, strategy + JSONB conditions) |
| `0009` | `peaceful_stick` | CPQ (`crm.products`, `opportunity_line_items`, `quotes`) |
| `0010` | `large_rogue` | Outbound Webhooks (`crm.webhook_subscriptions`, `webhook_deliveries`) |
| `0011` | `nice_the_phantom` | Reporting (`crm.dashboards`, `dashboard_widgets`); Permissions (`crm.field_permissions`) |
| `0012` | `fresh_stepford_cuckoos` | Multi-Brand Modeling (`crm.brands`, `brand_id` FK on opportunities, products, sequences, views) |

### 3.2 CRM Schema Table Map

```
crm.companies              id, name, domain_name, industry, ..., parent_company_id, visibility
crm.people                 id, company_id, first_name, last_name, email, ...
crm.opportunities          id, company_id, brand_id, name, stage, amount_micros, ..., visibility

crm.notes / note_targets
crm.tasks / task_targets
crm.calendar_events / calendar_event_targets

crm.custom_field_definitions
crm.custom_object_definitions
crm.custom_object_records

crm.tags                   id, name, color, category
crm.taggables              tag_id, taggable_type, taggable_id  (polymorphic, no physical FK)

crm.timeline_activities    entity_type, entity_id, activity_type, actor_source, properties

crm.views                  target_entity, brand_id, view_type (TABLE/KANBAN/CALENDAR), filters, sort_by
crm.merge_candidates       entity_type, primary_record_id, duplicate_record_id, confidence_score, match_reason

crm.sequences              name, brand_id, is_active
crm.sequence_steps         sequence_id, step_order, delay_days, channel, template, prompt_instructions
crm.sequence_enrollments   sequence_id, person_id, current_step, status, next_step_due_at

crm.assignment_rules       target_entity, conditions JSONB, assignment_strategy, candidate_user_ids, priority

crm.brands                 id, name, slug, description, website, color, is_active
crm.products               name, brand_id, sku, default_price_micros
crm.opportunity_line_items opportunity_id, product_id, quantity, unit_price_micros, discount_percent, total_price_micros
crm.quotes                 opportunity_id, quote_number, status, total_amount_micros, expires_at

crm.webhook_subscriptions  name, target_url, event_types[], secret
crm.webhook_deliveries     subscription_id, event_type, payload, status, response_status_code

crm.dashboards             name, is_shared
crm.dashboard_widgets      dashboard_id, widget_type, title, config JSONB, position JSONB

crm.field_permissions      entity_type, field_name, role, can_read, can_write
```

---

## 4. Source Code Layout

```
src/
├── actions/
│   └── crm.ts                 Next.js Server Actions calling domain logic directly
│
├── app/
│   ├── (dashboard)/
│   │   ├── layout.tsx         AppSidebar + SiteHeader shell
│   │   ├── page.tsx           Overview dashboard (KPIs, active brands, pipeline funnel)
│   │   ├── companies/         Companies directory & [id] detail page (5 tabs)
│   │   ├── opportunities/     Opportunities 5-stage Kanban & [id] detail page (CPQ/Quotes)
│   │   ├── people/            Contacts directory & create dialog
│   │   ├── sequences/         Outbound cadences & active enrollments
│   │   ├── routing/           Lead assignment rules
│   │   ├── duplicates/        Duplicate detection & interactive merge queue
│   │   ├── products/          Catalog SKU manager & pricing
│   │   ├── reports/           Sales funnel, cycle velocity & AE pacing
│   │   ├── brands/            Multi-DBA holding company overview
│   │   ├── webhooks/          Outbound event subscriptions & delivery logs
│   │   ├── import-export/     CSV import/export engine
│   │   ├── approvals/         Tier 4 HITL decision review queue
│   │   └── settings/          Permissions, Custom Fields, Custom Objects, Tags
│   ├── api/
│   │   └── webhooks/clerk/    Clerk user & organization synchronization
│   ├── globals.css            Tailwind CSS v4 theme variables
│   └── layout.tsx             Root layout with ClerkProvider & TooltipProvider
│
├── components/
│   ├── ui/                    Base UI / shadcn accessible primitives
│   ├── app-sidebar.tsx        Collapsible navigation sidebar
│   ├── site-header.tsx        Dynamic route-aware breadcrumb header
│   └── [domain]/              Domain-specific interactive dialogs and tables
│
├── db/
│   ├── schema/                Drizzle schema modules (system, crm, mcp, retrieval, ingest)
│   ├── migrations/            0000–0012 versioned SQL migration files
│   ├── edge.ts                Workers/Hyperdrive-compatible database client
│   ├── migrate.ts             Programmatic migration runner
│   ├── seed.ts                Mock account, deal, and product seeder
│   └── index.ts               MCP server PostgreSQL singleton
│
├── lib/                       Pure domain modules (CPQ, timeline, routing, etc.)
│
└── mcp/
    ├── server.ts              66 tool registrations, resources, prompts
    ├── tools.ts               Zod validation schemas and execution handlers
    ├── resources.ts           Read-only MCP resources
    ├── prompts.ts             Pre-meeting dossiers and deal risk workflows
    └── stdio.ts               stdio transport runner (pnpm mcp)
```

---

## 5. CRM Primitives Implementation Status

| Primitive | Status | Lib Module | Web UI Route | Key Tables |
| :--- | :---: | :--- | :--- | :--- |
| **Activity Timeline** | ✅ | `timeline.ts` | `/companies/[id]`, `/opportunities/[id]` | `crm.timeline_activities` |
| **Saved Views** | ✅ | `views.ts` | Table filters | `crm.views` |
| **Duplicate Detection & Merge** | ✅ | `duplicates.ts` | `/duplicates` | `crm.merge_candidates` |
| **Outbound Sequences** | ✅ | `sequences.ts` | `/sequences` | `crm.sequences`, `sequence_steps`, `sequence_enrollments` |
| **Lead Routing** | ✅ | `routing.ts` | `/routing` | `crm.assignment_rules` |
| **Account Hierarchy** | ✅ | `hierarchy.ts` | `/companies/[id]` (Hierarchy tab) | `companies.parent_company_id` |
| **CPQ (Products, Quotes)** | ✅ | `cpq.ts` | `/products`, `/opportunities/[id]` | `crm.products`, `opportunity_line_items`, `quotes` |
| **Outbound Webhooks** | ✅ | `webhooks.ts` | `/webhooks` | `crm.webhook_subscriptions`, `webhook_deliveries` |
| **Import / Export (CSV)** | ✅ | `csv.ts` | `/import-export` | Direct entity streams |
| **Reporting & Dashboards** | ✅ | `reporting.ts` | `/`, `/reports` | `crm.dashboards`, `dashboard_widgets` |
| **Field/Record Permissions** | ✅ | `permissions.ts` | `/settings` | `crm.field_permissions`, `visibility` columns |
| **Multi-Brand / DBA Modeling** | ✅ | `brands.ts` | `/brands`, `/` | `crm.brands`, `brand_id` FKs |
| **Native Email & Calendar Sync** | ❌ | — | — | Blocked: OAuth application registration required |
