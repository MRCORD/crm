import { headers } from 'next/headers';
import { WebhookEvent } from '@clerk/nextjs/server';
import { Webhook } from 'svix';
import { db } from '@/db';
import { users } from '@/db/schema';
import { getCrmRole } from '@/lib/clerk';
import { eq } from 'drizzle-orm';

/**
 * POST /api/webhooks/clerk
 *
 * Syncs Clerk identity events into system.users so CRM FKs
 * (crm.opportunities.owner_id, crm.companies.owner_id, etc.) remain valid.
 *
 * Configure in Clerk Dashboard → Webhooks:
 *   URL: https://your-domain.com/api/webhooks/clerk
 *   Events: user.created, user.updated, user.deleted
 */
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

  let event: WebhookEvent;
  try {
    event = wh.verify(body, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    }) as WebhookEvent;
  } catch {
    return new Response('Invalid webhook signature', { status: 400 });
  }

  const { type, data } = event;

  if (type === 'user.created' || type === 'user.updated') {
    const clerkUser = data as {
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

  return new Response('OK', { status: 200 });
}
