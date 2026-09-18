# Polygres & pgContext in Modern Agentic CRMs

This document evaluates **Polygres** and its TypeScript SDK (`polygres-sdk-ts`), detailing why its hybrid retrieval capabilities—specifically **pgContext**, **Knowledge Graph traversal**, and **multi-lane Rank Fusion**—are well-matched for modern, AI-native, and agentic CRM architectures.

---

## 1. The Retrieval Dilemma in Traditional CRMs

AI agents in CRMs encounter a fundamental retrieval bottleneck when relying on legacy RAG architectures or standalone vector databases:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                 THE DUAL FAILURE MODES                                 │
├───────────────────────────────────────────┬────────────────────────────────────────────┤
│       Naive Vector DBs (Pinecone/Qdrant)  │         Standard Relational / Text-to-SQL  │
├───────────────────────────────────────────┼────────────────────────────────────────────┤
│ • Disconnected from the CRM relational    │ • Fails on unstructured data (call audio,  │
│   graph (isolated chunk islands).         │   email sentiment, natural language notes).│
│ • Severe synchronization lag & dual-write │ • Cannot calculate semantic similarity or  │
│   consistency problems.                   │   fuzzy intent.                            │
│ • Cannot enforce CRM Row-Level Security   │ • Complex joins become brittle under LLM   │
│   (RLS) or tenant isolation natively.     │   text-to-SQL generation.                  │
└───────────────────────────────────────────┴────────────────────────────────────────────┘
```

A CRM is fundamentally an **interconnected relational graph**:
* A `Person` works at a `Company`.
* A `Company` has multiple `Opportunities` and open support tickets.
* A `Person` participates in `CalendarEvents`, is targeted by `Notes`, and exchanges `Messages`.

When an AI SDR or Deal Copilot asks:
> *"What objections were raised during pricing discussions with senior stakeholders at Acme Corp over the last 90 days?"*

A pure vector search retrieves fragments of calls from unrelated companies that mentioned "pricing". A pure SQL query cannot understand semantic variations of "objections" or analyze conversational transcripts.

**Polygres bridges this divide by uniting relational topology, dense vector embeddings, full-text search, and knowledge graph traversal inside PostgreSQL.**

---

## 2. Core Capabilities of Polygres & `polygres-sdk-ts`

The Polygres TypeScript SDK (`polygres-sdk-ts`) exposes a zero-dependency, edge-compatible interface to PostgreSQL-native retrieval primitives via **pgContext**:

```
                                  POLYGRES RUNTIME API
                                            │
         ┌──────────────────────────────────┼──────────────────────────────────┐
         ▼                                  ▼                                  ▼
    Vector Search                     Graph Traversal                   Full-Text / Lexical
  • HNSW / IVFFlat Indexes          • Neighborhood Expand             • PostgreSQL tsvector
  • Multi-Vector Columns            • Shortest Path Traversal         • Trigram Fuzzy Search
  • Distance: Cosine, L2, L1, IP    • Multi-Entity Connection         • Filter Columns & JSONB
         │                                  │                                  │
         └──────────────────────────────────┼──────────────────────────────────┘
                                            ▼
                                  pgContext SEARCH MODES
                    ┌───────────────────────┼───────────────────────┐
                    ▼                       ▼                       ▼
               graphFirst              rankFusion                 joint
          Graph neighborhood       Reciprocal Rank Fusion    Tri-lane blend:
          ranked by vector sim    (RRF) across graph/vector  Vector + Text + Graph
```

### 2.1. Overview of Retrieval Primitives

| Mode / Primitive | Method in SDK | How it Works | Primary CRM Use Case |
| :--- | :--- | :--- | :--- |
| **Dense Search** | `ctx.search(...)` | High-dimensional HNSW vector similarity. | Finding semantically similar accounts, emails, or knowledge articles. |
| **Graph Traversal** | `project.graph.expand(...)`<br>`project.graph.path(...)` | Multi-hop relational graph navigation. | Mapping stakeholder influence, discovering mutual connections between prospects. |
| **`graphFirst`** | `ctx.graphFirst(...)` | Restricts search space to a graph neighborhood ($N$ hops from a start entity), then ranks by vector distance. | **Entity-Scoped Semantic Search:** Search transcripts and emails exclusively associated with a specific Account or Deal. |
| **`vectorFirst`** | `ctx.vectorFirst(...)` | Finds top vector matches, then expands their relational graph connections. | **Root-Cause Discovery:** Find a technical objection, then traverse back to the specific deals affected by it. |
| **`rankFusion`** | `ctx.rankFusion(...)` | Blends vector distance and graph proximity using Reciprocal Rank Fusion (RRF). | Scoring deal risk based on both communication tone (vector) and stakeholder engagement (graph). |
| **`joint`** | `ctx.joint(...)` | Tri-lane weighted retrieval combining **Semantic Vector + Lexical Full-Text + Graph Topology**. | **Comprehensive Grounding:** Finding mentions of specific product names (lexical), in relevant discussions (vector), involving target accounts (graph). |
| **`groupedSearch`** | `ctx.groupedSearch(...)` | Groups top search hits by a parent entity key (`group_by`). | Prevents one verbose call transcript from monopolizing the agent's context window. |
| **`recommend`** | `ctx.recommend(...)` | Computes lookalikes using positive and negative point exemplars. | **Ideal Customer Profile (ICP) Scoring:** Recommend leads similar to won deals and dissimilar to churned deals. |
| **Context Reconciliation** | `project.rows.insert({ reconcileContext: true })` | Atomically writes relational rows to PostgreSQL and reconciles pgContext vector indexes. | Eliminates dual-write bugs when agents log notes, transcripts, or update records. |

---

## 3. Why Polygres Is Well-Matched for Modern CRM Architectures

### 3.1. Entity-Anchored Semantic Retrieval (`graphFirst`)
In a CRM, search is almost never global; it is almost always **anchored to an entity**:
* *"Summarize what Sarah Connor said about our API limits across all her calls."*
* *"What are the open blockers on the Stark Industries enterprise renewal?"*

With Polygres `graphFirst`, the agent grounds its query explicitly in the entity graph:

```typescript
// Query transcripts strictly within the graph neighborhood of 'company_123'
const results = await client.project().context.graphFirst(
  'interaction_transcripts',
  queryEmbedding, // Vector embedding of "API limits and rate limiting concerns"
  {
    start: { schema: 'workspace_acme', table: 'company', id: 'company_123' },
    maxDepth: 2, // company -> people -> transcripts
    graphLimit: 50,
    limit: 5,
  }
);
```

**Why this matters:**
* Eliminates cross-tenant and cross-account semantic bleeding.
* Bypasses the latency and token cost of fetching thousands of IDs in SQL before passing them to a vector index.

---

### 3.2. Tri-Lane `joint` Retrieval: Vector + Keyword + Graph
Pure vector search regularly misses exact keywords (e.g., SKU codes, error codes, specific contractual clauses, competitor names). Lexical search misses semantic intent. Graph traversal provides relational context.

Polygres `joint` combines all three in a single execution pass:

```typescript
const jointResults = await client.project().context.joint(
  'crm_communications',
  queryVector,
  {
    query: 'SOC2 compliance audit exception', // Lexical filter
    starts: [
      { schema: 'workspace_acme', table: 'opportunity', id: 'opp_q3_deal' }
    ],
    semanticWeight: 0.5, // Conceptual similarity
    lexicalWeight: 0.3,  // Exact keyword matches
    graphWeight: 0.2,    // Relational proximity to the opportunity
    limit: 10,
  }
);
```

---

### 3.3. Fair Context Allocation with `groupedSearch`
When an autonomous agent prepares a pipeline briefing or account review, a standard top-10 search might return 10 chunks from a single 90-minute call, starving out other relevant interactions.

`groupedSearch` ensures balanced diversity across parent entities:

```typescript
// Get top 2 most relevant transcript chunks per opportunity across the portfolio
const portfolioBriefing = await client.project().context.groupedSearch(
  'deal_interactions',
  topicVector,
  {
    groupBy: 'opportunity_id',
    groupLimit: 2, // Maximum 2 chunks per deal
    limit: 20,     // 10 distinct deals represented
  }
);
```

---

### 3.4. Mathematical Lead & Account Lookalikes (`recommend`)
Traditional B2B lead scoring relies on arbitrary heuristic points (e.g., "+5 for visiting pricing page").

With Polygres's vector `recommend` engine, an agent can perform mathematical similarity discovery based on high-dimensional embeddings of closed-won vs. closed-lost customer profiles:

```typescript
const recommendedLeads = await client.project().context.recommend(
  'lead_intelligence',
  {
    positivePointIds: [wonDealId1, wonDealId2, wonDealId3], // Exemplars of Closed Won
    negativePointIds: [churnedDealId1, disqualifiedLeadId2], // Anti-patterns
    limit: 25,
  }
);
```

---

### 3.5. Atomic Row Mutations with Context Reconciliation
A common failure mode in AI systems is the **read-after-write consistency gap**: an agent logs a meeting note to PostgreSQL, but the background embedding worker hasn't processed it yet, causing subsequent agent actions in the same conversation to fail or hallucinate.

Polygres solves this with synchronous context reconciliation:

```typescript
const mutation = await client.project().rows.insert({
  schema: 'workspace_acme',
  table: 'note',
  row: {
    id: crypto.randomUUID(),
    title: 'Call Notes - Security Review',
    content: 'Customer agreed to annual upfront payment pending DPA signing.',
  },
  reconcileContext: true,  // Trigger immediate pgContext indexing
  waitForContext: true,    // Block until vector index is verified current
  waitTimeout: 5.0,
});

console.log('Postgres Commit:', mutation.rowCommitted);
console.log('Vector Index Status:', mutation.context?.status); // 'completed'
```

---

## 4. Integration Blueprint: Polygres with Twenty-Style CRM Architecture

By pairing Twenty CRM's dynamic **metadata engine** with **Polygres** as the retrieval and vector foundation, an agentic CRM gains both relational flexibility and fast multi-lane retrieval:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              AGENTIC CRM EXECUTION LAYER                               │
│                                                                                        │
│   Agentforce / LangGraph / Twenty Agent Engine                                         │
│   • Evaluates high-level goal: "Identify at-risk enterprise deals in EMEA"             │
│   • Decides retrieval strategy: Graph-guided Joint Search via Polygres                 │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                 POLYGRESS-SDK-TS CLIENT                                │
│                                                                                        │
│   client.project().context.joint('interactions', queryVector, {                        │
│     query: 'competitor renewal churn',                                                 │
│     starts: [{ schema: 'workspace_emea', table: 'opportunity', id: '...' }],          │
│     weights: { semantic: 0.5, lexical: 0.3, graph: 0.2 }                               │
│   })                                                                                   │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                               POSTGRESQL + pgContext STORAGE                           │
│                                                                                        │
│   ├── workspace_emea (PostgreSQL Schema)                                               │
│   │   ├── company, person, opportunity, note, task (Relational Tables)                 │
│   │   └── noteTarget, taskTarget (Relational Graph Edges)                              │
│   │                                                                                    │
│   └── pgContext Engine                                                                 │
│       ├── HNSW Vector Index (Dense Embeddings of Transcripts & Emails)                 │
│       ├── Inverted Lexical Index (Full-Text Search on Content)                         │
│       └── Topological Neighborhood Cache (Entity Relationships)                        │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Architectural Comparison

| Dimension | Standard PostgreSQL + `pgvector` | Dedicated Vector DB (e.g. Pinecone) + CRM DB | **Polygres + pgContext** |
| :--- | :--- | :--- | :--- |
| **Relational Consistency** | High (same DB, manual SQL joins) | Poor (dual writes, async lag) | **High (automatic context reconciliation on row writes)** |
| **Graph-Scoped Search** | Difficult (complex recursive CTEs + vector distance) | Impossible (no relational graph in vector DB) | **Native (`graphFirst`, `vectorFirst`, `joint`)** |
| **Search Diversity** | Manual `DISTINCT ON` or post-processing | Application-level deduplication | **Native `groupedSearch` by parent entity** |
| **Hybrid Search** | Manual SQL `RRF` logic or separate extensions | Cloud-managed sparse/dense fusion | **Native `rankFusion` & `joint` AST query trees** |
| **Edge & Serverless** | Requires persistent TCP pool (PgBouncer) | REST API | **Zero-dependency, WHATWG fetch, Edge-native (`polygres-sdk-ts`)** |

---

## 6. Summary

For an agentic CRM, retrieval must be **relational, semantic, and transactional**. 

Polygres addresses the specific failure modes of AI in CRM by providing:
1. **Entity-anchored search** through `graphFirst`, avoiding context pollution across unrelated accounts.
2. **Multi-lane fusion** via `joint`, ensuring exact terms (SKUs, contracts) and conceptual meanings are co-ranked.
3. **Synchronous reconciliation**, preventing agents from stumbling over stale read-after-write states.
4. **Grouped search**, delivering balanced context across complex sales portfolios.
