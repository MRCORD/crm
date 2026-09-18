import { headers } from 'next/headers';
import { WebhookEvent } from '@clerk/nextjs/server';
import { Webhook } from 'svix';
import { getEdgeDb } from '@/db/edge';
import { users, organizations, organizationMembers } from '@/db/schema';
import { getCrmRole, clerkClient } from '@/lib/clerk';
import { eq } from 'drizzle-orm';

/**
 * POST /api/webhooks/clerk
 *
 * Syncs Clerk identity and organization events into Postgres so CRM FKs
 * (crm.opportunities.owner_id, crm.companies.organization_id, etc.) remain valid.
 *
 * Configure in Clerk Dashboard → Webhooks:
 *   URL: https://your-domain.com/api/webhooks/clerk
 *   Events: user.created, user.updated, user.deleted,
 *           organization.created, organization.updated, organization.deleted,
 *           organizationMembership.created, organizationMembership.updated,
 *           organizationMembership.deleted
 *
 * Access control: Email domain restriction is configurable via ALLOWED_EMAIL_DOMAIN.
 * If set (e.g. "yourcompany.com"), any account whose primary email does not match
 * is banned via the Backend API and never synced into system.users.
 * If unset or empty, domain restriction is disabled (open sign-up).
*/
const ALLOWED_EMAIL_DOMAIN = process.env.ALLOWED_EMAIL_DOMAIN || null;

export async function POST(req: Request) {
  const secret = process.env.CLERK_WEBHOOK_SECRET;
  if (!secret) {
    return new Response('CLERK_WEBHOOK_SECRET not set', { status: 500 });
  }

  const headerPayload = await headers();
  const svixId = headerPayload.get('svix-id');
  const svixTimestamp = headerPayload.get('svix-timestamp');
  const svixSignature = headerPayload.get('svix-signature');

  if (!svixId || !svixTimestamp || !svixSignature) {
    return new Response('Missing svix headers', { status: 400 });
  }

  const body = await req.text();
  const wh = new Webhook(secret);
  const db = await getEdgeDb();

  let event: WebhookEvent;
  try {
    // svix v2.5.0's `verify()` only validates the signature (throws on
    // failure) and returns `undefined` on success — it no longer returns
    // the parsed payload like older versions did. We parse `body` ourselves.
    wh.verify(body, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    });
    event = JSON.parse(body) as WebhookEvent;
  } catch {
    return new Response('Invalid webhook signature', { status: 400 });
  }

  const { type, data } = event;

  // ============================================================================
  // USERS
  // ============================================================================
  if (type === 'user.created' || type === 'user.updated') {
    // Clerk's WebhookEvent payload shape for user events; cast via unknown at
    // this external boundary since UserJSON's structural type doesn't fully
    // overlap with our narrowed field subset.
    const clerkUser = data as unknown as {
      id: string;
      email_addresses: Array<{ email_address: string; primary: boolean }>;
      first_name: string | null;
      last_name: string | null;
      image_url: string | null;
      public_metadata: Record<string, unknown>;
    };

    const primaryEmail = clerkUser.email_addresses.find(e => e.primary)?.email_address
      ?? clerkUser.email_addresses[0]?.email_address;

    if (!primaryEmail) {
      return new Response('No email on user', { status: 400 });
    }

    if (!primaryEmail.toLowerCase().endsWith(`@${ALLOWED_EMAIL_DOMAIN}`)) {
      const client = await clerkClient();
      await client.users.banUser(clerkUser.id);
      return new Response(
        `Banned: email domain not allowed (must be @${ALLOWED_EMAIL_DOMAIN})`,
        { status: 403 }
      );
    }


    const name = [clerkUser.first_name, clerkUser.last_name].filter(Boolean).join(' ') || primaryEmail;
    const role = getCrmRole(clerkUser.public_metadata);

    await db.insert(users).values({
      id: clerkUser.id,
      email: primaryEmail,
      name,
      role,
      avatarUrl: clerkUser.image_url,
    }).onConflictDoUpdate({
      target: users.id,
      set: { email: primaryEmail, name, role, avatarUrl: clerkUser.image_url, updatedAt: new Date() },
    });
  }

  if (type === 'user.deleted') {
    const { id } = data as { id: string };
    await db.update(users)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(users.id, id));
  }

  // ============================================================================
  // ORGANIZATIONS (Teams)
  // ============================================================================
  if (type === 'organization.created' || type === 'organization.updated') {
    const clerkOrg = data as {
      id: string;
      name: string;
      slug: string | null;
      image_url: string | null;
    };

    await db.insert(organizations).values({
      id: clerkOrg.id,
      name: clerkOrg.name,
      slug: clerkOrg.slug ?? clerkOrg.id,
      imageUrl: clerkOrg.image_url,
    }).onConflictDoUpdate({
      target: organizations.id,
      set: { name: clerkOrg.name, slug: clerkOrg.slug ?? clerkOrg.id, imageUrl: clerkOrg.image_url, updatedAt: new Date() },
    });
  }

  if (type === 'organization.deleted') {
    const { id } = data as { id: string };
    await db.delete(organizations).where(eq(organizations.id, id));
  }

  // ============================================================================
  // ORGANIZATION MEMBERSHIPS (Team roster + role)
  // ============================================================================
  if (type === 'organizationMembership.created' || type === 'organizationMembership.updated') {
    const membership = data as {
      id: string;
      organization: { id: string };
      public_user_data: { user_id: string };
      role: string; // 'org:admin' | 'org:member' | custom
    };

    await db.insert(organizationMembers).values({
      id: membership.id,
      organizationId: membership.organization.id,
      userId: membership.public_user_data.user_id,
      role: membership.role,
    }).onConflictDoUpdate({
      target: organizationMembers.id,
      set: { role: membership.role },
    });
  }

  if (type === 'organizationMembership.deleted') {
    const { id } = data as { id: string };
    await db.delete(organizationMembers).where(eq(organizationMembers.id, id));
  }

  return new Response('OK', { status: 200 });
}
