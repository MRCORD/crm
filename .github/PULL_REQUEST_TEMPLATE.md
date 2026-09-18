## Summary

<!-- What does this PR change, and why? -->

## Type of Change

- [ ] Bug fix
- [ ] New feature (MCP tool, CRM primitive, UI component)
- [ ] Schema / migration change
- [ ] Documentation
- [ ] Chore / tooling

## Checklist

- [ ] `npx tsc --noEmit` passes clean (0 errors)
- [ ] `pnpm lint` passes clean
- [ ] `pnpm build` succeeds
- [ ] Migration file generated and committed alongside any schema change (`pnpm db:generate`)
- [ ] Verified end-to-end against a real PostgreSQL instance (paste command/output below)
- [ ] No hardcoded credentials, personal paths, or real connection strings
- [ ] If a new MCP tool: schema + handler added, registered in `server.ts`, and MCP server still boots

## Verification

<!--
Paste the command you ran and its output/log as evidence, e.g.:

  $ pnpm db:migrate && pnpm dev
  ✓ migrations applied
  ✓ manually clicked through /opportunities, dragged a card, confirmed stage persisted
-->

## Screenshots (if UI change)

<!-- Drag and drop images here -->
