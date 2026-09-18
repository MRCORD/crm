# Contributing

Contributions are welcome — bug fixes, new MCP tools, new CRM primitives, documentation improvements.

## What this project is

A **self-hosted, single-tenant CRM boilerplate** built on Polygres (PostgreSQL), Drizzle ORM, Clerk auth, and the Model Context Protocol (MCP). The design philosophy is:

- **Boring stack** — no exotic runtimes; TypeScript + PostgreSQL + Node.js
- **MCP-native** — every capability exposed as an MCP tool; agents are first-class users
- **Additive migrations** — `db:generate` + `db:migrate` only; never `db:push` on live data
- **Each feature is verified end-to-end** against a live PostgreSQL database before merge

## Development Setup

```bash
pnpm install
cp .env.example .env
# Fill in DATABASE_URL. For a quick local Postgres instead of a hosted one:
docker compose up -d
pnpm db:migrate
pnpm db:seed
pnpm dev            # web app on http://localhost:3000
pnpm mcp            # launches the MCP server on stdio
```

## Workflow

1. **Branch** from `main`: `git checkout -b feat/<short-description>`
2. **Schema changes** → edit `src/db/schema/*.ts`, run `pnpm db:generate`, inspect the generated SQL, commit the migration file alongside the schema change.
3. **New MCP tool** → add schema in `crmToolSchemas`, handler in `crmToolHandlers`, register in `server.ts` with `executeWithReceipt`. Follow the existing numbered comment convention.
4. **New lib module** → `src/lib/<module>.ts`. Avoid side effects at module load time.
5. **Verify end-to-end** → write a throwaway verification script and run it against your dev database. `src/db/scripts/` is gitignored (personal utility scripts, never committed) — use it as scratch space, or run inline via `pnpm tsx -e '...'`. Clean up any inserted records afterward. Paste the command and its output in your PR description as evidence (see the PR template).
6. Before opening a PR, all of the following must pass locally (CI runs the same checks on every PR):
   ```bash
   npx tsc --noEmit
   pnpm lint
   pnpm build
   ```

## PR Checklist

See `.github/PULL_REQUEST_TEMPLATE.md` (auto-populated when you open a PR). In short:

- [ ] `tsc --noEmit`, `pnpm lint`, and `pnpm build` all pass clean
- [ ] Migration file generated and committed alongside any schema change
- [ ] End-to-end verification run against a real PostgreSQL instance, with command/output pasted in the PR
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
(scratch script)          → E2E verification, not committed
```

## What We Won't Merge

- Multi-tenant / workspace-per-schema changes (intentionally single-tenant)
- `db:push` references anywhere
- Raw SQL execution exposed via MCP tools (SQL injection risk)
- Dependencies that require native compilation without fallback
- Committed files under `src/db/scripts/` or `scripts/` — these are gitignored on purpose
