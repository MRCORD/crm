# What Other CRM Primitives Are We Missing?

This is a gap analysis against what a mature, general-purpose CRM (Salesforce, HubSpot, Attio, Twenty) ships that this boilerplate does **not** yet have. Organized by priority: what breaks adoption first, vs. what's genuinely advanced/enterprise.

---

## Current State Recap

```
✅ HAVE                                    ❌ MISSING (this document)
────────────────────────────              ────────────────────────────────
Companies, People, Opportunities          Saved Views (Kanban/Table configs)
Notes, Tasks, Calendar Events             Activity Timeline (unified audit feed)
Custom Fields (JSONB) & Custom Objects    Duplicate Detection & Merge
Teams (Clerk Organizations)               Outbound Sequences / Cadences
Tags (polymorphic)                        Lead Routing & Assignment Rules
MCP Server + 18 tools                     Account Hierarchy (parent/child)
Polygres hybrid retrieval                 Products, Price Books & Quotes (CPQ)
HITL approval queue                       Outbound Webhooks (public API)
Ambient ingestion (transcripts)           Import/Export (CSV bulk operations)
                                          Reporting & Dashboards
                                          Native Email/Calendar Sync
                                          Territory Management
                                          Field/Record-Level Sharing Permissions
```

---

## Tier 1: Blocks Real Adoption (Build These Next)

### 1. Saved Views & Segmentation

Every CRM lets users save a filtered/sorted configuration of a table as a reusable "View" — Kanban board grouped by stage, a filtered table of "Deals closing this month," a calendar view of upcoming renewals. Without this, users re-apply the same filters every session.

```sql
CREATE TABLE crm.views (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id TEXT REFERENCES system.organizations(id) ON DELETE CASCADE,
    owner_id TEXT REFERENCES system.users(id) ON DELETE CASCADE,
    target_entity TEXT NOT NULL,        -- 'companies', 'opportunities', or custom object name
    name TEXT NOT NULL,                 -- "My Active Pipeline"
    view_type TEXT NOT NULL DEFAULT 'TABLE', -- 'TABLE', 'KANBAN', 'CALENDAR'
    filters JSONB DEFAULT '[]'::jsonb,  -- [{ field: 'stage', operator: 'eq', value: 'PROPOSAL' }]
    sort_by JSONB DEFAULT '[]'::jsonb,  -- [{ field: 'amount_micros', direction: 'desc' }]
    group_by_field TEXT,                -- for Kanban: 'stage'
    visible_fields TEXT[] DEFAULT '{}', -- column visibility & order
    is_shared BOOLEAN DEFAULT FALSE,    -- visible to whole org, not just owner
    position DOUBLE PRECISION DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

MCP tool: `crm_create_view`, `crm_list_views`, `crm_run_view` (executes the saved filter and returns matching records).

---

### 2. Activity Timeline (Unified Audit Feed)

Distinct from `mcp.mcp_tool_call_receipts` (agent-only audit log) and `crm.notes` (manual annotations). This is the **chronological, append-only feed of everything that happened to a record** — stage changes, field edits, emails sent, calls logged, tags added — the single most-viewed panel on any CRM record detail page.

```sql
CREATE TABLE crm.timeline_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type TEXT NOT NULL,          -- 'company' | 'person' | 'opportunity'
    entity_id UUID NOT NULL,
    activity_type TEXT NOT NULL,        -- 'STAGE_CHANGED', 'FIELD_UPDATED', 'EMAIL_SENT', 'CALL_LOGGED', 'TAG_ADDED'
    actor_source TEXT NOT NULL,         -- 'MANUAL' | 'API' | 'AGENT' | 'SYSTEM' (ACTOR pattern from Twenty CRM)
    actor_user_id TEXT REFERENCES system.users(id),
    actor_name TEXT,
    properties JSONB DEFAULT '{}'::jsonb, -- { from: 'DISCOVERY', to: 'PROPOSAL' }
    happened_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_timeline_entity ON crm.timeline_activities(entity_type, entity_id, happened_at DESC);
```

This should be populated **automatically** by database triggers or application-level hooks on every mutation — not something an agent has to remember to call. It becomes the natural feed for `mcp://companies/{id}` resource enrichment and pre-call dossiers.

---

### 3. Duplicate Detection & Merge

The #1 data-quality complaint in every CRM. Two reps create "Acme Corp" and "Acme Corporation" independently; two contacts with the same email exist under different IDs.

```sql
CREATE TABLE crm.merge_candidates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type TEXT NOT NULL,          -- 'company' | 'person'
    primary_record_id UUID NOT NULL,
    duplicate_record_id UUID NOT NULL,
    confidence_score NUMERIC(3,2),      -- 0.00–1.00, computed via fuzzy match (domain, name similarity, email)
    match_reason TEXT,                  -- 'DOMAIN_MATCH', 'EMAIL_MATCH', 'FUZZY_NAME'
    status TEXT DEFAULT 'PENDING',      -- 'PENDING', 'MERGED', 'DISMISSED'
    reviewed_by_user_id TEXT REFERENCES system.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Merge mechanics:** When merging `duplicate_record_id` into `primary_record_id`, re-point every foreign key referencing the duplicate (`opportunities.company_id`, `note_targets.company_id`, `taggables.taggable_id`, `interaction_transcripts.company_id`, etc.) to the primary, then soft-delete the duplicate. This is naturally an **MCP tool with mandatory HITL approval** (Tier 4 — irreversible data operation) rather than autonomous.

---

## Tier 2: Sales-Process Specific (Build When Targeting Outbound Teams)

### 4. Outbound Sequences / Cadences

The core primitive of Outreach.io, Salesloft, and Apollo — a scripted, multi-step, multi-channel touch pattern executed automatically over days/weeks.

```sql
CREATE TABLE crm.sequences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,                 -- "Enterprise Cold Outbound - 7 Touch"
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE crm.sequence_steps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sequence_id UUID REFERENCES crm.sequences(id) ON DELETE CASCADE,
    step_order INT NOT NULL,
    delay_days INT DEFAULT 0,           -- days after previous step
    channel TEXT NOT NULL,              -- 'EMAIL', 'LINKEDIN', 'PHONE_CALL', 'TASK'
    template_subject TEXT,
    template_body TEXT,
    exit_on_reply BOOLEAN DEFAULT TRUE
);

CREATE TABLE crm.sequence_enrollments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sequence_id UUID REFERENCES crm.sequences(id) ON DELETE CASCADE,
    person_id UUID REFERENCES crm.people(id) ON DELETE CASCADE,
    current_step INT DEFAULT 0,
    status TEXT DEFAULT 'ACTIVE',       -- 'ACTIVE', 'PAUSED', 'COMPLETED', 'EXITED_REPLY'
    enrolled_at TIMESTAMPTZ DEFAULT NOW(),
    next_step_due_at TIMESTAMPTZ
);
```

This is the natural home for Use Case 1 (Autonomous Outbound Prospecting) from `docs/agentic-crm-use-cases.md` — the AI SDR agent enrolls prospects, and a scheduled job advances `current_step` per `next_step_due_at`, generating each touch via the agent rather than a static template.

---

### 5. Lead Routing & Assignment Rules

When an inbound lead arrives (webhook, form fill), it needs to land on the right rep automatically — round-robin, by territory, by deal size threshold.

```sql
CREATE TABLE crm.assignment_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,                 -- "Enterprise Leads to Senior AEs"
    target_entity TEXT NOT NULL,        -- 'opportunities' | 'people'
    conditions JSONB NOT NULL,          -- [{ field: 'annual_revenue', operator: 'gt', value: 10000000 }]
    assignment_strategy TEXT NOT NULL,  -- 'ROUND_ROBIN', 'LOAD_BALANCED', 'SPECIFIC_USER'
    candidate_user_ids TEXT[] DEFAULT '{}',
    priority INT DEFAULT 0,             -- lower runs first
    is_active BOOLEAN DEFAULT TRUE
);
```

---

## Tier 3: Enterprise / Scale Features

### 6. Account Hierarchy (Parent/Child Companies)

Enterprise accounts have subsidiaries. "Acme Corp EMEA" is a child of "Acme Corp Global." Deals, health scores, and forecasting should roll up.

```sql
ALTER TABLE crm.companies ADD COLUMN parent_company_id UUID REFERENCES crm.companies(id) ON DELETE SET NULL;
```
A single self-referencing FK — trivial to add, but changes forecasting rollup queries meaningfully (`WITH RECURSIVE` for full hierarchy traversal).

### 7. Products, Price Books & Quotes (CPQ)

```sql
CREATE TABLE crm.products (id, name, sku, default_price_micros, currency);
CREATE TABLE crm.opportunity_line_items (id, opportunity_id, product_id, quantity, unit_price_micros, discount_percent);
CREATE TABLE crm.quotes (id, opportunity_id, quote_number, status, expires_at, pdf_url);
```
This is where Use Case 5 (Autonomous CPQ) from the use-cases doc gets its actual data model.

### 8. Outbound Webhooks (Public API for External Consumers)

The CRM currently only *receives* webhooks (PostHog, Clerk). It should also **emit** them — so external systems (Zapier, a customer's own backend, Slack) can react to CRM changes without polling.

```sql
CREATE TABLE crm.webhook_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id TEXT REFERENCES system.organizations(id),
    target_url TEXT NOT NULL,
    event_types TEXT[] NOT NULL,        -- ['opportunity.stage_changed', 'company.created']
    secret TEXT NOT NULL,               -- HMAC signing secret
    is_active BOOLEAN DEFAULT TRUE
);
```
`ingest.event_outbox` already exists as the internal trigger mechanism — this table is the delivery-side complement: a worker reads unprocessed outbox rows, matches against active subscriptions, and POSTs signed payloads.

### 9. Import / Export (CSV Bulk Operations)

No bulk data operations exist yet. Needed for onboarding (importing an existing CRM's export) and reporting (exporting filtered views to CSV/Excel).

### 10. Reporting & Dashboards

Beyond the `crm.pipeline_funnel_view` and `crm.stale_deals_view` SQL views already proposed in `docs/production-roadmap-and-missing-pillars.md`, a real dashboard needs saved chart configurations, not just raw views:

```sql
CREATE TABLE crm.dashboards (id, name, organization_id, layout JSONB);
CREATE TABLE crm.dashboard_widgets (id, dashboard_id, widget_type, query_config JSONB, position JSONB);
```

### 11. Native Email & Calendar Sync

Distinct from meeting-bot ingestion (`docs/meeting-integrations-and-crm-patterns.md`). This is continuous two-way sync: every email a rep sends/receives through Gmail/Outlook auto-logs to the matching contact, and CRM tasks with due dates create calendar events. Typically implemented via Nylas, Google Workspace API, or Microsoft Graph — same OAuth pattern as the Clerk `authAccounts` concept, scoped per-user.

### 12. Field-Level & Record-Level Sharing Permissions

Currently: `system.users.role` (admin/member/guest) is the only access control. Missing:
- Field-level: hide `annual_revenue_amount_micros` from `guest` role.
- Record-level: a `PRIVATE` opportunity visible only to its owner + admins (the `readability` pattern Twenty CRM implements: `OPEN`, `INHERITED`, `PRIVATE`, `SYSTEM`).

---

## Recommended Build Order

| Priority | Feature | Why First |
| :--- | :--- | :--- |
| **P0** | Saved Views | Every user session needs this; biggest daily-use gap |
| **P0** | Activity Timeline | Foundational context for every other feature (agents, reporting, dossiers) |
| **P1** | Duplicate Detection & Merge | Data quality compounds — worse the longer it's missing |
| **P1** | Outbound Sequences | Unlocks the flagship "AI SDR" use case with real infrastructure |
| **P2** | Lead Routing | Needed once team size > 1 rep receiving inbound |
| **P2** | Account Hierarchy | One-column addition, high leverage for enterprise deals |
| **P3** | CPQ (Products/Quotes) | Only needed once deals require formal quoting |
| **P3** | Outbound Webhooks | Needed for third-party integrations beyond MCP |
| **P3** | Import/Export | Needed for onboarding existing customers |
| **P4** | Reporting Dashboards | Nice-to-have once enough data exists to visualize |
| **P4** | Native Email/Calendar Sync | Heavier OAuth/infra lift; meeting-bot ingestion covers 80% of value first |
| **P4** | Field/Record Permissions | Needed only past a certain team size / compliance requirement |
