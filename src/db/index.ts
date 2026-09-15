import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema/index';

const connectionString = process.env.DATABASE_URL || process.env.DIRECT_URL || 'postgres://postgres:postgres@localhost:5432/crm';

// Disable prefetch for compatibility with serverless and connection poolers; configure search_path for all 5 schemas
const client = postgres(connectionString, {
  prepare: false,
  connection: {
    search_path: 'crm,system,mcp,retrieval,ingest,public',
  },
});

export const db = drizzle(client, { schema });
export type Database = typeof db;
