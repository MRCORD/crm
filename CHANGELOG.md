# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html)
once tagged releases begin.

## [Unreleased]

### Added
- One-click "Deploy to Cloudflare Workers" button and full deployment guide (`DEPLOYING.md`)
- CI workflow (typecheck, lint, build) on every pull request
- Production `Dockerfile` and `docker-compose.yml` for self-hosted / local Postgres
- ESLint flat config (`eslint-config-next`) — `pnpm lint` now runs a real linter
- Drag-and-drop opportunities Kanban board (ReUI + `@dnd-kit`) with per-brand workspaces
- Full-width, sortable, paginated data tables across all CRM entity directories
- Slide-over deal inspector panel with stage progression and CPQ shortcuts
- `CODE_OF_CONDUCT.md`, issue templates, PR template, Dependabot config

### Changed
- Repository history squashed to a single initial commit for public release
- `src/db/scripts/` excluded from version control (local-only utility scripts)

### Fixed
- Hydration mismatches from non-deterministic values in shared UI components
- `react-hooks/set-state-in-effect` and `react-hooks/purity` violations across
  pagination and prop-sync logic, replaced with React's documented
  render-time state adjustment pattern

## [0.1.0] — Initial Public Release

- Self-hosted, MCP-native CRM on PostgreSQL with Next.js 16 web app
- 66 registered Model Context Protocol (MCP) tools
- 5-schema PostgreSQL architecture (`system`, `crm`, `mcp`, `retrieval`, `ingest`)
- Tier 4 Human-in-the-Loop (HITL) approval queue
- Clerk authentication, CPQ quoting, lead routing, outbound sequences, duplicate detection
