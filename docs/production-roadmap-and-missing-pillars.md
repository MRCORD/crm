# Production Roadmap: The 6 Missing Pillars from Architecture to Reality

This document bridges the gap between the core architecture (PostgreSQL schemas + Polygres + MCP Server) and a **production-ready, killer CRM boilerplate**. It details the 6 operational pillars required to deploy this CRM in high-growth companies.

---

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                       THE 6 PRODUCTION PILLARS                                         │
├───────────────────────────────────────┬────────────────────────────────────────────────────────────────┤
│ 1. Ambient Ingestion Engine           │ Headless meeting bots (Recall.ai), two-way Gmail/Outlook sync  │
│ 2. Interactive HITL Notification Loop │ Interactive Slack / Discord approval cards for MCP tool calls  │
│ 3. Guardrails & Simulation Mode       │ Dry-run tool execution, PII masking, deterministic Zod gates   │
│ 4. Analytical Views & Reporting       │ Pre-built SQL funnel views & executive MCP analytics resources │
│ 5. Multi-Channel Outbound             │ Resend transactional email + WhatsApp speed-to-lead (Kapso)    │
│ 6. Developer Experience & Seeding     │ One-click mock seed data (pnpm db:seed) & Claude Desktop config│
└───────────────────────────────────────┴────────────────────────────────────────────────────────────────┘
```

---

## Pillar 1: Ambient Data Ingestion (Zero-Entry Pipeline)

The primary reason CRMs fail is **manual rep data entry friction**. An agentic CRM must capture 90%+ of its context invisibly from the background.

```
Incoming Meeting Invite / Zoom Call / Email
                    │
                    ▼
      Ingestion Gateway (/api/webhooks)
                    │
   ┌────────────────┴────────────────┐
   ▼                                 ▼
Meeting Audio Pipeline             Email Sync Pipeline
(Recall.ai / Zoom Webhooks)        (Gmail / Outlook OAuth / Resend)
   │                                 │
   ▼                                 ▼
Speech-to-Text (Deepgram Nova-2)   HTML/Text & Thread Parser
   │                                 │
   └────────────────┬────────────────┘
                    │
                    ▼
          Entity Auto-Linker
  Matches attendee emails against crm.people & crm.companies
                    │
                    ▼
    Atomic Polygres Ingestion (reconcileContext: true)
  Inserts into retrieval.interaction_transcripts with vectors
```

### 1.1. Meeting Bot Integration (Recall.ai / Zoom Server-to-Server)
* Connect via **Recall.ai** or Zoom Webhook:
  * When a calendar event starts, a headless bot automatically joins the Zoom / Google Meet / Teams call.
  * Streams raw audio to a speech-to-text model (Deepgram Nova-2 or Whisper).
* **Speaker Diarization:** Distinguishes between internal sales reps and external buyer attendees.
* **Auto-Linking:** Matches attendees against `crm.people` using their invite email addresses. If a contact does not exist, the system creates them under the matching company domain.

### 1.2. Two-Way Email Synchronization
* Use **Resend Inbound Webhooks** or Google Workspace Service Account:
  * Ingest incoming emails sent to reps or shared inboxes (`sales@`, `support@`).
  * Strip email signatures and disclaimers.
  * Store in `retrieval.interaction_transcripts` (`channel: 'EMAIL'`) and trigger the Outbox pattern.

---

## Pillar 2: Interactive Human-in-the-Loop (Slack & Mobile)

When an external MCP client (Claude Desktop, Cursor, or an autonomous Python swarm) attempts a high-risk mutation (e.g. `crm_update_opportunity_stage` to `CLOSED_WON` or sending an email to a VIP), the CRM intercepts the action and creates an approval request in `mcp.mcp_approvals`.

Reps should **not have to open the web CRM** to approve it.

```
Agent Calls MCP Tool ──► Risk Tier 4 Detected ──► Insert into mcp.mcp_approvals
                                                        │
                                                        ▼
                                           Dispatch Slack Webhook Card
                                           • Account: Acme Corporation
                                           • Action: Move to CLOSED_WON
                                           • Proposed Note / Reason: "..."
                                                        │
                                       ┌────────────────┴────────────────┐
                                       ▼                                 ▼
                               [Click: APPROVE]                  [Click: REJECT]
                                       │                                 │
                                       ▼                                 ▼
                         Update mcp.mcp_approvals           Update status to REJECTED
                         Status = APPROVED                  Agent aborts mutation
                         Agent resumes execution
```

### Slack Interactive Block Kit Payload
The CRM posts an interactive message to `#sales-approvals`:
```json
{
  "text": "🚨 Action Required: Agent requests approval",
  "blocks": [
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "*Agent Approval Request #123*\n*Action:* Move Opportunity to `CLOSED_WON`\n*Target:* Acme Corporation ($120,000 ARR)\n*Agent Rationale:* 'Sarah Connor confirmed CFO sign-off in Zoom call.'"
      }
    },
    {
      "type": "actions",
      "elements": [
        {
          "type": "button",
          "text": { "type": "plain_text", "text": "Approve ✅" },
          "style": "primary",
          "value": "approve_123"
        },
        {
          "type": "button",
          "text": { "type": "plain_text", "text": "Reject ❌" },
          "style": "danger",
          "value": "reject_123"
        }
      ]
    }
  ]
}
```

---

## Pillar 3: Agent Guardrails & Simulation ("Dry Run") Mode

To protect company data from hallucinating models or corrupted inputs, the CRM acts as a **strict execution firewall**.

### 3.1. Deterministic Zod Parameter Validation
Every MCP tool validates parameters before touching the database:
* E.g., `amountMicros` must be a positive integer.
* Emails must match RFC 5322 regex.
* Stage transitions must obey the state machine (cannot jump from `DISCOVERY` to `CLOSED_WON` without an intermediate stage unless approved).

### 3.2. Simulation / Dry Run Parameter
Every mutating MCP tool supports a `dryRun: boolean` parameter:
```typescript
{
  "dryRun": true,
  "opportunityId": "acme_deal_id",
  "newStage": "PROPOSAL"
}
```
When `dryRun: true` is passed, the tool:
1. Validates all inputs and foreign keys.
2. Checks user permissions and risk tiers.
3. Computes the resulting state without writing to PostgreSQL.
4. Returns:
   ```json
   {
     "simulated": true,
     "wouldMutate": "crm.opportunities",
     "diff": { "stage": { "from": "DISCOVERY", "to": "PROPOSAL" } },
     "requiresApproval": false
   }
   ```
This allows agents to plan and self-reflect before making actual changes.

---

## 4. Analytical Views & Executive Reporting

Executives and sales managers require real-time pipeline visibility. Instead of complex application-level filtering, create **optimized SQL Views in the `crm` schema**:

```sql
-- 1. Pipeline Funnel Aggregation View
CREATE OR REPLACE VIEW crm.pipeline_funnel_view AS
SELECT 
    stage,
    COUNT(id) AS deal_count,
    COALESCE(SUM(amount_micros) / 1000000, 0) AS total_amount_usd,
    ROUND(AVG(health_score), 2) AS average_health_score
FROM crm.opportunities
WHERE deleted_at IS NULL
GROUP BY stage
ORDER BY 
    CASE stage
        WHEN 'DISCOVERY' THEN 1
        WHEN 'PROPOSAL' THEN 2
        WHEN 'NEGOTIATION' THEN 3
        WHEN 'CLOSED_WON' THEN 4
        WHEN 'CLOSED_LOST' THEN 5
        ELSE 6
    END;

-- 2. Deal Velocity & Stale Deals View
CREATE OR REPLACE VIEW crm.stale_deals_view AS
SELECT 
    o.id,
    o.name AS deal_name,
    c.name AS company_name,
    o.stage,
    o.amount_micros / 1000000 AS amount_usd,
    o.updated_at,
    NOW() - o.updated_at AS days_inactive
FROM crm.opportunities o
JOIN crm.companies c ON o.company_id = c.id
WHERE o.deleted_at IS NULL 
  AND o.stage NOT IN ('CLOSED_WON', 'CLOSED_LOST')
  AND o.updated_at < NOW() - INTERVAL '30 days';
```

These views are exposed as **live MCP resources** (`crm://analytics/funnel` and `crm://analytics/stale-deals`), allowing models to provide instant executive summaries.

---

## 5. Multi-Channel Outbound (WhatsApp & Email)

In modern GTM, relying on email alone leads to poor response rates.

### 5.1. Transactional Email via Resend
* Direct integration with the **Resend API**:
* Fast, high-deliverability email dispatching with open/click tracking.
* Webhook feedback routes directly into `retrieval.interaction_transcripts`.

### 5.2. Conversational Speed-to-Lead via WhatsApp (Kapso / Meta Cloud API)
* When an inbound lead requests a demo from LATAM, EMEA, or APAC:
* The CRM's MCP server can call a WhatsApp dispatch tool.
* Engages the prospect directly on mobile in under 30 seconds to confirm meeting availability.

---

## 6. Developer Experience & Instant Seeding

To ensure anyone testing or developing this CRM can experience its full capabilities immediately, the boilerplate includes **`src/db/seed.ts`**:

```bash
# Populate realistic mock data in 2 seconds
pnpm db:seed
```

### What is Included in the Seed Data
* **3 Sample Companies:** Acme Corp ($25M ARR), Cyberdyne Systems ($95M ARR), Stark Industries ($500M ARR).
* **3 Contacts:** Sarah Connor, Miles Dyson, Pepper Potts.
* **3 Opportunities:** Ranging from $120k to $1.5M with varying pipeline stages and health scores.
* **Real Commercial Listing:** Custom Object record demonstrating dynamic entity modeling.
* **Real Zoom Transcript:** Sarah Connor discussing SOC2 Type II compliance requirements and CFO budget sign-offs.

### Instant Testing with Claude Desktop

Run:
```bash
pnpm mcp
```
Open Claude Desktop and ask:
> *"What did Sarah Connor say about our SOC2 compliance in her recent call, and what are the open action items on the Acme opportunity?"*

Claude Desktop calls `polygres_graph_search` and `crm_get_company`, delivering an immediate, accurate briefing grounded in PostgreSQL.

---

## 7. Recommended Implementation Order

| Priority | Feature | Complexity | Impact |
| :--- | :--- | :--- | :--- |
| **P0** | Drizzle Schemas + Polygres Retrieval Setup | Done | Critical Foundation |
| **P0** | MCP Server (Tools, Resources, Prompts) | Done | AI Interoperability |
| **P0** | Instant Mock Database Seeder (`pnpm db:seed`) | Done | Developer Experience |
| **P1** | Next.js Dashboard UI (Kanban, Company 360, HITL Inbox) | Medium | Visual Interface |
| **P1** | Inbound Call Transcript Webhook Ingest (Recall.ai) | Low | Ambient Zero-Entry |
| **P2** | Interactive Slack Approval Card Integration | Low | Mobile Rep Experience |
| **P2** | PostHog Webhook Telemetry Ingest | Low | Product-Qualified Leads |
| **P3** | WhatsApp Messaging Integration (Kapso) | Medium | Omnichannel Reach |
