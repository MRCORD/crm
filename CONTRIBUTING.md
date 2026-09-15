# Contributing

Contributions are welcome — bug fixes, new MCP tools, new CRM primitives, documentation improvements.

## What this project is

A **self-hosted, single-tenant CRM boilerplate** built on Polygres (PostgreSQL), Drizzle ORM, Clerk auth, and the Model Context Protocol (MCP). The design philosophy is:

- **Boring stack** — no exotic runtimes; TypeScript + PostgreSQL + Node.js
- **MCP-native** — every capability exposed as an MCP tool; agents are first-class users
- **Additive migrations** — `db:generate` + `db:migrate` only; never `db:push` on live data
- **Each feature has a test** — E2E scripts in `src/db/scripts/` verified against a live Polygres DB

## Development Setup

```bash
pnpm install
cp .env.example .env
# Fill in DATABASE_URL pointing at a local or dev Polygres instance
pnpm db:migrate
pnpm db:seed
pnpm mcp          # launches the MCP server on stdio
```

## Workflow

1. **Branch** from `main`: `git checkout -b feat/<short-description>`
2. **Schema changes** → edit `src/db/schema/*.ts`, run `pnpm db:generate`, inspect the generated SQL, commit the migration file alongside the schema change.
3. **New MCP tool** → add schema in `crmToolSchemas`, handler in `crmToolHandlers`, register in `server.ts` with `executeWithReceipt`. Follow the existing numbered comment convention.
4. **New lib module** → `src/lib/<module>.ts`. Avoid side effects at module load time.
5. **Write a test script** → `src/db/scripts/test-<feature>.ts`. Run it against your dev DB to verify end-to-end. Tests should clean up all inserted records.
6. **`npx tsc --noEmit`** must pass before opening a PR.

## PR Checklist

- [ ] `tsc --noEmit` passes clean (0 errors)
- [ ] Migration file generated and committed alongside schema change
- [ ] E2E test script runs successfully against a real PostgreSQL instance
- [ ] No hardcoded credentials, personal paths, or real connection strings
- [ ] MCP server still boots: `npx tsx -e 'import { createCrmMcpServer } from "./src/mcp/server.ts"; createCrmMcpServer(); console.log("OK")'`

## Adding a New CRM Primitive

Look at the existing pattern — each primitive follows the same flow:

```
src/db/schema/crm.ts      → add table definition(s)
src/db/schema/index.ts    → add imports + Drizzle relations
pnpm db:generate          → generate migration SQL
pnpm db:migrate           → apply to dev DB
src/lib/<primitive>.ts    → core logic (no MCP dependencies)
src/mcp/tools.ts          → add Zod schemas + handlers
src/mcp/server.ts         → register with server.tool()
src/db/scripts/test-*.ts  → E2E verification script
```

## What We Won't Merge

- Multi-tenant / workspace-per-schema changes (intentionally single-tenant)
- `db:push` references anywhere
- Raw SQL execution exposed via MCP tools (SQL injection risk)
- Dependencies that require native compilation without fallback
