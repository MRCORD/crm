# Cloudflare MCP Portals: Unified Gateway for All CRM Tools

**Cloudflare MCP Portals** (formerly called "Agents Gateway" in internal Cloudflare codebases, still uses `agents_gateway`/`agw` in API paths and Terraform) is a product under **Cloudflare Zero Trust → Access controls → MCP Portals**.

It solves the fundamental deployment problem of an MCP-native CRM: instead of each user needing to configure multiple MCP server entries in Claude Desktop or Cursor, a Portal provides **one authenticated HTTPS endpoint** that proxies and aggregates all servers behind SSO.

---

## What Cloudflare MCP Portals Do

```
WITHOUT A PORTAL                          WITH A CLOUDFLARE MCP PORTAL
────────────────────────────────          ──────────────────────────────────────────
claude_desktop_config.json:               claude_desktop_config.json:

{                                         {
  "mcpServers": {                           "mcpServers": {
    "crm": {                                  "work": {
      "command": "pnpm",                        "command": "npx",
      "args": ["mcp"],                          "args": [
      "cwd": "/path/to/crm"                       "mcp-remote",
    },                                            "https://crm-portal.acme.com/mcp"
    "granola": {                                ]
      "type": "http",                       }
      "url": "https://mcp.granola.ai/mcp"  }
    },
    "stripe": {
      "type": "http",
      "url": "https://mcp.stripe.com/mcp"
    }
  }
}
```

One URL. One login. All servers.

---

## Key Features

| Feature | What It Means for Us |
| :--- | :--- |
| **Aggregate N MCP servers** | Our CRM server + Granola + Stripe + Slack all behind `/mcp` |
| **Single SSO login** | Users authenticate once (Google/Okta/GitHub); portal handles per-server OAuth silently |
| **Per-portal tool curation** | Hide dangerous tools from interns; show everything to admins — no code changes upstream |
| **Tool & prompt aliases** | Rename `crm_search_companies` → `find_accounts` at the portal level without touching source |
| **Full audit logging** | Every tool call logged with user identity, timestamp, input payload |
| **DLP scanning** | Route through Cloudflare Gateway to prevent exfiltration of customer data via AI |
| **Service tokens** | Machine-to-machine access for LangGraph/n8n swarms — no browser OAuth required |
| **Code Mode** | Collapses all tools into search + execute — large tool sets no longer blow the context window |
| **Built-in portal tools** | `portal_list_servers`, `portal_toggle_servers` — users can toggle servers without reconfiguring |

---

## Per-User Account Authentication: The Critical Detail

Each server in the portal has a **"Require user auth"** toggle. This controls whether each user connects their **own** upstream account or shares a team credential.

```
User: sarah@acme.com logs into the portal (company Google SSO)
                    │
    ┌───────────────┼───────────────────┬────────────────────┐
    ▼               ▼                   ▼                    ▼
Granola MCP      Our CRM MCP        Stripe MCP          Slack MCP
Require auth ON  Require auth ON    Require auth OFF    Require auth OFF
    │               │                   │                    │
Sarah's own      Sarah's own        Shared company       Shared company
Granola acct     CRM session        Stripe API key       Slack bot token
(her meetings)   (her access level)
```

### "Require user auth: ON" — Each person uses their own account

On first connection, the portal silently redirects the user through the upstream server's OAuth flow in the background. The token is stored and auto-refreshed. The user never sees this again.

**When to use:** Personal data sources where isolation is critical.

| Server | Why per-user auth? |
| :--- | :--- |
| **Granola MCP** | Sarah sees her own meeting notes. Miles sees his. No cross-rep visibility. |
| **Our CRM MCP** | User identity propagates into the CRM for row-level access, audit receipts, and `mcp.mcp_approvals` routing. |
| **Gmail / Calendar** | Each rep's email and calendar remains private. |
| **GitHub** | Commits and PRs are attributed to the right person. |

### "Require user auth: OFF" — All users share the admin credential

The admin credential set during portal setup is used for every user. No per-user OAuth prompt.

**When to use:** Company-wide shared resources.

| Server | Why shared credential? |
| :--- | :--- |
| **Stripe MCP** | One company Stripe account; every authorized user can query it. |
| **Notion MCP** | Shared team workspace; no per-person isolation needed. |
| **Slack MCP** | Bot token acting as a service; not a personal account. |

### Bottom Line

The portal handles complexity so users don't have to. A rep visits the portal URL once, clicks "Authorize" per personal service (Granola, CRM), and is done permanently. Shared services (Stripe, Slack) just work. Claude Desktop sees all of it through one entry in its config.

## How the Request Flow Works

```
Claude Desktop / Cursor / LangGraph Swarm
               │
               │  POST https://crm-portal.acme.com/mcp
               │  Authorization: Bearer <Cloudflare Access token>
               ▼
┌─────────────────────────────────────────────────┐
│          CLOUDFLARE MCP PORTAL                  │
│  (Zero Trust → Access controls → MCP Portals)   │
│                                                 │
│  1. Validates identity via Cloudflare Access    │
│  2. Resolves tool namespace → upstream server   │
│  3. Attaches per-server OAuth credentials       │
│  4. Proxies request                             │
│  5. Logs call (user, tool, input, timestamp)    │
│  6. Optionally routes through Gateway for DLP   │
└────────────┬──────────────────────┬─────────────┘
             │                      │
             ▼                      ▼
  Our CRM MCP Server          Granola MCP Server
  (Workers or VPS)            (mcp.granola.ai/mcp)
  crm_search_companies        list_meetings
  polygres_graph_search       get_meeting_transcript
  crm_update_opportunity_...  extract_action_items
```

---

## Tool Namespacing

When multiple servers expose tools behind the same portal, the portal **namespaces** tool names by server ID to avoid collisions:

```
crm.crm_search_companies       ← from our CRM server (server ID: "crm")
granola.list_meetings           ← from Granola server (server ID: "granola")
stripe.list_invoices            ← from Stripe server
```

Admins can set **aliases** at the portal level to give cleaner names to end users and AI agents:

```
crm.crm_search_companies  →  find_accounts
granola.list_meetings      →  my_meeting_history
```

---

## Setting Up: Add Our CRM to a Portal

### Step 1: Deploy the CRM MCP Server to a Public HTTPS URL

The portal needs to reach our MCP server over HTTPS. Options:
- **Cloudflare Workers** (recommended — global edge, zero cold start):
  ```bash
  npx wrangler deploy
  # → https://crm-mcp.your-account.workers.dev/mcp
  ```
- **Railway / Render / VPS** with a public domain and TLS.

For the Workers path, add a `src/mcp/worker.ts` HTTP entry point:
```typescript
import { createMcpHandler } from 'cloudflare-agents';
import { crmToolSchemas, crmToolHandlers } from './tools';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return createMcpHandler((server) => {
      server.tool(
        'crm_search_companies',
        crmToolSchemas.searchCompanies.description,
        crmToolSchemas.searchCompanies.parameters.shape,
        async (args) => ({
          content: [{ type: 'text', text: JSON.stringify(await crmToolHandlers.searchCompanies(args)) }]
        })
      );
      // ... register remaining tools
    })(request, env);
  }
};
```

Secrets injected at deploy time:
```bash
wrangler secret put DATABASE_URL
wrangler secret put POLYGRES_API_KEY
wrangler secret put POLYGRES_RUNTIME_URL
```

### Step 2: Create the MCP Portal in Cloudflare Dashboard

1. **Zero Trust → Access controls → MCP Portals → Add MCP server portal**
2. Name: `Agentic CRM Tools`
3. Domain: `crm-portal.acme.com/mcp` or `crm.your-account.workers.dev/mcp`
4. **Add MCP servers:**
   - `crm` → `https://crm-mcp.your-account.workers.dev/mcp`
   - `granola` → `https://mcp.granola.ai/mcp` (requires user OAuth)
   - `stripe` → `https://mcp.stripe.com/mcp` (requires user OAuth)
5. **Add Access policies:** e.g. `Allow: group = sales-team`
6. **Manage tools per server:** hide `crm_update_opportunity_stage` from non-managers

### Step 3: Users Connect with One URL

```json
// ~/Library/Application Support/Claude/claude_desktop_config.json
{
  "mcpServers": {
    "work": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "https://crm-portal.acme.com/mcp"
      ]
    }
  }
}
```

Users authenticate via their company SSO. Claude Desktop now has access to all CRM + Granola + Stripe tools with a single entry.

---

## Machine-to-Machine: Service Tokens for Agent Swarms

For autonomous agents (LangGraph, n8n, Python scripts) that run without a browser OAuth flow:

1. **Zero Trust → Access controls → Service Tokens → Create Service Token**
2. Note the `CF-Access-Client-Id` and `CF-Access-Client-Secret`
3. Swarm headers each request:
   ```python
   headers = {
     "CF-Access-Client-Id": "your-service-token-id",
     "CF-Access-Client-Secret": "your-service-token-secret",
   }
   response = requests.post(
     "https://crm-portal.acme.com/mcp",
     headers=headers,
     json=mcp_request_payload
   )
   ```

---

## DLP: Preventing Customer Data Leakage

Route portal traffic through **Cloudflare Gateway** to scan for and block exfiltration of sensitive data:

Zero Trust → Gateway → Firewall policies → HTTP → Create a policy:
- **Condition:** Host matches `crm-portal.acme.com`
- **DLP Profile:** Detect `email_address`, `phone_number`, `credit_card`
- **Action:** Log (or Block for high-risk data)

Every tool call that returns customer data from `crm.people` or `crm.companies` is inspected before delivery to the MCP client.

---

## Comparison: Without vs. With Portal

| Dimension | stdio / Local | Self-Hosted HTTPS | **Cloudflare MCP Portal** |
| :--- | :--- | :--- | :--- |
| **User setup complexity** | Clone repo + pnpm mcp | Add server URL to Claude config | **One URL per team** |
| **Authentication** | None (local process) | Custom OAuth per server | **Cloudflare Access SSO** |
| **Multi-server access** | Multiple config entries | Multiple config entries | **One entry, all servers** |
| **Audit trail** | `mcp_tool_call_receipts` table | Application logs | **Cloudflare Access logs + DLP** |
| **Access policies** | None | Custom middleware | **Zero Trust policies** |
| **Agent swarm access** | Local only | Bearer tokens per server | **Service tokens** |
| **Deployment effort** | Zero | Low | **Low (Workers + dashboard config)** |
