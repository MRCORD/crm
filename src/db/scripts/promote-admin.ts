/**
 * Promote a CRM user to admin role.
 *
 * Sets `publicMetadata.role = "admin"` on Clerk (authoritative source)
 * and updates system.users.role in Polygres.
 *
 * Usage:
 *   pnpm auth:promote oscar@acme.com
 */
import 'dotenv/config';
import { createClerkClient } from '@clerk/nextjs/server';
import { db } from '../index';
import { users } from '../schema';
import { eq } from 'drizzle-orm';

const email = process.argv[2];

if (!email) {
  console.error('Usage: pnpm auth:promote <email>');
  process.exit(1);
}

async function promote() {
  const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! });

  const { data } = await clerk.users.getUserList({ emailAddress: [email] });
  const clerkUser = data[0];

  if (!clerkUser) {
    console.error(`No Clerk user found with email: ${email}`);
    process.exit(1);
  }

  // Set role on Clerk (session claims will include this going forward)
  await clerk.users.updateUser(clerkUser.id, {
    publicMetadata: { ...clerkUser.publicMetadata, role: 'admin' },
  });

  // Mirror in our Postgres
  await db.update(users)
    .set({ role: 'admin', updatedAt: new Date() })
    .where(eq(users.id, clerkUser.id));

  console.log(`✅ ${email} promoted to admin in both Clerk and Polygres.`);
  process.exit(0);
}

promote().catch((err: unknown) => {
  console.error('[promote-admin error]', err);
  process.exit(1);
});
