# Meeting App Integrations & How CRMs Handle Call Intelligence

This document maps the landscape of meeting intelligence tools, their integration patterns with CRMs, and what this specifically means for our MCP-native agentic CRM boilerplate.

---

## 1. The Landscape: Three Distinct Architectures

Meeting apps and CRMs integrate through three distinct technical architectures. Understanding which category each tool belongs to determines exactly what we need to build.

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                           THREE MEETING INTELLIGENCE ARCHITECTURES                                      │
├─────────────────────────────────┬────────────────────────────────┬────────────────────────────────────── │
│   ARCH 1: DEVICE AUDIO CAPTURE  │   ARCH 2: CLOUD BOT (Join URL) │   ARCH 3: NATIVE PLATFORM API        │
│   (No bot in the call)          │   (Visible "Notetaker" in call) │   (Platform builds it in)            │
├─────────────────────────────────┼────────────────────────────────┼──────────────────────────────────────┤
│   • Granola                     │   • Recall.ai                  │   • Zoom AI Companion                 │
│   • Shadow.do                   │   • Fireflies.ai               │   • Google Meet Transcription API     │
│   • Plaud AI                    │   • Otter.ai (OtterPilot)      │   • MS Teams Transcription (Graph)    │
│                                 │   • Fathom                     │   • Nylas Notetaker API               │
│                                 │   • Nylas Notetaker API        │                                       │
├─────────────────────────────────┼────────────────────────────────┼──────────────────────────────────────┤
│ Privacy-first; no extra bot.    │ Works on all plans, all users; │ Cleanest but platform-locked;         │
│ User consent conversational.    │ just needs meeting URL.        │ enterprise APIs often gated.          │
└─────────────────────────────────┴────────────────────────────────┴──────────────────────────────────────┘
```

---

## 2. Granola: MCP-Native, Device Audio, Human-Verified

**What it is:** Granola runs locally on a user's laptop or phone, capturing device audio — no bot visible in the call. The user takes rough bullets during the meeting; at the end, they click "Enhance notes" and Granola fills in the structure using the transcript.

**Critical design insight:** Granola's philosophy is **AI capture → human verification → deliberate sync**. No automatic push to CRM without rep review. This is the correct pattern for clean pipeline data.

### 2.1 Granola MCP Tools (native, hosted at `https://mcp.granola.ai/mcp`)

| MCP Tool | Description |
| :--- | :--- |
| `query_granola_meetings` | Chat-style search across all meeting notes |
| `list_meeting_folders` | Browse meeting folder structure (paid only) |
| `list_meetings` | List meetings with date/attendee filters |
| `get_meetings` | Full meeting content including notes, attendees, summary |
| `get_meeting_transcript` | Raw word-by-word transcript with timestamps (paid only) |
| `get_account_info` | Confirm which Granola account is connected to MCP session |

### 2.2 Granola Native CRM Integrations

| CRM | Integration Type | How it Works |
| :--- | :--- | :--- |
| **HubSpot** | Native, manual trigger per note | Settings → Integrations → HubSpot → OAuth. After a meeting, rep clicks "Share to HubSpot" and selects the contact. |
| **Attio** | Native, manual trigger per note | Same flow as HubSpot; maps note to company, person, or deal record. |
| **Affinity** | Native, manual trigger | Built for relationship-tracking CRMs. |
| **Salesforce** | Zapier only (no native connector) | Rep reviews note → triggers Zap → Zap pushes to Salesforce Opportunity, Contact, or Task. |
| **AI Tools (Claude, ChatGPT, Cursor)** | MCP (`https://mcp.granola.ai/mcp`) | Remote HTTP/SSE MCP; OAuth with Granola. Claude can query meeting history directly. |

### 2.3 How Granola Connects to Our CRM via MCP

Our CRM MCP Server and Granola's MCP Server are **peers** — both accessible to the same AI client (Claude Desktop) simultaneously:

```json
// ~/Library/Application Support/Claude/claude_desktop_config.json
{
  "mcpServers": {
    "crm": {
      "command": "pnpm",
      "args": ["mcp"],
      "cwd": "/path/to/crm"
    },
    "granola": {
      "type": "http",
      "url": "https://mcp.granola.ai/mcp"
    }
  }
}
```

Claude can then answer:
> *"Pull my last three meetings with Sarah Connor from Granola, extract any commercial commitments, and create notes + tasks on her CRM opportunity record."*

This is the most immediate, highest-value integration path — zero infrastructure to build.

---

## 3. Recall.ai: Cloud Bot API (The Backend Infrastructure Layer)

**What it is:** Recall.ai is not an end-user app — it is a **B2B API** for product teams who want to embed meeting intelligence in their own applications. You send a POST request with a meeting URL; Recall dispatches a bot that joins as a participant, records audio/video, generates real-time diarized transcripts, and delivers everything back via webhooks.

```
# Send a bot to any Zoom / Meet / Teams meeting:
POST https://api.recall.ai/api/v1/bot
{
  "url": "https://zoom.us/j/74648392",
  "bot_name": "CRM Notes",
  "transcription_options": { "provider": "deepgram" }
}

# Receive live transcript via webhook:
{
  "words": "We really need SOC2 Type II before procurement can sign off.",
  "speaker": "Sarah Connor",
  "timestamp": 84.2
}
```

### 3.1 Recall.ai Technical Capabilities

| Capability | Detail |
| :--- | :--- |
| **Platform support** | Zoom, Google Meet, Microsoft Teams, Webex, Slack Huddles, BlueJeans, GoToMeeting |
| **Works without host** | Yes — bot joins even when the user is not the host, on any plan |
| **Real-time transcription** | Streamed via WebSocket or webhook, word-by-word with speaker diarization |
| **Video/audio recording** | Full recording available post-meeting |
| **Calendar Integration API** | Separate product that reads Google Calendar / Outlook events and auto-dispatches bots |
| **Notetaker API** | Layered product on top of Bot API that delivers formatted summaries and action items |

### 3.2 How Recall.ai Would Integrate with Our CRM

```
1. User has meeting in Google Calendar
         │
         ▼
2. Recall.ai Calendar API detects upcoming meeting with an existing CRM contact
         │
         ▼
3. Recall.ai auto-dispatches a bot to the meeting URL at start time
         │
         ▼
4. Bot streams real-time transcript via Webhook to our /api/webhooks/recall
         │
         ▼
5. Webhook handler:
   • Matches attendee emails to crm.people
   • Calls logCallTranscriptAtomically() → retrieval.interaction_transcripts
   • reconcileContext: true → Polygres indexes immediately
         │
         ▼
6. After meeting: AI post-processing
   • Extract deal stage signals, action items, objections
   • Update crm.opportunities.health_score, crm.tasks
   • Insert ingest.event_outbox entry → triggers agent review
```

---

## 4. How CRMs in General Handle Meeting Data

### 4.1 The Three Ingestion Patterns Used in Production

```
PATTERN A: Bot-Push (Gong, Fireflies, Fathom)
─────────────────────────────────────────────
Meeting ends → Bot generates summary → Automatic push to CRM via native API connector
Pros: Zero rep effort.
Cons: Unverified AI summaries pollute CRM records; reps stop trusting data.

PATTERN B: Human-Verify-Then-Sync (Granola, Scratchpad)
────────────────────────────────────────────────────────
Meeting ends → Rep reviews AI-enhanced note → Rep clicks "Sync to CRM"
Pros: Clean, trusted data; high rep adoption because notes are actually useful.
Cons: Still requires human action; not zero-effort.

PATTERN C: AI-Verify-Then-Sync (What We're Building)
──────────────────────────────────────────────────────
Meeting ends → Transcript arrives in CRM → AI agent analyzes and proposes updates →
Agent waits for approval (mcp.mcp_approvals) → Human approves in Slack → CRM updates
Pros: Zero rep effort AND clean data. The HITL approval is the verification step.
Cons: Requires the approval infrastructure.
```

### 4.2 What Data CRMs Extract from Meetings

Every meeting-to-CRM integration extracts some subset of these data points:

| Data Point | Typical CRM Field | Extraction Method |
| :--- | :--- | :--- |
| **Budget / Deal Size** | `opportunity.amount_micros` | Named entity extraction ("under $240k total") |
| **Close Date / Timeline** | `opportunity.close_date` | Temporal extraction ("Q4 signing target") |
| **Pipeline Stage Signal** | `opportunity.stage` | Intent classification (trial → negotiation → close) |
| **Action Items / Next Steps** | `crm.tasks` | Structured output from LLM |
| **Competitor Mentions** | `interaction_transcripts.competitors_mentioned` | Competitive intelligence extraction |
| **Objections Raised** | `interaction_transcripts.objections_raised` | Structured JSONB array |
| **Stakeholder Sentiment** | `opportunity.health_score` | Sentiment analysis (-1.0 to +1.0) |
| **Executive Commitments** | `crm.notes` | Relationship extraction ("CFO approved") |

### 4.3 Entity Linking: The Core CRM Problem

The hardest part is not transcription — it's **linking the meeting to the right CRM entities**:

```
Attendee: sarah.connor@acme.com
         │
         ├─► Match to crm.people via email? YES → person_id
         │
         ├─► Company via domain? acme.com → crm.companies → company_id
         │
         └─► Active opportunity? crm.opportunities WHERE company_id = acme → opportunity_id
```

All three IDs must resolve before the transcript can be inserted into `retrieval.interaction_transcripts` with proper graph edges.

---

## 5. Full Integration Landscape for Our CRM Boilerplate

```
┌───────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                            MEETING INTEGRATION LANDSCAPE FOR OUR CRM                                  │
├──────────────────────────────────┬─────────────────────────┬───────────────────────────────────────────┤
│ Tool                             │ Integration Mechanism    │ What We Need to Build                    │
├──────────────────────────────────┼─────────────────────────┼───────────────────────────────────────────┤
│ Granola (MCP)                    │ Claude Desktop dual-MCP   │ Nothing. Works immediately.               │
│                                  │ (granola + crm in Claude) │                                           │
├──────────────────────────────────┼─────────────────────────┼───────────────────────────────────────────┤
│ Granola (CRM Sync)               │ Manual review + push     │ Native Granola webhook or Zapier pipe.    │
│                                  │ via Zapier → /api/webhook │ Route verified note to transcript table. │
├──────────────────────────────────┼─────────────────────────┼───────────────────────────────────────────┤
│ Recall.ai (Cloud Bot)            │ REST API + Webhooks      │ POST /api/v1/bot on calendar event;       │
│                                  │ → /api/webhooks/recall   │ webhook handler + entity linker.          │
├──────────────────────────────────┼─────────────────────────┼───────────────────────────────────────────┤
│ Fireflies.ai                     │ Native webhook           │ Configure Fireflies webhook →             │
│                                  │ + Zapier CRM actions     │ /api/webhooks/fireflies endpoint.         │
├──────────────────────────────────┼─────────────────────────┼───────────────────────────────────────────┤
│ Fathom                           │ Zapier or webhook        │ Zapier trigger: "Note finalized" →        │
│                                  │ → /api/webhooks/fathom   │ push to our webhook.                      │
├──────────────────────────────────┼─────────────────────────┼───────────────────────────────────────────┤
│ Google Meet (Native API)         │ Google Workspace API      │ OAuth, poll transcription API after       │
│                                  │ + transcript endpoint    │ meeting ends (30m delay typical).         │
├──────────────────────────────────┼─────────────────────────┼───────────────────────────────────────────┤
│ Zoom (Native)                    │ Zoom Server-to-Server    │ Zoom App with recording.completed         │
│                                  │ OAuth + webhooks         │ event → download transcript → ingest.     │
├──────────────────────────────────┼─────────────────────────┼───────────────────────────────────────────┤
│ Nylas (Unified API)              │ Calendar + Notetaker API  │ Single Nylas token for calendar events   │
│                                  │                           │ + auto-dispatched bots.                   │
└──────────────────────────────────┴─────────────────────────┴───────────────────────────────────────────┘
```

---

## 6. Implementation Priority for This CRM

### Immediate (Zero Code)
The Granola dual-MCP setup — connecting both `granola` and `crm` MCP servers in Claude Desktop. Claude can already:
1. Query Granola for meeting context via `get_meetings`.
2. Search the CRM for the matching company via `crm_get_company`.
3. Log the key notes to the CRM via `crm_log_meeting_transcript`.

### Webhook Ingestion Endpoint (Next Build)
Build a single generic transcript ingestion API route:
```typescript
// POST /api/webhooks/transcript
// Accepts payloads from: Recall.ai, Fireflies, Granola Zapier, Fathom
{
  provider: 'recall' | 'fireflies' | 'granola' | 'fathom',
  meetingUrl: string,
  attendeeEmails: string[],
  transcript: string,
  summary: string,
  actionItems: string[],
}
```

The handler:
1. Resolves attendees against `crm.people` by email.
2. Resolves companies against `crm.companies` by domain.
3. Finds the active opportunity.
4. Calls `logCallTranscriptAtomically()` with `reconcileContext: true`.

One endpoint, any meeting source.

### Recall.ai Bot Auto-Dispatch (Infrastructure Upgrade)
For teams that want fully zero-touch ingestion:
- Connect Recall.ai Calendar API to read Google/Outlook calendar events.
- Auto-dispatch a bot to any meeting where an attendee email matches a CRM contact.
- No rep action required at all.
