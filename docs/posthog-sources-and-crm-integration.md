# PostHog: Source Integrations, Data Warehouse & CRM Synchronization

This document examines how **PostHog** approaches integrating external data sources with CRMs, analyzing its **Customer Data Platform (CDP)**, **Data Warehouse Managed Sources**, **Hog Functions / Reverse ETL**, and the **`@posthog/wizard`** setup assistant.

---

## 1. Overview of PostHog's CRM Strategy

PostHog approaches CRMs from two bidirectional angles:

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                       POSTHOG DATA PLATFORM                                            │
│                                                                                                        │
│   ┌───────────────────────────────────┐               ┌───────────────────────────────────────────┐    │
│   │     INBOUND: MANAGED SOURCES      │               │       OUTBOUND: REALTIME DESTINATIONS     │    │
│   │    (Data Warehouse Connectors)    │               │            (CDP / Hog Functions)         │    │
│   │                                   │               │                                           │    │
│   │  HubSpot, Salesforce, Stripe,     │               │  Attio, HubSpot, Salesforce, Close,       │    │
│   │  Zendesk, Vitally, PostgreSQL     │               │  Customer.io, Intercom                    │    │
│   └─────────────────▲─────────────────┘               └─────────────────────┬─────────────────────┘    │
│                     │                                                       │                          │
│                     │ Pulls CRM data                                        │ Pushes user & event data │
│                     │ (Deals, Contacts, Notes)                              │ (PQLs, usage drops)      │
│                     │                                                       ▼                          │
│   ┌─────────────────┴─────────────────────────────────────────────────────────────────────────────┐    │
│   │                                 HogQL FEDERATED QUERY LAYER                                   │    │
│   │     SELECT event, sum(hubspot_deals.amount) FROM events JOIN hubspot_deals ...                │    │
│   └───────────────────────────────────────────────────────────────────────────────────────────────┘    │
└────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

1. **Inbound (CRM as a Managed Source):** PostHog ingests tables from CRMs (HubSpot, Salesforce, Zoho, etc.) into its ClickHouse-backed Data Warehouse so teams can join sales pipeline data with product analytics.
2. **Outbound (CRM as a Destination / Reverse ETL):** PostHog exports product usage events, user attributes, and cohorts to CRMs (Attio, Close, HubSpot, Salesforce) to drive Product-Qualified Lead (PQL) workflows.

---

## 2. Inbound: Linking CRMs as Managed Sources

PostHog's Data Warehouse supports managed connectors for major CRMs:
* **HubSpot**
* **Salesforce**
* **Zoho CRM**
* **Spotler CRM / AgileCRM / Capsule CRM / Less Annoying CRM**

### 2.1. Ingested Entities
When a CRM like HubSpot is connected via OAuth, PostHog extracts both commercial entities and communication streams:

| CRM Entity Table | Content Ingested | Primary Analytics Value |
| :--- | :--- | :--- |
| `contacts` | Name, email, lead status, buying role | Attribution to anonymous web traffic. |
| `companies` | Domain, MRR, CSM sentiment, industry | Account-based analytics (ABM). |
| `deals` | Amount, pipeline stage, close date, MRR | Correlating feature adoption with win rates. |
| `emails` | HTML/Text body, subject, direction | Measuring rep outreach volume against engagement. |
| `meetings` | Title, body, notes, external URL, outcome | Tracking executive touchpoints per account. |
| `calls` & `notes` | Transcripts, call recordings, notes | Grounding qualitative sales context. |
| `tickets` | Category, priority, pipeline stage | Quantifying product friction and churn risk. |
| `invoices` & `quotes` | Commercial payment terms, discounts | Revenue analytics without separate ERP connectors. |

### 2.2. Synchronization Modes

PostHog implements three sync strategies for CRM sources:
* **Incremental Sync:** Uses cursor fields (e.g., `hs_lastmodifieddate`, `lastmodifieddate`). After a baseline full import, it periodically fetches records modified since the previous checkpoint.
* **Full Refresh:** Drops and reloads the entire dataset. Used for lookup tables without reliable timestamps (e.g., `pipelines`, `pipeline_stages`, `owners`).
* **Webhooks (Real-Time Push):** When supported by the upstream CRM, changes stream immediately via webhook callbacks to minimize data staleness.

---

## 3. Outbound: CRM as a Destination (CDP & Hog Functions)

Using its Customer Data Platform (CDP) engine, PostHog allows product teams to update CRM records in real time when key user events occur.

### 3.1. Supported CRM Destinations
* **Attio:** Creates and updates Attio records (`person`, `company`) using Attio's v2 REST API.
* **HubSpot:** Syncs contact properties, creates deals upon form submission or milestone achievement.
* **Salesforce:** Syncs leads and contact properties.
* **Close CRM:** Updates leads and triggers automated call/email tasks.

### 3.2. Hog Function Event-Driven Pipeline
PostHog executes event transformations using **Hog Functions** (lightweight sandboxed TypeScript/Python functions).

**Example: Attio Destination Template**
When an event occurs in PostHog (e.g., `organization_created` or `plan_upgraded`), the destination function executes:
1. Normalizes the event payload (`email`, `company_name`, `mrr`).
2. Performs an idempotent `assertRecord` call to Attio's `/v2/objects/companies/records` endpoint.
3. Maps PostHog user IDs to Attio contact attributes.

---

## 4. Federated Analysis via HogQL

The primary architectural advantage of bringing CRM data into PostHog is **federated SQL queries via HogQL**.

By joining high-frequency product event streams with relational CRM data, teams can answer cross-domain questions without ETLing everything into Snowflake:

```sql
-- Correlate product feature usage with deal closing outcomes
SELECT 
    hubspot_deals.dealname,
    hubspot_deals.amount,
    hubspot_deals.dealstage,
    count(events.uuid) AS feature_actions_last_30d
FROM hubspot_deals
JOIN events ON events.person.properties.email = hubspot_deals.contact_email
WHERE events.event = 'completed_onboarding_step'
GROUP BY hubspot_deals.dealname, hubspot_deals.amount, hubspot_deals.dealstage
ORDER BY hubspot_deals.amount DESC;
```

---

## 5. The `@posthog/wizard` Pattern

PostHog introduced `@posthog/wizard` (`npx @posthog/wizard warehouse`), an interactive CLI that uses AI agents to automate data source integration:
1. **Introspection:** Inspects the user's local development environment, discovering local PostgreSQL databases, `.env` API keys, and configurations.
2. **Schema Planning:** Recommends which tables and columns to sync.
3. **Automated Setup:** Connects the database to PostHog's data pipeline via the Management API without manual dashboard clicking.

*(This aligns with `polygres-wizard`, which similarly introspects database schemas and configures `pgContext` retrieval automatically).*

---

## 6. Architectural Lessons for Building Our Agentic CRM

PostHog's model provides three critical architectural takeaways for this CRM project:

### 1. Ingest Product Telemetry as Ambient CRM Context
A modern CRM should not rely solely on sales calls. Integrating PostHog product analytics as an inbound source allows the CRM's autonomous agents to observe:
* Account usage drops (triggering Use Case 7: Ambient Churn Prevention).
* Feature engagement spikes (triggering Use Case 8: Expansion Signals).
* Trial milestones (triggering Use Case 2: Inbound Qualification).

### 2. Dual Sync Architecture (Incremental Cursors + Webhooks)
Following PostHog's connector design:
* Use **Incremental Cursors** (`updated_at` timestamps) for resilient batch syncing and historical backfilling.
* Use **Transactional Webhooks** for real-time, zero-latency trigger events (speed-to-lead under 60 seconds).

### 3. Bidirectional Integration Blueprint

```
┌────────────────────────┐                   ┌────────────────────────┐
│        POSTHOG         │                   │      OUR NEW CRM       │
│  (Product Analytics)   │                   │ (System of Record/Act) │
├────────────────────────┤                   ├────────────────────────┤
│ • In-app events        │ ──[Webhook Push]─►│ • interaction_transcript
│ • Feature flag states  │                   │ • opportunity.health   │
│ • User session URLs    │ ◄─[Reverse ETL]───│ • company.mrr          │
│ • Daily active usage   │                   │ • deal.stage           │
└────────────────────────┘                   └────────────────────────┘
```
