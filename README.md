<div align="center">

# Agentic CRM

**An open-source, MCP-native CRM built for autonomous AI agents and human revenue teams.**

Powered by **PostgreSQL**, **Next.js 16**, **Tailwind CSS v4**, and the **Model Context Protocol (MCP)**.

[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-blue?style=flat&logo=react)](https://react.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-38bdf8?style=flat&logo=tailwindcss)](https://tailwindcss.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?style=flat&logo=postgresql)](https://www.postgresql.org/)
[![MCP](https://img.shields.io/badge/MCP-Native-purple?style=flat&logo=anthropic)](https://modelcontextprotocol.io/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](./LICENSE)

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/MRCORD/crm)

[Architecture](#-architecture) • [Features](#-features) • [Quickstart](#-quickstart) • [Connect AI Agents](#-connecting-ai-agents-via-mcp) • [MCP Tools](#-mcp-tools-catalog) • [Deployment](#-deployment) • [Inspirations](#-acknowledgements--inspirations)

</div>

---

## 💡 What is Agentic CRM?

Most CRMs were designed twenty years ago as manual data-entry silos for human reps. **Agentic CRM** is engineered from the ground up for a hybrid future where:

1. **AI Agents** (Claude Desktop, Cursor, swarms, or background workers) read, update, triage, and execute sales workflows through **66 native Model Context Protocol (MCP) tools**.
2. **Human Sales Teams** collaborate seamlessly through a lightning-fast, dense, beautiful **Next.js 16 web application** with drag-and-drop pipeline boards, full-width data tables, and slide-over deal inspectors.
3. **Every Action is Audited**: High-risk agent actions (closing $1M deals, deleting records, merging companies) are intercepted by a built-in **Tier 4 Human-in-the-Loop (HITL) approval queue**.

---

## 🏛️ Architecture

```mermaid
graph TD
    subgraph Clients["Client Layer"]
        A[🤖 AI Agents<br/>Claude Desktop • Cursor • Swarms]
        B[👤 Human Sales Reps<br/>Next.js 16 App Router Web Dashboard]
    end

    subgraph Entry["Entry & Protocol Layer"]
        C["⚡ MCP Server (stdio)<br/>66 Registered Tools • Audit Ledger"]
        D["🌐 Server Actions<br/>Clerk Auth • Dynamic SSR"]
    end

    subgraph Domain["Domain Services (src/lib)"]
        E["💼 Pipeline & Kanban<br/>Dynamic Stages • Brand Workspaces"]
        F["📊 CPQ & Pricing<br/>Quotes • Multi-tier SKUs"]
        G["🎯 Automation<br/>Lead Routing • Sequences"]
        H["🛡️ Governance<br/>HITL Approvals • Field Permissions"]
    end

    subgraph Database["PostgreSQL Storage"]
        I["🗄️ 5 Logical Schemas<br/>system • crm • mcp • retrieval • ingest"]
        J["🕸️ Relational Graph Edges<br/>Companies ⇄ Contacts ⇄ Deals ⇄ Quotes"]
    end

    A --> C
    B --> D
    C --> Domain
    D --> Domain
    Domain --> Database
```

> 💡 **Data Modeling Inspiration**: The multi-schema PostgreSQL architecture and polymorphic junction patterns in this repository draw direct architectural inspiration from **[Twenty CRM](https://twenty.com)** (`twentyhq/twenty`). For a comprehensive technical analysis of Twenty's metadata engine, see [`docs/twentycrm-database-architecture.md`](./docs/twentycrm-database-architecture.md).

---

## ⚡ Features

### 🖥️ Human-First Web Experience
- **Fluid Drag-and-Drop Pipeline**: Powered by `@base-ui/react` and `@dnd-kit` with optimistic updates, live layout animations, and automatic rollback on network error.
- **Brand Subpages & Multi-DBA Workspaces**: Dedicated isolated pipeline workspaces for each operating brand (`/opportunities/brand/[slug]`) plus a consolidated All-Brands Portfolio view (`/opportunities`).
- **Dense, Full-Width Data Tables**: Edge-to-edge spreadsheet-like tables inspired by Linear and Attio, featuring live multi-column sorting, row selection checkboxes, and bottom calculation bars.
- **Segmented Win Probability Meters**: Visual 6-bar colored progress indicators (`[■■■■□□] 82%`) next to tabular currency values.
- **Slide-Over Deal Inspector**: Non-modal right drawer panel to triage deal values, advance stage progression tracks, inspect health scores, and configure CPQ line items without leaving your pipeline.
- **Table Pagination**: Reusable, responsive pagination controls (`10`, `25`, `50`, `100` rows/page) across every CRM entity directory.
- **Collapsible Sidebar**: Grouped sections with clean icon-rail collapse mode and expandable brand subpages.

### 🤖 Autonomous AI Agent Layer (MCP)
- **66 Registered Tools**: Full CRUD, search, pipeline movement, quote generation, sequence enrollment, and duplicate merging.
- **stdio Transport**: Plug directly into Claude Desktop, Cursor, Windsurf, or custom LangChain/CrewAI agents via `pnpm mcp`.
- **Immutable Tool Receipts Ledger**: Every tool execution records parameters, duration, actor identity, and results in `mcp.mcp_tool_call_receipts`.
- **Tier 4 Human-in-the-Loop (HITL)**: High-impact operations trigger structured review tickets in `/approvals` before committing.
- **Polygres Hybrid Knowledge Graph**: Foreign keys double as knowledge graph edges, powering semantic graph traversals (`polygres_graph_search`) and tri-lane joint retrieval.

---

## 🛠️ Tech Stack

| Layer | Technology | Details |
| :--- | :--- | :--- |
| **Framework** | [Next.js 16](https://nextjs.org) + [React 19](https://react.dev) | App Router, Server Actions, Turbopack |
| **Database** | [PostgreSQL](https://postgresql.org) (or [Polygres](https://polygres.com)) | 5 schemas, 42+ relational tables, knowledge graph edges |
| **ORM & Migrations** | [Drizzle ORM](https://orm.drizzle.team) + `drizzle-kit` | Strictly typed schema definitions and versioned migrations |
| **Styling & UI** | [Tailwind CSS v4](https://tailwindcss.com) + `@base-ui/react` | Modern, responsive, accessible component architecture |
| **Drag & Drop** | [`@dnd-kit`](https://dndkit.com) | Accessible, fluid touch and mouse sensors |
| **Auth & Users** | [Clerk](https://clerk.com) | JWT session auth, role-based access, webhook sync |
| **AI Protocol** | [`@modelcontextprotocol/sdk`](https://modelcontextprotocol.io) | 66 tools, 3 resources, 2 prompts over stdio transport |
| **Deployment** | [Cloudflare Workers](https://workers.cloudflare.com) / Node.js | `@opennextjs/cloudflare` with Hyperdrive pooling |

---

## 🚀 Quickstart

### Prerequisites
- Node.js >= 20.0.0
- `pnpm` >= 9.0.0
- PostgreSQL database (Local or hosted on [Polygres](https://polygres.com) / Supabase / Neon)
- [Clerk](https://clerk.com) account (free tier works great)

### 1. Clone & Install

```bash
git clone https://github.com/MRCORD/crm.git
cd crm
pnpm install
```

### 2. Configure Environment

Copy the example environment file:

```bash
cp .env.example .env
```

Fill in your database and Clerk keys in `.env`:

```env
# Database (PostgreSQL / Polygres)
DATABASE_URL=postgres://postgres:postgres@localhost:5432/crm
DIRECT_URL=postgres://postgres:postgres@localhost:5432/crm

# Clerk Authentication (https://dashboard.clerk.com)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
CLERK_WEBHOOK_SECRET=whsec_...
```

### 3. Run Database Migrations

No PostgreSQL instance yet? Spin one up locally in one command:

```bash
docker compose up -d
```

Apply the versioned Drizzle migrations to scaffold the 5 logical schemas and tables:

```bash
pnpm db:migrate
```

### 4. Launch the Dev Server

```bash
pnpm dev --port 3011
```

Open [http://localhost:3011](http://localhost:3011) to view the CRM dashboard.

---

## 🤖 Connecting AI Agents via MCP

Connect any MCP-compatible agent interface to your CRM in seconds:

### Claude Desktop
Edit your Claude Desktop configuration (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS or `%APPDATA%\Claude\claude_desktop_config.json` on Windows):

```json
{
  "mcpServers": {
    "agentic-crm": {
      "command": "pnpm",
      "args": ["mcp"],
      "cwd": "/path/to/your/crm",
      "env": {
        "DATABASE_URL": "postgresql://postgres:postgres@localhost:5432/crm"
      }
    }
  }
}
```

Restart Claude Desktop, and Claude will automatically discover all **66 CRM tools**. You can immediately prompt:
- *"Show me all open deals over $50,000 closing this quarter"*
- *"Move the Cyberdyne deal to Negotiation and draft a proposal quote"*
- *"Find duplicate company records and submit a merge approval ticket"*

### Cursor / Windsurf
Add a command-based MCP server in your editor settings pointing to:
```bash
pnpm --prefix /path/to/your/crm mcp
```

---

## 🧰 MCP Tools Catalog

The CRM exposes **66 specialized tools** organized into modular domains:

<details>
<summary><b>1. Core Record Management (Companies, Contacts, Deals)</b></summary>

- `crm_create_company` / `crm_get_company` / `crm_update_company` / `crm_delete_company`
- `crm_create_person` / `crm_get_person` / `crm_update_person` / `crm_delete_person`
- `crm_create_opportunity` / `crm_get_opportunity` / `crm_update_opportunity_stage`
- `crm_search_records` (Full-text cross-entity search)
</details>

<details>
<summary><b>2. CPQ, Products & Quotes</b></summary>

- `crm_list_products` / `crm_create_product`
- `crm_create_quote` / `crm_get_quote` / `crm_update_quote_status`
- `crm_add_line_item` / `crm_remove_line_item`
</details>

<details>
<summary><b>3. Pipeline Stages & Brand DBAs</b></summary>

- `crm_list_brands` / `crm_create_brand`
- `crm_list_pipeline_stages` / `crm_create_pipeline_stage` / `crm_reorder_pipeline_stages`
- `crm_get_brand_pipeline_summary`
</details>

<details>
<summary><b>4. Lead Routing & Automation</b></summary>

- `crm_list_routing_rules` / `crm_create_routing_rule` / `crm_execute_routing_rule`
- `crm_list_sequences` / `crm_enroll_contact_sequence` / `crm_advance_sequence_step`
</details>

<details>
<summary><b>5. Deduplication & Data Quality</b></summary>

- `crm_find_duplicate_candidates` / `crm_merge_companies` / `crm_merge_people`
- `crm_dismiss_duplicate_pair`
</details>

<details>
<summary><b>6. Human-in-the-Loop (HITL) & Governance</b></summary>

- `crm_list_pending_approvals` / `crm_approve_ticket` / `crm_reject_ticket`
- `crm_get_field_permissions` / `crm_get_audit_ledger`
</details>

<details>
<summary><b>7. Knowledge Graph & Semantic Retrieval</b></summary>

- `polygres_graph_search` / `polygres_joint_search`
- `crm_query_relational_graph`
</details>

---

## 🌐 Database Schema Reference

The database is partitioned into **5 clean logical PostgreSQL schemas**:

```
├── system
│   ├── users                      # Reps, managers, and admin profiles
│   ├── organizations              # Multi-tenant tenant boundaries
│   └── api_keys                   # System & agent credentials
│
├── crm
│   ├── companies & people         # Accounts, subsidiaries, stakeholders
│   ├── opportunities & stages     # Deals, pipeline progressions, probabilities
│   ├── products & quotes          # CPQ catalog, line items, and proposals
│   ├── brands                     # Operating DBAs and multi-brand holding groups
│   ├── routing_rules & sequences  # Lead assignment and outreach cadences
│   ├── timeline_activities        # Unified audit log and event feed
│   └── duplicate_candidates       # Fuzzy match resolution queue
│
├── mcp
│   ├── mcp_tool_call_receipts     # Immutable execution ledger for agent tools
│   └── hitl_approval_tickets      # Human-in-the-loop review tickets
│
├── retrieval
│   ├── interaction_transcripts    # Meeting notes, emails, and call audio text
│   └── embeddings_index           # Semantic search vectors
│
└── ingest
    ├── external_webhooks          # Inbound webhook receiver queue
    └── sync_checkpoints           # Integration idempotency markers
```

---

## 🚢 Deployment

### ⚡ One-Click Deploy (Cloudflare Workers)

Click the button below to deploy Agentic CRM to your Cloudflare account in minutes:

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/MRCORD/crm)

> **Before clicking**: [Create a Cloudflare Hyperdrive config](https://developers.cloudflare.com/hyperdrive/) pointing to your PostgreSQL database, and note the Config ID. You'll need it after deploying.

**After clicking the button**, the deploy flow will:
1. Fork this repository into your GitHub account.
2. Trigger the GitHub Actions workflow (`.github/workflows/deploy.yml`) to build and deploy.
3. Prompt you to add GitHub secrets: `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.

**Then complete setup** by adding secrets to your Cloudflare Worker:
```bash
wrangler secret put DATABASE_URL
wrangler secret put DIRECT_URL
wrangler secret put NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
wrangler secret put CLERK_SECRET_KEY
wrangler secret put CLERK_WEBHOOK_SECRET
```

And update `wrangler.jsonc` with your actual Hyperdrive Config ID:
```jsonc
{
  "hyperdrive": [{ "binding": "HYPERDRIVE", "id": "YOUR_HYPERDRIVE_CONFIG_ID" }]
}
```

**Full deployment guide with screenshots**: → [DEPLOYING.md](./DEPLOYING.md)

### 🔁 Cloudflare Workers Builds (CI/CD)

Connect your GitHub repo directly to Cloudflare for auto-deploy on every push:

1. Go to **Cloudflare Dashboard → Workers & Pages → Create → Workers Builds**.
2. Connect GitHub and select your forked `crm` repository.
3. Set Build command: `npx @opennextjs/cloudflare build`
4. Set Deploy command: `npx @opennextjs/cloudflare deploy`
5. Add environment variables and deploy.

### 🖥️ Docker / Self-Hosted Node.js

A production `Dockerfile` is included for Railway, Coolify, Render, Fly.io, or any VPS:

```bash
docker build -t agentic-crm .
docker run -p 3000:3000 --env-file .env agentic-crm
```

Or without Docker, run the standard Next.js Node.js server directly:

```bash
pnpm build && pnpm start
```

For a one-command local PostgreSQL during development, see [`docker-compose.yml`](./docker-compose.yml): `docker compose up -d`.

---

## 🌟 Acknowledgements & Inspirations

This project stands on the shoulders of incredible open-source projects, developer tools, and pioneering software platforms:

### 🏗️ Infrastructure & Foundation
- **[Polygres](https://polygres.com)** — Autonomous PostgreSQL database with relational knowledge graph edges and semantic vector embeddings.
- **[Cloudflare](https://cloudflare.com)** — Serverless edge execution with Cloudflare Workers, `@opennextjs/cloudflare`, Hyperdrive connection pooling, and Cloudflare Tunnels.
- **[Clerk](https://clerk.com)** — User authentication, JWT sessions, multi-tenant organizations, and webhook sync.
- **[Anthropic](https://anthropic.com)** — Creators of the [Model Context Protocol (MCP)](https://modelcontextprotocol.io), the open standard connecting AI agents to tools and databases.

### 🎨 Design & Product Inspirations
- **[Linear](https://linear.app)** — The gold standard for high-density, keyboard-driven UIs, fluid stage progression tracks, and clean micro-interactions.
- **[Attio](https://attio.com)** — Redefining modern CRM data architecture, fast inline cell editing, relationship data modeling, and slide-over deal inspection.
- **[Stripe](https://stripe.com)** — The benchmark for executive-grade dashboard clarity, predictable typography, and developer experience.
- **[Twenty CRM](https://twenty.com)** ([twentyhq/twenty](https://github.com/twentyhq/twenty)) — Trailblazers in modern open-source CRM architecture. Twenty's pioneering metadata-driven schema design, standard and custom object isolation, and polymorphic junction tables directly shaped our 5-schema PostgreSQL architecture (detailed in [`docs/twentycrm-database-architecture.md`](./docs/twentycrm-database-architecture.md)).

### 📦 Key Open-Source Libraries
- **[Next.js](https://nextjs.org)** & **[React](https://react.dev)** — The foundation for server-rendered, dynamic full-stack applications.
- **[Tailwind CSS v4](https://tailwindcss.com)** — Modern utility-first styling with high-performance CSS color and layout engines.
- **[Base UI](https://base-ui.com)** & **[shadcn/ui](https://ui.shadcn.com)** — Accessible, unstyled component primitives with beautiful design system tokens.
- **[ReUI](https://reui.io)** — Fluid drag-and-drop Kanban component primitives.
- **[@dnd-kit](https://dndkit.com)** by Claudéric Demers — Accessible, high-performance drag-and-drop engine for React.
- **[Drizzle ORM](https://orm.drizzle.team)** — Type-safe, SQL-like TypeScript ORM for robust migrations.
- **[Sonner](https://sonner.emilkowal.ski)** by Emil Kowalski — The most delightful toast notification library for React.
- **[Lucide Icons](https://lucide.dev)** — Clean, consistent, and versatile icon library.
- **[Recharts](https://recharts.org)** — Composable charting library for conversion funnels and pipeline analytics.

---

## 🤝 Contributing

We welcome community contributions! Please check out [CONTRIBUTING.md](./CONTRIBUTING.md) to get started with local development, guidelines, and test suites.

---

## 📄 License

This project is licensed under the [MIT License](./LICENSE).

Built with passion by **[MRCORD](https://github.com/MRCORD)**.
