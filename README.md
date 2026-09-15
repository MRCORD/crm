# Agentic CRM Boilerplate

An open-source, AI-native CRM boilerplate built for teams that want a modern relational system of record, autonomous AI agents, and PostgreSQL-native hybrid retrieval.

## Tech Stack

* **Database & ORM:** PostgreSQL + [Drizzle ORM](https://orm.drizzle.team) with 5 dedicated logical schemas (`system`, `crm`, `mcp`, `retrieval`, `ingest`).
* **Hybrid Retrieval & Graph:** [Polygres](https://polygres.com) & `pgContext` via [`polygres-sdk-ts`](https://github.com/twentyhq/twenty) for entity-anchored (`graphFirst`) and tri-lane (`joint`) search.
* **Model Context Protocol (MCP) Server:** Anthropic [`@modelcontextprotocol/sdk`](https://modelcontextprotocol.io) providing native Tools, Resources, Prompts, and a Human-in-the-Loop approval gateway for Claude Desktop, Cursor, and custom agent swarms.
* **Telemetry & Ambient Ingestion:** Transactional Outbox pattern & PostHog webhook ingestion.
## Quickstart

```bash
# 1. Install dependencies
pnpm install

# 2. Configure environment
cp .env.example .env

# 3. Push schemas to PostgreSQL
pnpm db:push

# 4. Seed with realistic mock data (Acme, Cyberdyne, Stark Industries, transcripts)
pnpm db:seed

# 5. Launch Drizzle Studio to inspect the 5 schemas
pnpm db:studio

# 6. Run the CRM Model Context Protocol (MCP) Server (stdio)
pnpm mcp
```

## Architecture & System Design

- [Master System Architecture (`ARCHITECTURE.md`)](./ARCHITECTURE.md) — Comprehensive technical blueprint uniting dynamic relational schemas, SOTA agentic runtime, and Polygres hybrid retrieval.
- [MCP-Native CRM Platform Architecture](./docs/mcp-native-crm-architecture.md) — Why transforming the CRM into a Model Context Protocol (MCP) server enables "Bring Your Own Agent" (BYOA), connecting Claude Desktop, Cursor, and custom swarms to CRM data and Polygres search.
- [Cloudflare MCP Portals: Unified Gateway for All CRM Tools](./docs/cloudflare-mcp-portals.md) — How Cloudflare MCP Portals aggregate the CRM MCP server, Granola, Stripe, and other servers behind one authenticated SSO URL with Zero Trust policies, per-user tool curation, full audit logging, and DLP.
- [Production Database Schema Proposal](./docs/database-schema-proposal.md) — Complete DDL and table design specification for the 5 logical schemas (`system`, `crm`, `mcp`, `retrieval`, `ingest`).
- [System Topology & Self-Hosting Guide](./docs/deployment-and-topology.md) — Physical infrastructure blueprint explaining the division between managed Polygres data storage, self-hosted Next.js application tier, and external Bring-Your-Own-Agent (BYOA) clients.
- [Extending Fields & Creating Custom Objects](./docs/extending-fields-and-custom-objects.md) — Dual-layer customization guide detailing code-first Drizzle extensions vs. runtime no-code custom fields (JSONB + GIN) and dynamic custom objects with Polygres `registerJsonbPath` indexing.
- [Production Roadmap: The 6 Missing Pillars](./docs/production-roadmap-and-missing-pillars.md) — Operational blueprint detailing ambient ingestion (Recall.ai/Zoom), Slack HITL notifications, agent simulation/dry-run mode, analytical SQL views, and multi-channel outbound (Resend & WhatsApp).

## Technical & Operational Specifications

- [Agentic CRM Use Cases: What People Do & Need](./docs/agentic-crm-use-cases.md) — Exhaustive mapping of human GTM pain points, the 10 core agentic use cases across the sales lifecycle, persona matrices (AE, SDR, CSM, RevOps, VP), and risk-tiered HITL governance.
- [Twenty CRM Database & System Architecture](./docs/twentycrm-database-architecture.md) — Detailed technical research and analysis on how Twenty CRM implements its PostgreSQL multi-tenancy, metadata engine, composite column decomposition, dynamic TwentyORM runtime, and DDL migrations.
- [State of the Art (SOTA) in Modern & Agentic CRMs](./docs/sota-and-agentic-crms.md) — Comprehensive industry research and technical architecture blueprints for modern AI-native and agentic CRM systems (Salesforce Agentforce, Attio, Day.ai, Artisan, Clay, multi-agent swarms, MCP tool execution).
- [Polygres & pgContext in Modern Agentic CRMs](./docs/polygres-agentic-crm-integration.md) — Technical analysis of Polygres (`polygres-sdk-ts`), detailing why its graph-aware retrieval (`graphFirst`, `joint`, `rankFusion`), atomic context reconciliation, and grouped search solve the retrieval bottlenecks of modern CRM agents.
- [PostHog: Source Integrations, Data Warehouse & CRM Synchronization](./docs/posthog-sources-and-crm-integration.md) — Research on how PostHog links CRMs (HubSpot, Salesforce) as managed data warehouse sources, exports real-time event destinations via Hog Functions (Attio, Close), and uses `@posthog/wizard` for automated data pipelines.
- [Meeting App Integrations & CRM Call Intelligence Patterns](./docs/meeting-integrations-and-crm-patterns.md) — Research on Granola, Recall.ai, Fireflies, Fathom, and Zoom/Meet native APIs; the three ingestion architectures (device audio, cloud bot, platform API); how entity linking works; and the Granola dual-MCP setup that works immediately with our boilerplate.
