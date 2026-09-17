# Agentic CRM Boilerplate

A self-hosted, MCP-native CRM built on PostgreSQL ([Polygres](https://polygres.com)) with a full Next.js 16 web application and 66 registered Model Context Protocol (MCP) tools.

Connect Claude Desktop, Cursor, or any custom agent swarm via MCP, while giving human sales and operations teams a complete, modern web interface.

---

## Architecture Overview

```
                        ┌─────────────────────────────────────────────────┐
                        │              Client Entry Points                │
                        ├────────────────────────┬────────────────────────┤
                        │    AI Agents (MCP)     │    Human Users (Web)   │
                        │ Claude Desktop, Cursor │  Next.js 16 Dashboard  │
                        └───────────┬────────────┴───────────┬────────────┘
                                    │ stdio                  │ Server Actions
                                    ▼                        ▼
                        ┌────────────────────────┬────────────────────────┐
                        │  MCP Server (66 Tools) │  src/actions/crm.ts    │
                        │   mcp_tool_call_rcpts  │  force-dynamic render  │
                        └───────────┬────────────┴───────────┬────────────┘
                                    │                        │
                                    └───────────┬────────────┘
                                                ▼
                        ┌─────────────────────────────────────────────────┐
                        │          Domain Logic Layer (src/lib/*.ts)      │
                        │ CPQ • Sequences • Routing • Views • Duplicates  │
                        │ Permissions • Webhooks • Reports • Brands       │
                        └───────────────────────┬─────────────────────────┘
                                                ▼
                        ┌─────────────────────────────────────────────────┐
                        │             PostgreSQL (Polygres)               │
                        │ 5 Schemas: system • crm • mcp • retrieval • ing │
                        │ 42+ Tables • Relational Graph Edges • JSONB     │
                        └─────────────────────────────────────────────────┘
```

---

## Features

### 🖥️ Full Web Application (Next.js 16 + Tailwind CSS v4)
* **Overview Dashboard (`/`)**: Portfolio-wide KPIs, multi-brand breakdown, 5-stage funnel conversion cards, and recent records.
* **Companies Directory (`/companies`, `/companies/[id]`)**: Searchable account table with ARR rollups and full 5-tab detail pages (Overview, Timeline, Deals, Contacts, Corporate Hierarchy tree).
* **Opportunities Pipeline (`/opportunities`, `/opportunities/[id]`)**: 5-stage Kanban board (`DISCOVERY`, `PROPOSAL`, `NEGOTIATION`, `CLOSED_WON`, `CLOSED_LOST`), brand filter tabs, interactive stage stepper, and CPQ line item configuration with formal Quote generation (`crm.quotes`).
* **People Directory (`/people`)**: Contact directory with company links and creation modal.
* **Outbound Sequences (`/sequences`)**: Multi-step outreach cadences and contact enrollments.
* **Lead Routing (`/routing`)**: Automated assignment rules (Round Robin, Load Balanced, Territory-based).
* **Duplicate Detection (`/duplicates`)**: Fuzzy matching deduplication review queue with interactive merge and dismissal.
* **Products Catalog (`/products`)**: SKU catalog manager with pricing conversion.
* **Reports & Dashboards (`/reports`)**: Pipeline conversion funnel, sales cycle velocity, and rep quota pacing.
* **Brands & DBAs (`/brands`)**: Multi-brand holding company overview for managing distinct operating businesses.
* **Outbound Webhooks (`/webhooks`)**: Subscription registration and HMAC delivery audit logs.
* **CSV Import & Export (`/import-export`)**: Spreadsheet export download and bulk CSV upload parser.
* **HITL Approvals (`/approvals`)**: Tier 4 Human-in-the-Loop decision review queue for high-risk agent operations.
* **Settings (`/settings`)**: Field Permissions, Dynamic Custom Fields, Custom Object schemas, and Taxonomy Tags.

### 🤖 MCP Agent Layer (66 Tools)
* **stdio Transport**: Run via `pnpm mcp` to connect Claude Desktop, Cursor, or autonomous agent frameworks.
* **Immutable Audit Ledger**: Every tool execution is recorded with parameters, duration, and status in `mcp.mcp_tool_call_receipts`.
* **Tier 4 HITL Approvals**: High-risk agent actions (such as marking deals `CLOSED_WON` or merging records) are automatically intercepted and routed to the human approval inbox.
* **Hybrid Retrieval via Polygres**: Relational foreign keys double as knowledge graph edges, enabling semantic graph search (`polygres_graph_search`) and tri-lane joint retrieval (`polygres_joint_search`).

---

## Tech Stack

| Layer | Technology | Description |
| :--- | :--- | :--- |
| **Database** | PostgreSQL via [Polygres](https://polygres.com) | 5 logical schemas, 42+ tables, relational knowledge graph |
| **ORM & Migrations** | [Drizzle ORM](https://orm.drizzle.team) + `drizzle-kit` | Type-safe schema definitions; strict `db:generate` → `db:migrate` workflow |
| **Web Framework** | [Next.js 16](https://nextjs.org) + [React 19](https://react.dev) | App Router with Server Actions calling domain libraries directly |
| **Styling & UI** | [Tailwind CSS v4](https://tailwindcss.com) + `@base-ui/react` | Accessible components (shadcn/ui architecture) |
| **Authentication** | [Clerk](https://clerk.com) | Session management, role-based permissions, and webhook user synchronization |
| **MCP Server** | [`@modelcontextprotocol/sdk`](https://modelcontextprotocol.io) | 66 registered tools, 3 resources, 2 prompts via stdio transport |
| **Deployment** | [Cloudflare Workers](https://workers.cloudflare.com) | Deployed via `@opennextjs/cloudflare` and Cloudflare Hyperdrive connection pooling |

---

## Getting Started

### Prerequisites
* Node.js >= 20
* `pnpm` >= 9
* A PostgreSQL database (hosted on [Polygres](https://polygres.com) or local PostgreSQL)
* A [Clerk](https://clerk.com) account for authentication

### 1. Installation

```bash
git clone https://github.com/MRCORD/crm.git
cd crm
pnpm install
```

### 2. Environment Configuration

Copy `.env.example` to `.env` and provide your credentials:

```bash
cp .env.example .env
```

Required variables in `.env`:
* `DATABASE_URL`: PostgreSQL connection string (e.g. `postgres://postgres:postgres@localhost:5432/crm`)
* `DIRECT_URL`: Direct connection string for migrations (same as `DATABASE_URL` unless using a transaction pooler)
* `POLYGRES_API_KEY`: API key from your Polygres project dashboard
* `POLYGRES_RUNTIME_URL`: `https://runtime.polygres.com`
* `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`: Clerk Publishable Key (`pk_test_...` or `pk_live_...`)
* `CLERK_SECRET_KEY`: Clerk Secret Key (`sk_test_...` or `sk_live_...`)
* `CLERK_WEBHOOK_SECRET`: Webhook signing secret from Clerk Dashboard (`whsec_...`)
* `ALLOWED_EMAIL_DOMAIN`: *(Optional)* Set to your company domain (e.g. `yourcompany.com`) to restrict sign-ups to company employees. Leave blank for open sign-up.

### 3. Database Migrations

Apply the versioned Drizzle migrations to set up the 5 logical schemas and tables:

```bash
# Generate SQL if you modified schema files:
pnpm db:generate

# Apply migrations to your database:
pnpm db:migrate
```

*(Note: Never use `pnpm db:push` on production databases — always use `db:generate` followed by `db:migrate`).*

### 4. Seed Mock Data (Optional)

Populate sample companies, contacts, and opportunities:

```bash
pnpm db:seed
```

### 5. Run the Application

#### Start Web Development Server:
```bash
pnpm dev
```
Open [http://localhost:3000](http://localhost:3000) to view the CRM dashboard.

#### Launch MCP Server for AI Agents:
```bash
pnpm mcp
```

---

## Connecting AI Agents via MCP

To connect Claude Desktop or Cursor to your CRM, add the server configuration:

### Claude Desktop
Edit `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "agentic-crm": {
      "command": "pnpm",
      "args": ["mcp"],
      "cwd": "/path/to/your/crm",
      "env": {
        "DATABASE_URL": "postgresql://...",
        "POLYGRES_RUNTIME_URL": "https://runtime.polygres.com",
        "POLYGRES_API_KEY": "poly_live_..."
      }
    }
  }
}
```

### Cursor / Custom Agents
Point your MCP client to run `pnpm mcp` with the corresponding environment variables in the project working directory.

---

## Deployment to Cloudflare Workers

This repository is optimized for deployment to Cloudflare Workers using `@opennextjs/cloudflare` and Cloudflare Hyperdrive:

1. Update `wrangler.jsonc` with your Cloudflare Hyperdrive binding ID and custom domain route.
2. Upload production secrets:
   ```bash
   npx wrangler secret bulk .env.production
   ```
3. Build and deploy:
   ```bash
   pnpm deploy:worker
   ```

---

## Database Schemas Reference

* **`system`**: Users, organizations, organization memberships, API keys.
* **`crm`**: Companies, people, opportunities, line items, quotes, products, timeline activities, saved views, duplicate candidates, outbound sequences, lead routing rules, brands, webhooks, dashboards, and field permissions.
* **`mcp`**: Connected agent clients, tool call receipts ledger, and human-in-the-loop approval queue.
* **`retrieval`**: Interaction transcripts, embeddings metadata, and document index.
* **`ingest`**: External source connections, telemetry events, and event outbox.

---

## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](./CONTRIBUTING.md) for development workflows and [SECURITY.md](./SECURITY.md) for vulnerability reporting.

---

## License

[MIT](./LICENSE) © Mysios Labs
