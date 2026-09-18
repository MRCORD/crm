import 'dotenv/config';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { db } from './index';

async function runMigrations() {
  console.log('[Migrate] Running database migrations...');
  await migrate(db, { migrationsFolder: './src/db/migrations' });
  console.log('[Migrate] All migrations applied successfully.');
  process.exit(0);
}

runMigrations().catch((err: unknown) => {
  console.error('[Migrate Fatal Error]', err);
  process.exit(1);
});
