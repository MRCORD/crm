# System Topology & Self-Hosting Guide: Polygres DB + Self-Hosted App + MCP

This document defines the physical infrastructure, runtime topology, and deployment architecture for this CRM.

---

## 1. Physical System Topology

The architecture separates concerns into three distinct tiers:
1. **Managed Data & Search Tier:** Hosted on **Polygres** (PostgreSQL + pgContext + Knowledge Graph).
2. **Self-Hosted Application Tier:** A unified **Next.js** codebase combining the Frontend UI, Backend Webhooks, Drizzle ORM, and the MCP Server.
3. **Agent Tier (Bring Your Own Agent - BYOA):** External AI agents (Claude Desktop, Cursor, LangGraph swarms, n8n) connecting to the CRM via standard **Model Context Protocol (MCP)**.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              1. MANAGED DATA & SEARCH LAYER                            │
│                                         (Polygres)                                     │
│                                                                                        │
│   • PostgreSQL Database (hosting 5 logical schemas: system, crm, mcp, retrieval,       │
│     ingest)                                                                            │
│   • Native Foreign-Key Knowledge Graph Engine (polygres --json graph discover)         │
│   • pgContext HNSW Multi-Vector Collections & tsvector Inverted Lexical Indexes        │
│   • Access: Standard Postgres connection string + Polygres Runtime API                 │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │
                     ┌──────────────────────┴──────────────────────┐
                     │ SQL Queries (Drizzle ORM)                   │ Polygres SDK (pgContext)
                     ▼                                             ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                            2. SELF-HOSTED APPLICATION TIER                             │
│                  (Next.js 15 on Vercel, Railway, Coolify, VPS, or Docker)              │
│                                                                                        │
│   ├── Frontend UI (App Router + shadcn/ui)                                             │
│   │   • Pipeline Kanban board & deal stage progression                                 │
│   │   • Company & Person 360-degree context views                                      │
│   │   • Human-in-the-Loop (HITL) Approval Inbox for high-risk agent actions            │
│   │                                                                                    │
│   ├── Backend & Ingestion Pipelines (Server Actions & Route Handlers)                  │
│   │   • Ambient Ingest: Zoom/Meet/Recall.ai call transcripts, email sync               │
│   │   • Telemetry Ingest: PostHog webhooks (PQLs, trial milestones, usage drops)       │
│   │   • Drizzle ORM Layer: Type-safe relational mutations across the 5 schemas         │
│   │                                                                                    │
│   └── Model Context Protocol (MCP) Server                                              │
│       • Local stdio transport: Claude Desktop, Cursor, CLI coding agents               │
│       • Remote HTTP/SSE transport: Cloud agent swarms (LangGraph, n8n, Make)          │
│       • Safety & Audit: Gating high-risk mutations into mcp.mcp_approvals              │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │
                                            │ Model Context Protocol (JSON-RPC 2.0)
                                            │ (stdio locally or SSE remotely)
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                             3. BRING YOUR OWN AGENT (BYOA)                             │
│                                                                                        │
│   • Desktop Users: Claude Desktop connected locally via stdio (`pnpm mcp`)             │
│   • Developers: Cursor / Windsurf connected via `.cursor/mcp.json`                     │
│   • Sales Swarms: Custom Python/Node agents (LangGraph, CrewAI) calling MCP tools      │
│   • Workflow Engines: n8n, Zapier, Make calling CRM actions through MCP                │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Component Responsibility Matrix ("What Lives Where")

| Component | Responsibility | Host / Runtime | Data Access Method |
| :--- | :--- | :--- | :--- |
| **PostgreSQL Database** | Storage of all 5 schemas (`system`, `crm`, `mcp`, `retrieval`, `ingest`). | **Polygres** | Direct SQL (port `5432` / pooler) |
| **Knowledge Graph** | Relationship discovery, multi-hop pathfinding (`graph.expand`). | **Polygres** | Foreign keys in Postgres schema |
| **Vector Collections** | HNSW approximate nearest neighbor (ANN) search on transcripts. | **Polygres (pgContext)** | `polygres-sdk-ts` via Runtime API |
| **Frontend UI** | Visual dashboards, Kanban pipeline, Human Approval Inbox. | **Self-Hosted** (Next.js) | Server Components & Actions |
| **Backend & Webhooks** | PostHog telemetry receiver, call transcript processing. | **Self-Hosted** (Next.js) | Next.js Route Handlers (`/api/*`) |
| **MCP Server** | Exposes Tools, Resources, Prompts, and HITL safety checks. | **Self-Hosted** (`@modelcontextprotocol/sdk`) | `stdio` (local) or `SSE` (remote) |
| **AI Agents** | Reasoning, multi-step planning, conversation, and execution. | **External (BYOA)** | MCP Client (`claude-desktop`, Cursor) |

---

## 3. Communication Protocols & Data Flows

### 3.1. Relational Flow (App $\leftrightarrow$ Database)
* **Protocol:** Standard PostgreSQL wire protocol (`postgres://...`).
* **Tool:** **Drizzle ORM** with connection pooling.
* **Usage:** Fast CRUD on `crm.companies`, `crm.opportunities`, `system.users`, and `mcp.mcp_approvals`.

### 3.2. Hybrid Retrieval Flow (App / MCP $\leftrightarrow$ Polygres Runtime API)
* **Protocol:** HTTPS / WHATWG `fetch` via `polygres-sdk-ts`.
* **Authentication:** Project API Key (`poly_live_...`).
* **Usage:**
  * `ctx.graphFirst`: Entity-anchored semantic search.
  * `ctx.joint`: Tri-lane fusion (vector + lexical + graph).
  * `project.rows.insert({ reconcileContext: true })`: Atomic transcript and note logging with synchronous indexing.

### 3.3. Agentic Protocol Flow (External Agents $\leftrightarrow$ CRM MCP Server)
* **Protocol:** Anthropic Model Context Protocol (JSON-RPC 2.0).
* **Transports:**
  * **`stdio` (Standard Input/Output):** Subprocess communication used by Claude Desktop, Cursor, and local CLI tools.
  * **`SSE` (Server-Sent Events over HTTP):** Streaming remote connection used by cloud-hosted agent swarms (LangGraph, n8n).

---

## 4. Self-Hosting Options

Because the application is a standard Next.js 15 TypeScript codebase, it can be deployed anywhere Node.js runs.

### Option A: Vercel (Zero-Config Serverless)
Ideal for small teams and rapid iteration:
* **Frontend & Webhooks:** Deployed as serverless functions on Vercel.
* **Database:** Connects directly to Polygres via connection string in environment variables.
* **MCP Access:** Use `stdio` on your local laptop for Claude Desktop / Cursor pointing to your Polygres database, or deploy the remote SSE route on Vercel.

### Option B: Railway / Coolify / VPS (Docker Container)
Ideal for teams that want a single persistent server:
* Run the provided `Dockerfile` on Railway, Coolify, Render, or any $5/mo VPS.
* Exposes the web UI on port `3000` and the remote MCP SSE endpoint at `/api/mcp/sse`.

```dockerfile
# Production Dockerfile
FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

EXPOSE 3000
CMD ["pnpm", "start"]
```

---

## 5. Environment Configuration

Create a `.env` file with credentials:

```bash
# 1. Polygres Database Connection String (Direct or Pooler)
DATABASE_URL=postgres://postgres:password@db.polygres.com:5432/crm

# 2. Polygres Runtime API (Found in Polygres Console under "Connect")
POLYGRES_API_KEY=poly_live_your_project_key_here
POLYGRES_RUNTIME_URL=https://runtime.polygres.com

# 3. Optional Ingestion Secrets
POSTHOG_WEBHOOK_SECRET=your_posthog_secret
```

---

## 6. Developer Deployment Walkthrough

```bash
# 1. Clone the repository
git clone <repo-url> my-crm
cd my-crm

# 2. Install dependencies
pnpm install

# 3. Set up environment variables
cp .env.example .env
# Edit .env and enter your DATABASE_URL and POLYGRES_API_KEY

# 4. Push the 5 schemas to Polygres
pnpm db:push

# 5. Connect Claude Desktop (Local stdio)
# Add to ~/Library/Application Support/Claude/claude_desktop_config.json:
# {
#   "mcpServers": {
#     "my-crm": {
#       "command": "pnpm",
#       "args": ["mcp"],
#       "cwd": "/path/to/my-crm",
#       "env": {
#         "DATABASE_URL": "...",
#         "POLYGRES_API_KEY": "..."
#       }
#     }
#   }
# }

# 6. Start the CRM development server
pnpm dev
```

---

## 7. Strategic Advantages of this Setup

1. **Zero SaaS Overhead:** No monthly per-seat charges or licensing fees.
2. **Unified Data & Vector Infrastructure:** Polygres manages both relational tables and high-dimensional vector/graph indexes inside PostgreSQL.
3. **Future-Proof Agent Compatibility:** Works with any MCP-compliant client today (Claude, Cursor) and any multi-agent framework tomorrow without rewriting backend code.
4. **Strict Human Oversight:** High-risk mutations (deal stage progression, cold outreach) are caught by the CRM's approval queue before taking effect.
