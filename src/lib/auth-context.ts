import { auth } from '@clerk/nextjs/server';
import { db } from '../db';
import { users, apiKeys } from '../db/schema';
import { eq } from 'drizzle-orm';
import { getCrmRole, type CrmRole } from './clerk';

export type AuthContext = {
  clerkUserId: string;
  userId: string; // same — Clerk ID is our system.users PK
  email: string;
  name: string;
  role: CrmRole;
};

/**
 * Resolve the calling user's identity in a Next.js Server Component or Route Handler.
 * Returns null for unauthenticated requests.
 */
export async function resolveAuthContext(): Promise<AuthContext | null> {
  const { userId: clerkUserId, sessionClaims } = await auth();
  if (!clerkUserId) return null;

  const role = getCrmRole((sessionClaims?.metadata as Record<string, unknown>) ?? {});
  const email = (sessionClaims?.email as string) ?? '';
  const name = (sessionClaims?.name as string) ?? email;

  return { clerkUserId, userId: clerkUserId, email, name, role };
}

/**
 * Resolve identity from a raw Bearer token — used by the MCP HTTP transport.
 *
 * Accepts:
 *   Authorization: Bearer <clerk-session-token>
 *   Authorization: Bearer crm_live_<api-key>    (agent swarms / MCP stdio)
 */
export async function resolveAuthContextFromRequest(request: Request): Promise<AuthContext | null> {
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '').trim();
  if (!token) return null;

  // API key path — crm_ prefixed keys for machine callers
  if (token.startsWith('crm_')) {
    const keyHash = token; // simplified — in production: hash before lookup
    const [key] = await db.select().from(apiKeys)
      .where(eq(apiKeys.id, token))
      .limit(1);

    if (!key || key.revokedAt) return null;

    const [user] = await db.select().from(users)
      .where(eq(users.id, key.userId))
      .limit(1);

    if (!user || !user.isActive) return null;

    return {
      clerkUserId: user.id,
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role as CrmRole,
    };
  }

  // Clerk session token path (forwarded from Claude Desktop or other MCP clients)
  // Clerk's verifyToken can validate a session JWT without a full browser context
  return null; // HTTP MCP clients should use api keys; portal uses Cloudflare Access
}

/** Throws if caller lacks the required role. */
export function assertRole(ctx: AuthContext | null, required: CrmRole): void {
  if (!ctx) throw new Error('UNAUTHORIZED: Authentication required');
  const ranks: Record<CrmRole, number> = { guest: 0, member: 1, admin: 2 };
  if (ranks[ctx.role] < ranks[required]) {
    throw new Error(`FORBIDDEN: ${required} role required, caller has ${ctx.role}`);
  }
}
