# Agentic CRM Boilerplate

A self-hosted, MCP-native CRM built on PostgreSQL (Polygres). Bring your own AI agent — connect Claude Desktop, Cursor, or any custom agent swarm via the Model Context Protocol (MCP) and get a fully functional CRM system of record, knowledge graph, and agentic execution layer.

---

## What's Inside

| Layer | Technology | What It Does |
| :--- | :--- | :--- |
| **Database** | PostgreSQL via [Polygres](https://polygres.com) | 5 logical schemas, 41 tables, 12 migrations applied |
| **ORM** | [Drizzle ORM](https://orm.drizzle.team) | Type-safe schema definitions + `db:generate` / `db:migrate` workflow |
| **Auth** | [Clerk](https://clerk.com) | Sign-in, sessions, Organizations, webhook sync to `system.users` |
| **MCP Server** | [`@modelcontextprotocol/sdk`](https://modelcontextprotocol.io) | 62 registered tools across all CRM domains, stdio transport |
| **Hybrid Retrieval** | [Polygres SDK (`polygres-sdk-ts`)](https://polygres.com) | `graphFirst` (entity-scoped), `joint` tri-lane (Vector + Lexical + Graph), lookalike scoring |

---

## Quickstart

```bash
# 1. Install
pnpm install

# 2. Configure environment
cp .env.example .env
# Fill in: DATABASE_URL, POLYGRES_RUNTIME_URL, CLERK_* keys

# 3. Apply database migrations (NEVER use db:push on live DB)
pnpm db:generate   # generates SQL migration file
pnpm db:migrate    # applies it via programmatic Drizzle migrator

# 4. Seed with realistic mock data (Acme Corp, Cyberdyne, Stark Industries)
pnpm db:seed

# 5. Inspect schemas interactively
pnpm db:studio

# 6. Launch the CRM MCP Server (stdio)
pnpm mcp
```

### Connect to Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "crm": {
      "command": "pnpm",
      "args": ["mcp"],
      "cwd": "/path/to/this/repo",
      "env": {
        "DATABASE_URL": "postgresql://...",
        "POLYGRES_RUNTIME_URL": "https://runtime.polygres.com"
      }
    }
  }
}
```

---

## Database Schemas (5 Logical, 41 Tables)

```
system    →  users, organizations, organization_members, api_keys
crm       →  companies, people, opportunities, notes, tasks, calendar_events,
              note_targets, task_targets, calendar_event_targets,
              custom_field_definitions, custom_object_definitions, custom_object_records,
              tags, taggables, timeline_activities, views, merge_candidates,
              sequences, sequence_steps, sequence_enrollments, assignment_rules,
              products, opportunity_line_items, quotes,
              webhook_subscriptions, webhook_deliveries,
              dashboards, dashboard_widgets, field_permissions
mcp       →  mcp_clients, mcp_tool_call_receipts, mcp_approvals
retrieval →  interaction_transcripts, knowledge_documents
ingest    →  source_connections, telemetry_events, event_outbox
```

---

## MCP Tools (62 Total)

### Core CRM
| Tool | What It Does |
| :--- | :--- |
| `crm_search_companies` | Fuzzy search companies by name/domain |
| `crm_get_company` | Full 360° company view with contacts, deals, transcripts, and timeline |
| `crm_create_company` | Create company with standard + custom fields; logs `RECORD_CREATED` |
| `crm_update_opportunity_stage` | Move deal stage; CLOSED_WON/LOST intercepted by Tier 4 HITL gate |
| `crm_create_custom_field` | Add a runtime custom field (JSONB, no migration required) |
| `crm_create_custom_object` | Define a new custom object type at runtime |
| `crm_create_custom_record` | Insert a record into a custom object |
| `crm_search_custom_records` | Query custom object records |

### Polygres Hybrid Retrieval
| Tool | What It Does |
| :--- | :--- |
| `polygres_graph_search` | Entity-anchored semantic search scoped to a company's relational graph |
| `polygres_joint_search` | Tri-lane Vector + Lexical + Graph co-ranked search around an opportunity |
| `polygres_recommend_lookalikes` | Score lookalike accounts via Polygres recommendation engine |

### Tags
| Tool | What It Does |
| :--- | :--- |
| `crm_create_tag` | Create a reusable named tag (color, category) |
| `crm_tag_record` | Attach tag to any standard or custom object |
| `crm_untag_record` | Remove tag from a record |
| `crm_get_record_tags` | List all tags on a record |
| `crm_search_by_tag` | Find all records of a type with a given tag |

### Activity Timeline
| Tool | What It Does |
| :--- | :--- |
| `crm_get_timeline` | Chronological activity feed for any entity (auto-populated on mutations) |
| `crm_log_timeline_activity` | Manually record an external event (email sent, call placed, etc.) |

### Saved Views & Segmentation
| Tool | What It Does |
| :--- | :--- |
| `crm_create_view` | Save a TABLE, KANBAN, or CALENDAR view with filters/sort/grouping |
| `crm_list_views` | List saved views for a target entity |
| `crm_run_view` | Execute a view (by ID or ad-hoc) — returns filtered, sorted, grouped records |
| `crm_delete_view` | Remove a saved view |

### Duplicate Detection & Merge
| Tool | What It Does |
| :--- | :--- |
| `crm_find_duplicates` | Detect duplicates via domain match, exact name, Dice bigram fuzzy similarity |
| `crm_list_merge_candidates` | Queue of pending duplicate pairs |
| `crm_merge_records` | Merge duplicate into primary (Tier 4 HITL approval gate; re-points 9 tables) |
| `crm_dismiss_merge_candidate` | Dismiss a false-positive pair |

### Account Hierarchy
| Tool | What It Does |
| :--- | :--- |
| `crm_get_company_hierarchy` | Full corporate tree (ancestors + subsidiaries) with family-wide pipeline rollup |
| `crm_set_parent_company` | Link/detach subsidiary with circular-loop cycle detection |

### Outbound Sequences / Cadences
| Tool | What It Does |
| :--- | :--- |
| `crm_create_sequence` | Define multi-touch cadence with EMAIL, LINKEDIN, PHONE_CALL, TASK steps |
| `crm_list_sequences` | List sequences with active/completed enrollment counts |
| `crm_enroll_in_sequence` | Enroll a contact (duplicate active enrollment blocked) |
| `crm_advance_sequence_step` | Execute current step, schedule next (creates tasks for TASK channel) |
| `crm_get_sequence_progress` | Visual progress report for an enrollment |
| `crm_set_sequence_enrollment_status` | Pause or resume an enrollment |
| `crm_exit_sequence_on_reply` | Stop cadence immediately when prospect replies |

### Lead Routing & Assignment
| Tool | What It Does |
| :--- | :--- |
| `crm_create_assignment_rule` | Define rule with conditions and ROUND_ROBIN / LOAD_BALANCED / SPECIFIC_USER strategy |
| `crm_list_assignment_rules` | List active rules ordered by priority |
| `crm_route_and_assign_record` | Route a record through rules, assign owner, log assignment |
| `crm_delete_assignment_rule` | Remove a rule |

### Products, Price Books & Quotes (CPQ)
| Tool | What It Does |
| :--- | :--- |
| `crm_create_product` | Add a product to catalog with SKU and default pricing |
| `crm_list_products` | Search active catalog |
| `crm_add_line_item` | Attach product to opportunity with quantity + discount; auto-syncs opportunity total |
| `crm_remove_line_item` | Remove line item; recalculates opportunity total |
| `crm_generate_quote` | Generate formal quote (`Q-YYYY-XXXXX`) from line items |
| `crm_get_opportunity_quotes` | View quotes and itemized BOM for an opportunity |

### Outbound Webhooks
| Tool | What It Does |
| :--- | :--- |
| `crm_create_webhook_subscription` | Subscribe a URL to CRM events (wildcard `*` supported) |
| `crm_list_webhook_subscriptions` | View active subscriptions |
| `crm_delete_webhook_subscription` | Remove subscription |
| `crm_list_webhook_deliveries` | Audit log with HTTP codes and error traces |
| `crm_dispatch_webhook_event` | Broadcast event to matching subscribers (HMAC SHA-256 signed) |

### Import / Export
| Tool | What It Does |
| :--- | :--- |
| `crm_import_csv` | Import companies or contacts; validates, deduplicates, returns per-row status |
| `crm_export_csv` | Export any entity or saved view to CSV |

### Reporting & Dashboards
| Tool | What It Does |
| :--- | :--- |
| `crm_get_pipeline_funnel_report` | Deals by stage: count, total value, avg health score |
| `crm_get_rep_performance_report` | Win rate, won/lost counts, total pipeline per rep |
| `crm_get_deal_velocity_report` | Avg days to close, active deal age by stage |
| `crm_get_engagement_report` | Top entities by activity timeline event count |
| `crm_create_dashboard` | Create a saved dashboard |
| `crm_execute_dashboard` | Run all widgets with live aggregate data |

### Field / Record Permissions
| Tool | What It Does |
| :--- | :--- |
| `crm_set_record_visibility` | Set OPEN (all org members) or PRIVATE (owner + admins only) on a record |
| `crm_set_field_permission` | Configure read/write access for a field by role (guest/member/admin) |
| `crm_list_field_permissions` | View all configured field-level permission rules |

### Ambient Ingestion
| Tool | What It Does |
| :--- | :--- |
| `crm_log_meeting_transcript` | Ingest call transcript with atomic Polygres vector + graph sync |

---

## MCP Resources

| Resource | What It Returns |
| :--- | :--- |
| `crm://pipeline/summary` | Aggregated pipeline by stage with counts and total value |
| `crm://companies/{id}` | Company 360: contacts, deals, transcripts, and last 25 timeline events |
| `crm://transcripts/{id}` | Full call transcript with summary and linked entities |

## MCP Prompts

| Prompt | What It Does |
| :--- | :--- |
| `pre_call_dossier` | 1-page pre-meeting brief: deal state, stakeholders, past commitments, discovery questions |
| `deal_risk_review` | Risk analysis: velocity, sentiment, red flags, closing actions |

---

## Risk-Tiered HITL Governance

Autonomous agents are rate-controlled by a 4-tier risk gate:

| Tier | Examples | Behavior |
| :--- | :--- | :--- |
| **T1** Read-Only | Search, get company, view timeline | Executes freely |
| **T2** Additive | Create company, log transcript, create tag | Executes freely, full audit receipt |
| **T3** Mutative | Update stage (non-terminal), add line item | Executes with audit; optional policy check |
| **T4** Irreversible | `CLOSED_WON`, `crm_merge_records`, delete | **Intercepted** → `mcp.mcp_approvals` queue awaiting human sign-off |

---

## Architecture & System Design

- [Master System Architecture (`ARCHITECTURE.md`)](./ARCHITECTURE.md) — End-to-end system blueprint: schemas, MCP tool catalog, Polygres integration, HITL governance, and current implementation status.
- [MCP-Native CRM Platform Architecture](./docs/mcp-native-crm-architecture.md) — Why MCP enables "Bring Your Own Agent" (BYOA) and how Claude Desktop, Cursor, and agent swarms connect.
- [Cloudflare MCP Portals: Unified Gateway for All CRM Tools](./docs/cloudflare-mcp-portals.md) — Aggregating the CRM MCP server, Granola, Stripe, and others behind authenticated SSO with Zero Trust and DLP.
- [Production Database Schema Proposal](./docs/database-schema-proposal.md) — Original DDL design specification for the 5 logical schemas.
- [System Topology & Self-Hosting Guide](./docs/deployment-and-topology.md) — Physical infrastructure blueprint: Polygres storage, Next.js app tier, BYOA clients.
- [Extending Fields & Creating Custom Objects](./docs/extending-fields-and-custom-objects.md) — Code-first Drizzle extensions vs. runtime no-code custom fields (JSONB + GIN) and custom objects.
- [Teams (Organizations) & Tags](./docs/teams-and-tags.md) — Clerk Organizations for multi-team grouping and polymorphic tagging across standard + custom objects.
- [Production Roadmap: The 6 Missing Pillars](./docs/production-roadmap-and-missing-pillars.md) — Operational roadmap: ambient ingestion, Slack HITL, agent simulation, analytical views, outbound.
- [CRM Primitives Build Status](./docs/missing-crm-primitives.md) — Gap analysis against Salesforce/HubSpot/Attio — 11 of 12 primitives now built with schema sketches and implementation references.

## Technical & Operational Research

- [Agentic CRM Use Cases: What People Do & Need](./docs/agentic-crm-use-cases.md) — 10 core GTM use cases, persona matrices, HITL governance tiers.
- [Twenty CRM Database & System Architecture](./docs/twentycrm-database-architecture.md) — Research on Twenty CRM's PostgreSQL multi-tenancy, metadata engine, and TwentyORM runtime.
- [State of the Art (SOTA) in Modern & Agentic CRMs](./docs/sota-and-agentic-crms.md) — Industry research: Salesforce Agentforce, Attio, Day.ai, Artisan, Clay, multi-agent swarms.
- [Polygres & pgContext in Modern Agentic CRMs](./docs/polygres-agentic-crm-integration.md) — Why graph-aware retrieval (`graphFirst`, `joint`, `rankFusion`) solves the CRM retrieval bottleneck.
- [PostHog: Source Integrations & CRM Sync](./docs/posthog-sources-and-crm-integration.md) — PostHog as a managed data warehouse source linking CRMs and exporting real-time event destinations.
- [Meeting App Integrations & CRM Call Intelligence](./docs/meeting-integrations-and-crm-patterns.md) — Granola, Recall.ai, Fireflies, Fathom, Zoom/Meet; ingestion architectures and entity linking.
