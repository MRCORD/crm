# Agentic CRM Use Cases: What People Do & What They Need

This document maps the operational reality of Go-To-Market (GTM) teams, categorizes what humans spend their time doing, identifies what they struggle with, and details the **end-to-end use cases where autonomous AI agents transform CRM workflows**.

---

## 1. The Human Reality: What People Do vs. What They Need

In a traditional CRM, humans are forced to act as **manual data entry clerks, query compilers, and coordination routers**. 

### The Time Allocation Breakdown (Industry Average)
* **~32% Core Selling / Relationship Building:** Discovery calls, strategic negotiation, executive dinners, live problem solving.
* **~68% "Work About Work" (The Administrative Drag):**
  * Researching prospect tech stacks, news, and LinkedIn profiles.
  * Logging notes, tasks, next steps, and stage updates into the CRM.
  * Drafting repetitive follow-up emails and multi-touch cadences.
  * Chasing internal stakeholders for deal approvals, legal reviews, and pricing discounts.
  * Cleaning up duplicate contacts, fixing formatting errors, and updating dead opportunities.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                               THE HUMAN-TO-AGENT SHIFT                                 │
├───────────────────────────────────────────┬────────────────────────────────────────────┤
│   What Humans Hate Doing (Agent Territory)│   What Humans Excel At (Human Territory)   │
├───────────────────────────────────────────┼────────────────────────────────────────────┤
│ • Manual field updates & note taking      │ • Complex interpersonal negotiation        │
│ • Sifting through 10-K filings & news     │ • Strategic relationship building          │
│ • Writing 50 generic cold outbound emails │ • Reading room tension & executive empathy │
│ • Cross-referencing pricing spreadsheets  │ • Creative problem-solving & bespoke deals │
│ • Deduplicating & standardizing records   │ • High-stakes closing decisions            │
└───────────────────────────────────────────┴────────────────────────────────────────────┘
```

---

## 2. The 10 Core Use Cases of an Agentic CRM

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                       THE COMPLETE AGENTIC GTM LIFECYCLE                                │
│                                                                                                         │
│  [1. Outbound Prospecting] ──► [2. Inbound Triage] ──► [3. Pre-Meeting Prep] ──► [4. Ambient Execution] │
│           │                             │                        │                       │              │
│           ▼                             ▼                        ▼                       ▼              │
│  [5. Proposal & CPQ]       ──► [6. Account Handoff]──► [7. Health & Churn]  ──► [8. Expansion Signals]  │
│           │                                                                                             │
│           └───────────────────────────► [9. Autonomous Data Hygiene & Forecasting]                      │
│                                       [10. Omnichannel Customer Support]                                │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

### Use Case 1: Autonomous Outbound Prospecting & Lead Enrichment (AI SDR)

* **What People Do Today:** Reps spend hours browsing LinkedIn Sales Navigator, copying prospect names into Apollo or ZoomInfo, checking if their email bounces, looking up company news on Google, and writing generic 3-step email sequences.
* **What People Need:** A goal-oriented autonomous agent that fills the pipeline with verified, deeply researched target accounts.
* **How the Agent Operates:**
  1. *ICP Discovery:* Given a target profile (e.g. *"Fintech companies with 50-500 employees that raised Series A/B in the last 6 months"*), the agent searches external B2B registries and uses Polygres `recommend` to identify lookalikes based on existing closed-won customers.
  2. *Deep Account Research:* Gathers company website copy, hiring posts on job boards (e.g. hiring for "compliance officer"), recent press releases, and executive changes.
  3. *Bespoke Outreach Drafting:* Generates tailored email drafts referencing specific trigger events (*"Noticed you're expanding your compliance team following your Series B..."*).
  4. *Multi-Turn Objection Handling:* Understands natural replies (*"Ping me in Q4"*, *"Not my department, talk to Dave"*) and takes autonomous action: reschedules reminders, looks up Dave, or drafts a polite acknowledgment.

---

### Use Case 2: Zero-Second Inbound Lead Triage & Qualification

* **What People Do Today:** A prospect fills out a website form ("Request a Demo"). The lead sits in the CRM for 4 to 24 hours until a sales rep checks their inbox. By then, the prospect has scheduled a call with a competitor.
* **What People Need:** Instant (<60 second), intelligent qualification and immediate meeting scheduling while prospect intent is at its peak.
* **How the Agent Operates:**
  1. *Real-Time Ingestion:* Triggered by a webhook submission.
  2. *Waterfall Enrichment:* Immediately pulls company domain, headcount, estimated revenue, and tech stack via enrichment APIs.
  3. *Conversational Engagement:* Sends an instant email or initiates an interactive chat session asking targeted qualification questions (BANT/MEDDPIC: timeline, budget, current tech stack).
  4. *Autonomous Scheduling:* If qualified, presents the appropriate Account Executive's live calendar link, sends calendar invites, creates the `company`, `person`, and `opportunity` records in the CRM, and sets up deal targets.

---

### Use Case 3: Pre-Meeting Intelligence Dossier & Stakeholder Mapping

* **What People Do Today:** 10 minutes before an enterprise call, the rep frantically scrambles across LinkedIn, company websites, past emails, and CRM notes trying to remember who is on the call, what was discussed previously, and what blockers exist.
* **What People Need:** A crisp, 1-page pre-flight briefing delivered to Slack or the CRM detail page 30 minutes before every meeting.
* **How the Agent Operates:**
  1. *Calendar Listener:* Detects upcoming meetings via Google Calendar / Outlook integration.
  2. *Graph Traversal (`graph.expand`):* Gathers all participants on the invite, expands their relationships, identifies their job seniority, and maps past interactions.
  3. *Context Grounding (`graphFirst`):* Scans previous meeting transcripts and email threads for unresolved objections, promised follow-ups, and key commercial requirements.
  4. *Dossier Output:* Generates a concise briefing:
     * **Executive Summary:** Who they are, deal size, current stage.
     * **Stakeholder Profile:** Attending titles, decision-making authority.
     * **Past Commitments:** What we promised to demo or verify today.
     * **Likely Objections & Recommended Battlecards:** Competitive positioning against mentioned rivals.

---

### Use Case 4: Ambient Meeting Capture & Autonomous Pipeline Progression

* **What People Do Today:** Reps finish a 45-minute demo call, rush to their next meeting, and forget to log notes. Hours later, they enter 2 vague bullet points (*"Good call, wants to see pricing"*), fail to update deal stages, and take 2 days to send promised follow-up collateral.
* **What People Need:** Invisible, automated CRM updating that eliminates human note-taking entirely.
* **How the Agent Operates:**
  1. *Ambient Ingestion:* Meeting recorder bot joins the call, streams real-time audio to transcription (Deepgram/Whisper), and saves the transcript.
  2. *Semantic Extraction:* The agent parses the conversation:
     * **Next Steps:** Deadlines, follow-up action items.
     * **Budget & Timeline:** Inferred deal size and closing target.
     * **Competitors Mentioned:** Competitor references flagged.
  3. *Atomic Relational Mutations:*
     * Updates `opportunity.stage` (e.g. Moves from "Discovery" to "Proposal").
     * Updates `opportunity.annualRevenueAmountMicros`.
     * Logs the full transcript in `interaction_transcript` with Polygres `reconcileContext: true` for instant vector indexing.
  4. *Instant Follow-Up Draft:* Prepares a personalized follow-up email citing exact questions asked on the call, attaching relevant technical docs, and places it in the rep's drafts queue.

---

### Use Case 5: Autonomous CPQ, Proposal & Contract Generation

* **What People Do Today:** The AE manually enters products, SKUs, and pricing into a CPQ tool, checks with legal for custom clauses, and asks sales managers for discount approvals via Slack.
* **What People Need:** An agent that constructs quotes and proposals directly from conversational agreements and enforces discount governance automatically.
* **How the Agent Operates:**
  1. *Intent Extraction:* Identifies agreed pricing terms and tier requests from meeting transcripts or email confirmations.
  2. *Proposal Generation:* Composes the official quote or order form matching the customer's legal entity name, billing address, and requested payment terms.
  3. *Risk-Tiered Approval Check:*
     * *Standard Discount (<15%):* Auto-approved.
     * *Non-Standard Discount (>15%) or Custom DPA:* Creates an `agent_approval_request` for the VP of Sales with contextual justification.

---

### Use Case 6: AE-to-CSM Seamless Account Onboarding Handover

* **What People Do Today:** Once a deal is won, the AE tells the CSM what happened over an informal chat. Crucial technical edge cases, customer expectations, and verbal promises are lost, leading to poor customer onboarding and buyer remorse.
* **What People Need:** An automated, structured synthesis of the entire sales cycle handed off to the Customer Success team the moment an opportunity closes.
* **How the Agent Operates:**
  1. *Trigger:* `opportunity.stage` changes to `'Closed Won'`.
  2. *360-Degree Historical Synthesis:* The agent runs a `joint` search across all transcripts, emails, and notes for the company.
  3. *Onboarding Blueprint Generation:*
     * **Why They Bought:** The primary business problem and success criteria.
     * **Technical Architecture & Integrations Needed:** Systems they plan to connect.
     * **Key Stakeholders & Champions:** Names, communication styles, and roles.
     * **Explicit Promises Made:** Collateral, timelines, or SLA guarantees given by the AE.
  4. *Project Setup:* Creates customer onboarding tasks, sets target milestones, and introduces the assigned CSM via email.

---

### Use Case 7: Ambient Health Scoring & Proactive Churn Prediction

* **What People Do Today:** CSMs find out an account is churning when the customer sends a cancellation notice. They scramble to salvage the relationship after the decision has already been made.
* **What People Need:** Proactive early warning indicators that alert teams weeks before a renewal is threatened.
* **How the Agent Operates:**
  1. *Multi-Signal Surveillance:* Proactive agents continuously monitor:
     * Communication frequency (e.g. Email cadence dropped by 70% over 30 days).
     * Sentiment trends across support tickets and emails.
     * Executive champion departure (LinkedIn job change alerts).
  2. *Risk Assessment:* Flags at-risk accounts, calculates health scores, and explains the reasoning trace.
  3. *Remediation Plan:* Formulates proactive intervention options (e.g. *"Suggest scheduling an executive check-in; champion Sarah Connor left for another company; usage down 35%"*).

---

### Use Case 8: Expansion & Upsell Signal Detection

* **What People Do Today:** Sales teams miss expansion opportunities because they don't know when existing accounts hit usage ceilings or when adjacent departments express interest.
* **What People Need:** Autonomous identification of cross-sell and expansion signals across communication and usage logs.
* **How the Agent Operates:**
  1. *Signal Detection:* Detects inquiries from new email domains in the company (e.g. `@emea.client.com`), mentions of new initiatives (*"Our marketing team wants to try this too"*), or usage license exhaustion.
  2. *Graph Expansion:* Uses Polygres `graph.connection` to link the new contact to the existing master enterprise account.
  3. *Opportunity Creation:* Automatically generates an Expansion Opportunity, links it to the parent company, and notifies the account owner.

---

### Use Case 9: Autonomous Data Hygiene & Reality-Grounded Forecasting

* **What People Do Today:** RevOps spends days de-duplicating records, standardizing company names, and forcing reps to clean up "ghost deals" that haven't moved in 6 months. Sales forecasts are distorted by "happy ears" (reps overestimating close probabilities).
* **What People Need:** A self-healing CRM database and objective, AI-grounded pipeline forecasting.
* **How the Agent Operates:**
  1. *Autonomous Deduplication:* Scans the database for duplicate entities (e.g., matching on normalized domain names, phone numbers, or fuzzy text) and proposes safe merges.
  2. *Stale Deal Triage:* Detects deals with past close dates or zero activity for 45+ days; prompts the rep with one-click actions: reschedule, move to nurture, or close-lost.
  3. *Objective Forecast Modeling:* Cross-references the rep's forecasted close date and stage against actual communication velocity and buyer sentiment. Flags discrepancies (*"Rep forecasts 90% probability, but prospect has not replied to last 3 emails and mentioned legal freeze"*).

---

### Use Case 10: Omnichannel Customer Support & Case Resolution

* **What People Do Today:** Support teams answer the same 20 questions repeatedly, juggle disconnected knowledge bases, and copy-paste answers across WhatsApp, email, and live chat.
* **What People Need:** Autonomous tier-1 support agents that resolve routine inquiries with full account context, escalating only complex technical issues.
* **How the Agent Operates:**
  1. *Ingestion:* Receives inbound support message across any channel.
  2. *Contextual Grounding:* Checks the customer's current account tier, SLA entitlements, and open bugs.
  3. *Resolution & Tool Execution:* Queries the knowledge base, answers how-to questions, or triggers actions (e.g. resets API tokens, checks payment status).
  4. *Warm Escalation:* If customer expresses frustration or issue requires engineering intervention, routes to human with diagnostic summary and suggested fix.

---

## 3. Persona-by-Persona Value Matrix

| Persona | Core Pain Point | Top Agentic Use Cases | Business Impact |
| :--- | :--- | :--- | :--- |
| **Account Executive (AE)** | Drowning in admin; spending 65%+ time on non-selling work; missed follow-ups. | • Pre-Meeting Dossier<br>• Ambient Call Capture & Auto-Update<br>• Automated Follow-Up Drafting<br>• CPQ / Proposal Generation | **2-3x increase in weekly customer-facing demo capacity.** |
| **Sales Development Rep (SDR/BDR)** | Tedious account research; slow inbound response time; generic cold outreach. | • Autonomous Outbound Prospecting<br>• Sub-60s Inbound Qualification<br>• Multi-Turn Email Scheduling | **Zero-second speed to lead; 4-5x increase in qualified meetings booked.** |
| **Customer Success Manager (CSM)** | Surprised by sudden churn; messy handover from sales; manual QBR prep. | • Sales-to-Success Onboarding Handover<br>• Ambient Churn Risk Surveillance<br>• Expansion Signal Detection | **15-25% reduction in net logo churn; higher expansion revenue.** |
| **Sales Leader / VP of Sales** | Inaccurate forecasts ("happy ears"); low CRM adoption; no visibility into deal risks. | • Objective Reality-Grounded Forecasting<br>• Deal Risk Alerting<br>• Automated Approval Governance | **Accurate pipeline predictability; automated operational governance.** |
| **RevOps / CRM Admin** | Constant data rot; duplicate contacts; broken workflows; rep non-compliance. | • Autonomous Data Hygiene & Deduplication<br>• Stale Pipeline Pruning<br>• Zero-Configuration Schema Adaptation | **Self-healing, clean database without manual maintenance overhead.** |

---

## 4. Human-in-the-Loop (HITL) Governance Matrix

To ensure enterprise trust, every agentic CRM use case maps to a strict **Risk Tier**:

```
                              ┌────────────────────────────────────────────────────────┐
                              │                 HUMAN-IN-THE-LOOP TIERS                │
                              └────────────────────────────────────────────────────────┘
                                                           │
         ┌─────────────────────────┬───────────────────────┴───────────────────────┬─────────────────────────┐
         ▼                         ▼                                               ▼                         ▼
      Tier 1                    Tier 2                                          Tier 3                    Tier 4
   [Zero Risk]                [Low Risk]                                     [Medium Risk]              [High Risk]
   Autonomous                 Autonomous with Audit                          Policy-Gated               Mandatory HITL
   • Web Research             • Log Call Notes & Transcripts                 • Send Outbound Cold Mail  • Send VIP Customer Email
   • Pre-Meeting Dossiers     • Update Internal Tags                         • Move Pipeline Stage      • Execute Pricing Discounts
   • Vector Search            • Flag Duplicates                              • Draft Proposals          • Delete / Merge Records
```

* **Tier 1 & 2:** Agents execute autonomously and generate an immutable receipt in `core.agent_action_receipt`.
* **Tier 3:** Agents execute within strictly configured enterprise policies (e.g. outreach sent only during business hours; max 50 emails/day).
* **Tier 4:** Execution pauses, state is durably saved, and an interactive approval card is sent to the human owner via Slack or CRM notification. Once approved, the agent resumes execution.
