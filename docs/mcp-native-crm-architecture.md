# MCP-Native CRM Platform Architecture

This document details the architectural pivot of this CRM from a monolithic, self-contained AI agent to an **open Model Context Protocol (MCP) Server and Intelligence Platform**.

---

## 1. Why Pivot from "Agent" to "MCP Server"?

Traditional attempts to build "AI CRMs" embed a proprietary LLM loop and hardcoded prompts inside the CRM application. This creates four major problems:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                 THE MONOLITHIC AGENT TRAP                              │
├───────────────────────────────────────────┬────────────────────────────────────────────┤
│     Monolithic In-House Agent             │       MCP-Native CRM Server (Our Approach) │
├───────────────────────────────────────────┼────────────────────────────────────────────┤
│ • Locks users into one vendor's prompt     │ • "Bring Your Own Agent" (BYOA): Connect   │
│   and rigid agent state machine.          │   Claude Desktop, Cursor, LangGraph, n8n.  │
│ • Rapidly becomes obsolete as new models, │ • Standardized JSON-RPC protocol backed    │
│   reasoning frameworks, and tools ship.   │   by Anthropic's open MCP SDK.             │
│ • High engineering maintenance: token     │ • CRM focuses on what it does best: Data,  │
│   limits, retry loops, context caching.   │   Relational Graph, Search & Governance.   │
│ • Cannot be controlled from developer     │ • Sales reps and engineers can query their │
│   tools (Cursor, terminal, desktop app).  │   CRM directly from IDEs or desktop apps.  │
└───────────────────────────────────────────┴────────────────────────────────────────────┘
```

By adopting **Anthropic's Model Context Protocol (MCP)**—the emerging enterprise standard adopted by Salesforce and HubSpot—the CRM acts as **The System of Record, Grounding Engine & Safety Gateway**, while allowing any client or agent to orchestrate the reasoning.

---

## 2. The Three Primitives of the CRM MCP Server

The CRM exposes its data, hybrid retrieval, and business operations through the three standard MCP primitives:

```
                                     MODEL CONTEXT PROTOCOL
                                               │
             ┌─────────────────────────────────┼─────────────────────────────────┐
             ▼                                 ▼                                 ▼
         MCP TOOLS                       MCP RESOURCES                      MCP PROMPTS
    (Callable Actions)                  (Live Read Context)             (Pre-Built Workflows)
  • crm_search_companies              • crm://pipeline/summary          • pre_call_dossier
  • crm_get_company                   • crm://companies/{id}            • deal_risk_review
  • crm_create_company                • crm://transcripts/{id}
  • crm_update_opportunity_stage
  • crm_log_meeting_transcript
  • polygres_graph_search
  • polygres_joint_search
  • polygres_recommend_lookalikes
```

### 2.1. MCP Tools (Functions Callable by External Models)

Tools allow external models (Claude, Cursor, LangGraph) to query and mutate CRM state with strict type validation via Zod schemas:

1. **`crm_search_companies`**: Search accounts by name, domain, or industry.
2. **`crm_get_company`**: 360-degree account view (contacts, active deals, notes, and call transcripts).
3. **`crm_create_company`**: Create new accounts with validated fields.
4. **`crm_update_opportunity_stage`**: Pipeline stage progression. Gated by risk tiers (moving to `CLOSED_WON` automatically routes to the approval queue).
5. **`crm_log_meeting_transcript`**: Logs meeting audio/transcripts with atomic Polygres vector and graph index reconciliation.
6. **`polygres_graph_search`**: Entity-anchored semantic search (`graphFirst`) navigating from `crm.companies` into connected notes and transcripts.
7. **`polygres_joint_search`**: Tri-lane search co-ranking dense vector, exact lexical (`tsvector`), and graph proximity around an opportunity.
8. **`polygres_recommend_lookalikes`**: Vector math over closed-won vs. churned deals to identify lookalike target accounts.

---

### 2.2. MCP Resources (Standardized Read-Only URIs)

Resources provide static and dynamic read-only data that models can attach directly into their context window:

* **`crm://pipeline/summary`**: Aggregates all open opportunities by stage, calculating total deal counts and weighted pipeline value.
* **`crm://companies/{id}`**: Resolves an entire company entity graph (contacts, opportunities, transcripts) into clean JSON.
* **`crm://transcripts/{id}`**: Delivers the raw transcript, executive summary, and action items of a sales meeting.

---

### 2.3. MCP Prompts (Pre-Packaged Agent Workflows)

Prompts are reusable templates that clients can invoke with arguments:

* **`pre_call_dossier(companyId)`**: Guides the model to call `crm_get_company` and `polygres_graph_search` to synthesize an executive 1-page pre-flight meeting briefing.
* **`deal_risk_review(opportunityId)`**: Prompts the model to execute a `polygres_joint_search` for blockers, competitor mentions, and sentiment drops to generate an objective forecast check.

---

## 3. Governance, Audit Ledger & Human-in-the-Loop (HITL)

Every tool call entering the CRM via MCP passes through a **Governance Gateway**:

```
External Agent (Claude / Cursor)
               │
               ▼ Calls MCP Tool
┌──────────────────────────────────────────────┐
│             CRM MCP GATEWAY                  │
│                                              │
│  1. Validate Parameters via Zod Schema       │
│  2. Check Client Permissions (mcp_clients)   │
│  3. Evaluate Risk Tier:                      │
│     ├── Tier 1-2: Execute immediately        │
│     └── Tier 3-4: Intercept & require approval
└──────────────────────┬───────────────────────┘
                       │
       ┌───────────────┴───────────────┐
       ▼                               ▼
 [Tier 1/2 Action]             [Tier 3/4 Action]
 Execute on PostgreSQL         Pause & Insert into
 & Polygres                    mcp.mcp_approvals
       │                               │
       ▼                               ▼
 Log Execution Receipt         Return "PENDING_APPROVAL"
 in mcp_tool_call_receipts     to calling Agent
```

### The `mcp` Schema Tables

1. **`mcp.mcp_clients`**: Registry of connected external agents and tools (`client_type: 'STDIO' | 'HTTP_SSE'`, allowed tools, API keys).
2. **`mcp.mcp_tool_call_receipts`**: Immutable audit log of every tool execution:
   * `tool_name`
   * `tool_input` and `tool_output`
   * `target_object` and `target_record_id`
   * `duration_ms`
   * `status` (`SUCCESS`, `FAILED`, `WAITING_FOR_APPROVAL`)
3. **`mcp.mcp_approvals`**: The Human-in-the-Loop approval queue for actions like changing a deal stage, deleting records, or sending cold outreach.

---

## 4. Connecting External Clients

### 4.1. Claude Desktop Connection (`stdio`)

Add the CRM MCP server to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "my-crm": {
      "command": "tsx",
      "args": ["/Users/oscar-rivas/Github/00ACTIVE/mysios/crm/src/mcp/stdio.ts"],
      "env": {
        "DATABASE_URL": "postgres://postgres:postgres@localhost:5432/crm",
        "POLYGRES_API_KEY": "poly_live_...",
        "POLYGRES_RUNTIME_URL": "https://runtime.polygres.com"
      }
    }
  }
}
```

Once added, Claude Desktop will show the hammer icon with all CRM and Polygres tools available for interactive conversations.

### 4.2. Cursor / Windsurf IDE Connection

Add the command to `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "crm": {
      "command": "pnpm",
      "args": ["mcp"]
    }
  }
}
```

Developers can ask Cursor:
> *"What are the open blockers on our top 3 enterprise opportunities? Use crm_pipeline_summary and polygres_joint_search."*

### 4.3. Autonomous Multi-Agent Swarms (LangGraph / CrewAI)

Custom Python or TypeScript multi-agent swarms connect to the CRM over standard MCP HTTP/SSE transport, delegating tool execution to the CRM server while orchestrating complex multi-day workflows externally.
