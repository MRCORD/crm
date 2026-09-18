# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in this project, **please do not open a public GitHub issue**.

Instead, report it privately by opening a [GitHub Security Advisory](https://github.com/MRCORD/crm/security/advisories/new) or by emailing the maintainers directly (contact visible on the GitHub profile).

Please include:
- Description of the vulnerability and its impact
- Steps to reproduce
- Any relevant logs or payloads (redact live credentials)

You can expect an acknowledgement within 72 hours and a status update within 7 days.

## Scope

This is a **self-hosted boilerplate**. Security is partly the deployer's responsibility:

| Area | Responsibility |
| :--- | :--- |
| Credentials in `.env` | **Deployer** — never commit `.env`, rotate keys if exposed |
| PostgreSQL access | **Deployer** — restrict network access, use strong passwords |
| Clerk authentication | **Clerk** — session management and identity |
| MCP tool execution | **Both** — HITL approval queue (`mcp.mcp_approvals`) gates Tier 4 actions |
| Webhook HMAC signatures | **This repo** — `X-CRM-Signature: sha256=<hex>` on all outbound deliveries |

## Security Features in This Codebase

- **Risk-Tiered HITL Gateway:** Tier 4 irreversible actions (record merges, terminal deal stages) are intercepted and placed in `mcp.mcp_approvals` pending human sign-off.
- **Immutable Audit Trail:** Every MCP tool call is recorded in `mcp.mcp_tool_call_receipts` with input, output, status, and duration.
- **Activity Timeline:** Append-only `crm.timeline_activities` records all record mutations with actor source and user.
- **HMAC-signed Webhooks:** Outbound webhooks carry `X-CRM-Signature: sha256=<hex>` using a per-subscription secret, following the same pattern as Stripe and Clerk.
- **Record-Level Visibility:** `PRIVATE` records on companies and opportunities are readable only by owners and admin-role users.
- **Field-Level Masking:** `crm.field_permissions` restricts read/write access to sensitive columns by role.

## Known Limitations (by design)

- The MCP server runs over **stdio** by default. Exposing it over HTTP requires an authenticated gateway (e.g. Cloudflare MCP Portals — see `docs/cloudflare-mcp-portals.md`).
- Custom field data stored in `custom_fields` JSONB is not individually encrypted at rest — use Postgres-level or disk-level encryption for sensitive custom field values.
- CSV import does not sanitize for formula injection (relevant if exported files are opened in spreadsheet software without sanitization).
