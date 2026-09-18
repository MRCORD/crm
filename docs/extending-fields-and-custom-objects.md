# Extending Fields & Creating Custom Objects

This document explains how this CRM boilerplate handles **personalizing fields on standard objects** (Companies, People, Opportunities) and **creating brand new custom objects** (e.g. Properties, Subscriptions, Vehicles, Patients).

To provide maximum flexibility, the boilerplate implements a **Dual-Layer Customization Architecture**:
1. **Code-First (Developer / Git-Native):** 100% type-safe Drizzle ORM columns and tables with instant compile-time checking and zero runtime performance penalty.
2. **Runtime No-Code (UI & AI Agent Native):** Dynamic metadata catalogs (`custom_field_definitions`, `custom_object_definitions`, `custom_object_records`) with JSONB storage, PostgreSQL GIN indexing, Polygres `jsonb_filter_paths` vector indexing, and Model Context Protocol (MCP) tools.

---

## 1. Summary of the Dual-Layer Architecture

| Feature | Code-First Approach (Drizzle) | Runtime No-Code Approach (JSONB + Metadata) |
| :--- | :--- | :--- |
| **Best For** | Engineering teams, core domain modeling, high-frequency transactional data | Non-technical operators, sales managers, dynamic AI agent self-expansion |
| **How to Define** | Edit `src/db/schema/crm.ts` & run `pnpm db:push` | Call MCP tools or use the CRM Settings UI |
| **PostgreSQL Representation** | Real physical typed columns / tables | Stored in `custom_fields jsonb` or `custom_object_records` |
| **TypeScript Support** | 100% compile-time autocomplete (`drizzle-orm`) | Typed as `Record<string, unknown>` |
| **Polygres Indexing** | Native foreign keys and table columns | Indexed via `ctx.registerJsonbPath(...)` |
| **MCP Integration** | Explicit dedicated MCP tool parameters | Generic dynamic tools (`crm_create_custom_record`, etc.) |

---

## 2. Approach 1: The Code-First Developer Workflow (Drizzle ORM)

Because this is an open-source, self-hosted boilerplate, adding a new field or object takes less than 60 seconds with zero migration boilerplate.

### 2.1. Adding a Custom Field to an Existing Entity

To add a `contractTier` or `preferredCoffee` field to `companies`:

1. Open `src/db/schema/crm.ts`.
2. Add the physical column to `companies`:

```typescript
export const companies = crmSchema.table('companies', {
  // ... existing columns
  contractTier: text('contract_tier').default('Standard'), // New column
  renewalDate: timestamp('renewal_date', { withTimezone: true }), // New column
});
```

3. Push the change directly to PostgreSQL:
```bash
pnpm db:push
```

Drizzle automatically executes `ALTER TABLE crm.companies ADD COLUMN contract_tier text DEFAULT 'Standard';`. You immediately get type-safe access in server actions, API routes, and queries:

```typescript
const enterpriseAccounts = await db.query.companies.findMany({
  where: eq(companies.contractTier, 'Enterprise'),
});
```

---

### 2.2. Creating a Brand New Custom Object (e.g. Real Estate `properties`)

To build an industry-specific CRM (e.g. Real Estate, Logistics, Healthcare):

1. Open `src/db/schema/crm.ts`.
2. Define the new table and foreign key relationships:

```typescript
export const properties = crmSchema.table('properties', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id').references(() => companies.id, { onDelete: 'cascade' }), // Relational Graph Edge
  pointOfContactId: uuid('point_of_contact_id').references(() => people.id, { onDelete: 'set null' }),

  address: text('address').notNull(),
  listingPriceMicros: numeric('listing_price_micros').notNull(),
  propertyType: text('property_type').default('COMMERCIAL'), // 'RESIDENTIAL', 'COMMERCIAL'
  squareFeet: integer('square_feet'),
  status: text('status').default('ACTIVE'),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
```

3. Export the table in `src/db/schema/index.ts`.
4. Run `pnpm db:push`.

**Why this is powerful with Polygres:**
Because `properties` has a `companyId` foreign key, Polygres automatically discovers it via `polygres --json graph discover`. An agent can query:
> *"What properties are associated with Acme Corp?"*

And Polygres's graph engine (`graphFirst`) traverses `crm.companies` $\rightarrow$ `crm.properties` natively without writing a single line of custom graph code!

---

## 3. Approach 2: Runtime No-Code & AI Agent Dynamic Workflow

For sales managers or autonomous AI agents that need to create fields and objects on the fly without touching code or redeploying the server.

### 3.1. Dynamic Custom Fields on Existing Objects

Every core entity table (`companies`, `people`, `opportunities`) includes a native JSONB column:

```sql
custom_fields JSONB DEFAULT '{}'::jsonb NOT NULL
```

#### The Metadata Catalog: `crm.custom_field_definitions`
```sql
CREATE TABLE crm.custom_field_definitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    target_entity TEXT NOT NULL, -- 'companies', 'people', 'opportunities'
    name TEXT NOT NULL,          -- e.g. 'contractTier'
    label TEXT NOT NULL,         -- e.g. 'Contract Tier'
    field_type TEXT NOT NULL,    -- 'TEXT', 'NUMBER', 'BOOLEAN', 'DATE', 'SELECT'
    options JSONB,               -- ['Tier 1', 'Tier 2', 'VIP']
    is_required BOOLEAN DEFAULT FALSE,
    is_searchable BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### How Data is Saved
When a user sets `contractTier = "Enterprise"` on Acme Corp:
```sql
UPDATE crm.companies 
SET custom_fields = jsonb_set(custom_fields, '{contractTier}', '"Enterprise"')
WHERE id = 'acme_uuid';
```

#### Indexing & Polygres Search Compatibility
1. **PostgreSQL GIN Index:** High-speed querying over custom fields in SQL:
   ```sql
   CREATE INDEX idx_companies_custom_fields ON crm.companies USING GIN (custom_fields);
   ```
2. **Polygres `registerJsonbPath` Integration:**
   When a searchable custom field is defined, the system registers the JSONB path with Polygres:
   ```typescript
   await polygres.project().context.registerJsonbPath(
     'crm_transcripts',
     'contractTier',
     'custom_fields',
     ['contractTier']
   );
   ```
   This allows Polygres HNSW vector queries to pre-filter on custom fields directly:
   ```typescript
   const results = await polygres.project().context.search(
     'crm_transcripts',
     queryVector,
     { filter: { contractTier: 'Enterprise' } }
   );
   ```

---

### 3.2. Dynamic Custom Objects (UI-Created Entities)

When an operator or agent defines an entirely new entity type (e.g. `vehicle`, `subscription`, `patient`) at runtime:

```sql
-- 1. Entity Definition Catalog
CREATE TABLE crm.custom_object_definitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name_singular TEXT UNIQUE NOT NULL, -- 'listing'
    name_plural TEXT UNIQUE NOT NULL,   -- 'listings'
    label_singular TEXT NOT NULL,       -- 'Listing'
    label_plural TEXT NOT NULL,         -- 'Listings'
    description TEXT,
    icon TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Entity Instances (Universal Record Store with Graph Anchors)
CREATE TABLE crm.custom_object_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    custom_object_id UUID NOT NULL REFERENCES crm.custom_object_definitions(id) ON DELETE CASCADE,
    name TEXT NOT NULL, -- Primary display label

    -- Graph Edges to Core CRM Entities
    company_id UUID REFERENCES crm.companies(id) ON DELETE SET NULL,
    person_id UUID REFERENCES crm.people(id) ON DELETE SET NULL,

    -- Dynamic Entity Attributes
    data JSONB DEFAULT '{}'::jsonb NOT NULL,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);
```

---

## 4. MCP Tools for Custom Fields & Objects

External AI agents (Claude Desktop, Cursor, LangGraph) can inspect, create, and populate custom fields and objects using built-in MCP tools:

### Tool 1: `crm_create_custom_field`
Allows an agent or user to define a new attribute:
```json
{
  "name": "crm_create_custom_field",
  "arguments": {
    "targetEntity": "companies",
    "name": "renewalMonth",
    "label": "Renewal Month",
    "fieldType": "SELECT",
    "options": ["January", "February", "March", "Q4"]
  }
}
```

### Tool 2: `crm_create_custom_object`
Allows an agent or user to define a new object type:
```json
{
  "name": "crm_create_custom_object",
  "arguments": {
    "nameSingular": "listing",
    "namePlural": "listings",
    "labelSingular": "Real Estate Listing",
    "labelPlural": "Real Estate Listings",
    "description": "Properties represented by our brokerage"
  }
}
```

### Tool 3: `crm_create_custom_record`
Allows an agent to instantiate a custom record and link it to an account:
```json
{
  "name": "crm_create_custom_record",
  "arguments": {
    "customObjectName": "listing",
    "name": "742 Evergreen Terrace",
    "companyId": "acme_corp_uuid",
    "data": {
      "price": 850000,
      "bedrooms": 4,
      "status": "Under Contract"
    }
  }
}
```

### Tool 4: `crm_search_custom_records`
Allows an agent to find custom records across the CRM:
```json
{
  "name": "crm_search_custom_records",
  "arguments": {
    "customObjectName": "listing",
    "query": "Evergreen"
  }
}
```

---

## 5. Architectural Recommendation

* **For Core Domain Modeling:** Use **Approach 1 (Code-First Drizzle)**. Keep core business objects (`companies`, `people`, `opportunities`, `properties`) defined in TypeScript for maximum performance, clean SQL migrations, and strict type safety.
* **For User Customizations & Ad-Hoc Attributes:** Use **Approach 2 (Runtime No-Code)**. Let sales reps and AI agents add custom fields (`custom_fields jsonb`) and dynamic records (`custom_object_records`) without needing code deployments.
