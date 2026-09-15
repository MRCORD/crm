/**
 * Clerk server-side helpers.
 *
 * These run in Next.js Server Components, Route Handlers, and the MCP HTTP transport.
 * Import `clerkClient` for admin operations; `auth()` for per-request identity.
 */
export { auth, currentUser, clerkClient } from '@clerk/nextjs/server';

/**
 * CRM role definitions — stored in Clerk publicMetadata.role and mirrored in system.users.role.
 *
 *  admin  — full access: manage users, see all deals, approve HITL actions
 *  member — standard rep: owns their deals/accounts, sees shared pipeline
 *  guest  — read-only: view pipeline, cannot mutate records or trigger agents
 */
export type CrmRole = 'admin' | 'member' | 'guest';

/**
 * Extract the CRM role from a Clerk session or user object.
 * Defaults to 'member' if not set — safe for new sign-ups before metadata is assigned.
 */
export function getCrmRole(publicMetadata: Record<string, unknown>): CrmRole {
  const role = publicMetadata.role;
  if (role === 'admin' || role === 'guest') return role;
  return 'member';
}
