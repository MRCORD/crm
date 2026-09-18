# Cloudflare MCP Infrastructure: Remote Servers, Portals & Governance

Cloudflare has built the most complete MCP infrastructure layer available today. It covers three distinct products that directly change how we should deploy and govern the CRM's MCP server.

---

## 1. The Three Cloudflare MCP Products

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                 CLOUDFLARE MCP INFRASTRUCTURE                                           │
├──────────────────────────────────┬───────────────────────────────┬────────────────────────────────────── │
│   Workers Agents SDK             │   Cloudflare Access           │   MCP Server Portals                  │
│   (Build Remote MCP Servers)     │   (Secure MCP Servers)        │   (Aggregate & Govern MCP Servers)    │
├──────────────────────────────────┼───────────────────────────────┼──────────────────────────────────────┤
│ Deploy any MCP server to         │ Put Cloudflare Access in       │ Combine many MCP servers onto a       │
│ Workers (Streamable HTTP).       │ front of a remote MCP server   │ single authenticated HTTP endpoint.   │
│ Authless or OAuth via GitHub,    │ as its OAuth provider.         │ Curate tool sets per user, log        │
│ Google, Auth0, WorkOS, Okta.     │ Zero Trust policy enforcement. │ every tool call, DLP scanning.        │
├──────────────────────────────────┼───────────────────────────────┼──────────────────────────────────────┤
│ cloudflare/ai Agents SDK         │ Zero Trust → Access controls   │ Zero Trust → Access controls          │
│ developers.cloudflare.com/agents │ → AI controls → secure-mcp     │ → AI controls → MCP Portals           │
└──────────────────────────────────┴───────────────────────────────┴──────────────────────────────────────┘
```

---

## 2. MCP Server Portals (The "Gateway" You're Thinking Of)

**What it is:** Cloudflare MCP server portals (formerly called "Agents Gateway" internally) provide a **single authenticated HTTP endpoint** that proxies and aggregates multiple upstream MCP servers. Previously referenced in some Cloudflare codebases as `agents_gateway` or `agw`.

**Key capabilities:**

| Capability | Detail |
| :--- | :--- |
| **Aggregate N servers** | Add Granola, our CRM, Salesforce, HubSpot, Stripe — all behind one `/mcp` URL. |
| **Single-login for all tools** | User authenticates once through Cloudflare Access/SSO; portal handles per-server OAuth. |
| **Per-portal tool curation** | Hide individual tools from specific portals — no code changes on upstream servers. |
| **Tool & prompt aliases** | Rename tools (e.g. `crm_search_companies` → `find_accounts`) without modifying source. |
| **Built-in portal tools** | `portal_list_servers`, `portal_toggle_servers`, `portal_toggle_single_server` — users can toggle which servers are active. |
| **Full audit logging** | Every tool call logged. Optionally route through Cloudflare Gateway for DLP. |
| **MCP governance** | Admins set policies on which users see which MCP servers and tools. |
| **Service tokens** | Machine-to-machine access (e.g. from LangGraph swarms) without OAuth browser flow. |
| **Code Mode** | Collapses all tools into two (search + execute) — dramatic context window reduction for large tool sets. |

### Portal Flow
```
MCP Client (Claude Desktop / Cursor / Python Swarm)
         │
         │  Single authenticated request to one URL
         ▼
https://crm-portal.mycompany.com/mcp   ← Cloudflare MCP Portal
         │ Cloudflare Access SSO verification
         │
         ├──► Our CRM MCP Server       (reads/writes crm.companies, polygres search)
         ├──► Granola MCP Server       (reads meeting notes, transcripts)
         ├──► Stripe MCP Server        (reads billing, invoices)
         └──► Slack MCP Server         (reads/writes messages, channels)
```

Claude Desktop config becomes a **single entry**:
```json
{
  "mcpServers": {
    "company-tools": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "https://crm-portal.mycompany.com/mcp"
      ]
    }
  }
}
```

---

## 3. Deploying Our CRM MCP Server to Cloudflare Workers

Instead of `pnpm mcp` running on a local machine or a self-hosted VPS, the MCP server can be deployed as a Cloudflare Worker with global edge presence, automatic TLS, and zero cold-start latency.

### Setup (from Cloudflare template)
```bash
pnpm create cloudflare@latest crm-mcp-server \
  --template=cloudflare/ai/demos/remote-mcp-github-oauth
```

### What Changes in Our Boilerplate

The current `src/mcp/stdio.ts` uses **stdio transport** (for local Claude Desktop):
```typescript
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
```

For Cloudflare Workers, the transport switches to **Streamable HTTP**:
```typescript
import { createMcpHandler } from 'cloudflare-agents';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const handler = createMcpHandler((server) => {
      // Register all existing tools from src/mcp/tools.ts
      server.tool('crm_search_companies', ...);
      server.tool('polygres_graph_search', ...);
      // ...
    });
    return handler(request, env);
  }
};
```

Worker environment variables replace `.env`:
```bash
wrangler secret put DATABASE_URL
wrangler secret put POLYGRES_API_KEY
wrangler secret put POLYGRES_RUNTIME_URL
```

Deploy:
```bash
npx wrangler deploy
# MCP server live at: https://crm-mcp.your-account.workers.dev/mcp
```

---

## 4. MCP Governance: What Cloudflare Access Adds

Connecting the CRM MCP server directly to Cloudflare Access creates **enterprise-grade governance**:

### Authentication Options
- **GitHub OAuth**: Dev-team access — engineers authorize with their GitHub account.
- **Google OAuth**: Sales team access — reps sign in with their work Google account.
- **Okta / WorkOS / Auth0**: Enterprise SSO — SAML, OIDC, directory sync.
- **Cloudflare Access service tokens**: For autonomous Python/Node agent swarms (no browser flow needed).

### Access Policies
```
IF user is in group "sales-team"
THEN allow tools: crm_search_companies, crm_get_company, polygres_graph_search
BUT NOT: crm_update_opportunity_stage (requires manager approval)
```

### Full Audit Trail
Every MCP tool call through the portal is logged in Cloudflare Access with:
- Timestamp, tool name, user identity, input payload
- Optionally routed through Cloudflare Gateway for HTTP logging + DLP scanning (prevent exfiltration of sensitive account data via AI)

---

## 5. Architectural Decision: What This Changes for Our CRM

| Question | Before (stdio) | With Cloudflare Workers + Portal |
| :--- | :--- | :--- |
| **Who can use the CRM MCP?** | Only the local machine operator | Any authenticated team member from any device |
| **How does a rep access it?** | `pnpm mcp` on their laptop | One URL in Claude Desktop / Cursor |
| **What secures it?** | Local process, no auth | Cloudflare Access (SSO, MFA, device policies) |
| **Can LangGraph swarms call it?** | Only locally | Yes, via service token over HTTPS |
| **Can I mix Granola + CRM tools?** | Two separate config entries | One portal URL, curated tool set |
| **Can I audit all tool calls?** | Only manual logging in `mcp_tool_call_receipts` | Cloudflare Access logs + DLP gateway |
| **Deployment complexity** | Zero — just run locally | `wrangler deploy` — still minimal |

---

## 6. Recommended Deployment Path

```
Phase 1 (Now / Local Dev)         Phase 2 (Team Rollout)              Phase 3 (Enterprise)
─────────────────────────         ──────────────────────              ────────────────────
stdio (pnpm mcp)                  Workers remote MCP server           MCP Portal (Access)
Single user, local machine        HTTPS, global edge, GitHub OAuth    All servers unified,
                                                                       SSO, DLP, audit logs
```

For the boilerplate, `Phase 2` requires adding:
1. A `src/mcp/worker.ts` HTTP handler using `createMcpHandler()`.
2. A `wrangler.jsonc` with secrets bound to the Worker.
3. A single `wrangler deploy` to Cloudflare.

The tools, resources, and prompts in `src/mcp/tools.ts`, `resources.ts`, and `prompts.ts` require zero changes.
