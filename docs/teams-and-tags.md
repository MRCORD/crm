# Teams (Organizations) & Tags

This document covers two additions to the CRM: **Clerk Organizations** for multi-team/multi-tenant grouping, and a **polymorphic tagging system** that labels any CRM object — standard or custom.

---

## 1. Teams via Clerk Organizations

Rather than building a custom teams system, we use **Clerk Organizations** — the same primitive Slack (workspaces), Linear (teams), and Vercel (projects) use for multi-tenant grouping.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          CLERK (Source of Truth)                            │
│                                                                             │
│   Organization: "Acme Sales Team"  (org_2abc...)                            │
│   ├── Member: sarah@acme.com   → role: org:admin                            │
│   ├── Member: miles@acme.com   → role: org:member                           │
│   └── Member: pepper@acme.com  → role: org:member                           │
│                                                                             │
│   Users can belong to MULTIPLE orgs and switch between them                 │
│   (<OrganizationSwitcher /> component). Session token carries the           │
│   Active Organization + Role.                                               │
└─────────────────────────┬───────────────────────────────────────────────────┘
                          │ webhook: organization.created/updated/deleted,
                          │          organizationMembership.created/updated/deleted
                          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                       POLYGRES (Synced Mirror)                              │
│                                                                             │
│   system.organizations         (id = Clerk org ID)                          │
│   system.organization_members  (org ↔ user, with role)                      │
│                                                                             │
│   crm.companies.organization_id      — which team owns this account         │
│   crm.opportunities.organization_id  — which team owns this deal            │
│   crm.tags.organization_id           — team-scoped tag namespaces           │
│   system.api_keys.organization_id    — team-scoped MCP API keys             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Why Clerk Organizations Instead of a Custom Table

| Building it ourselves | Using Clerk Organizations |
| :--- | :--- |
| Invitation emails, accept/decline flow | Built-in, hosted invitation UI |
| Verified domain auto-join | Built-in (`Verified Domains`) |
| SAML/OIDC SSO per organization | Built-in (`Enterprise Connections`) |
| Role management UI | Built-in (`<OrganizationSwitcher />`, `<OrganizationProfile />`) |
| Multi-org switching per user | Built-in (Active Organization concept) |

### Roles Within an Organization

Clerk ships two default roles per org, extensible with up to 10 custom roles:

| Role | Key | Default Permissions |
| :--- | :--- | :--- |
| **Admin** | `org:admin` | Full access — manage org, manage members, delete org |
| **Member** | `org:member` | Read members, read billing — no management rights |

Custom roles (e.g. `org:sales`, `org:billing`) can be created in the Clerk Dashboard and assigned custom permissions like `org:invoices:create`.

### Single-Org vs Multi-Org Deployments

The `organization_id` columns are **nullable** — a self-hosted single-company deployment can ignore organizations entirely and leave every record's `organization_id` as `null`. Multi-org support activates automatically the moment a Clerk organization is created (e.g. an agency running the CRM for multiple clients from one instance).

### Webhook Sync

`src/app/api/webhooks/clerk/route.ts` handles all six organization-related events:

```
organization.created / organization.updated  → upsert system.organizations
organization.deleted                          → delete system.organizations (cascades)
organizationMembership.created / .updated     → upsert system.organization_members
organizationMembership.deleted                → delete system.organization_members
```

Configure in Clerk Dashboard → Webhooks → add these event types alongside the existing `user.*` events.

---

## 2. Tags: Polymorphic Labels Across Any Object

CRMs need lightweight labels that cut across the rigid object model — "Hot Lead", "Enterprise", "Churn Risk", "Q4 Renewal" — applicable to companies, people, opportunities, **and any future custom object** without a schema migration each time.

### Schema Design

```sql
-- Tag definitions (shared vocabulary across all entity types)
CREATE TABLE crm.tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id TEXT REFERENCES system.organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    color TEXT DEFAULT 'gray',     -- UI chip color
    category TEXT,                 -- optional grouping: 'priority', 'industry', 'lifecycle'
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Polymorphic junction: attaches ANY tag to ANY record
CREATE TABLE crm.taggables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tag_id UUID NOT NULL REFERENCES crm.tags(id) ON DELETE CASCADE,
    taggable_type TEXT NOT NULL,   -- 'company' | 'person' | 'opportunity' | <custom object nameSingular>
    taggable_id UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### The Deliberate Trade-off: No Physical FK on `taggable_id`

Every other junction table in this CRM (`note_targets`, `task_targets`, `calendar_event_targets`) uses **typed columns with real foreign keys** — `target_company_id`, `target_person_id`, `target_opportunity_id`.

Tags break that pattern on purpose. A tag must work uniformly across:
- Standard objects (`company`, `person`, `opportunity`)
- **Any custom object created at runtime** (`crm.custom_object_definitions`), without a new column or migration every time someone defines a new object type

Postgres cannot enforce a foreign key against a dynamic set of tables, so `taggable_id` is a plain UUID with an application-level discriminator (`taggable_type`). This is the standard "polymorphic association" pattern used by Rails' `ActsAsTaggableOn`, WordPress's term taxonomy, and most tagging systems that must span an open-ended object model.

**Consequence:** Polygres's automatic foreign-key graph discovery (`polygres --json graph discover`) will **not** find `taggable_id` as a graph edge, since it isn't a real FK. Tag-based filtering is a lookup (`crm_search_by_tag`), not a graph traversal — this is an acceptable and intentional scope boundary.

---

## 3. MCP Tools for Tagging

Six MCP tools expose the full tag lifecycle to AI agents:

| Tool | Purpose |
| :--- | :--- |
| `crm_create_tag` | Create a tag (idempotent — returns the existing tag if the name matches) |
| `crm_tag_record` | Attach a tag to any record; auto-creates the tag if it doesn't exist |
| `crm_untag_record` | Remove a tag from a record |
| `crm_get_record_tags` | List every tag currently on a specific record |
| `crm_search_by_tag` | Find all records of a given type carrying a specific tag |

### Example Agent Workflow

```
User: "Tag every opportunity over $1M as 'Enterprise' and flag Sarah Connor as a champion."

Agent calls:
1. crm_search_companies / crm_get_company → find Acme's opportunity
2. crm_tag_record({ tagName: "Enterprise", taggableType: "opportunity", taggableId: "..." })
3. crm_tag_record({ tagName: "Champion", taggableType: "person", taggableId: sarah_id })
4. crm_search_by_tag({ tagName: "Enterprise", taggableType: "opportunity" })
   → returns the full list for confirmation
```

### Verified End-to-End

```
1. crm_search_companies       → Found ['Acme Corporation']
2. crm_create_tag             → Hot Lead (new)
3. crm_tag_record             → tagged successfully
4. crm_get_record_tags        → ['Hot Lead']
5. crm_search_by_tag          → ['Acme Corporation']
6. crm_untag_record           → removed
7. Tags after untag           → 0 (confirmed clean removal)
```

---

## 4. Combined Example: Team-Scoped Tagging

Because `crm.tags.organization_id` is nullable but present, a multi-team deployment can scope tag vocabularies per team:

```typescript
// Sales team creates their own "Hot Lead" tag
await crmToolHandlers.createTag({ name: 'Hot Lead', color: 'red' });
// → tag.organizationId = 'org_sales_team_id' (set at insert time from session context)

// Customer Success team has a separate "At Risk" tag, isolated by organization_id
await crmToolHandlers.createTag({ name: 'At Risk', color: 'orange' });
// → tag.organizationId = 'org_cs_team_id'
```

Filtering tag search by `organization_id` (not yet wired into the MCP tool signatures — a natural next addition) would let each team maintain its own tag taxonomy while sharing the same underlying CRM records.
