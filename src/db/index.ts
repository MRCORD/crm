import 'dotenv/config';
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import * as schema from './schema/index';

export type Database = PostgresJsDatabase<typeof schema>;

const SEARCH_PATH = 'crm,system,mcp,retrieval,ingest,public';

/**
 * Cloudflare Workers cannot reliably hold a raw outbound TCP connection to
 * Postgres — attempting one hangs indefinitely (`Worker threw exception: ...
 * detected that your Worker's code had hung`) rather than failing fast, since
 * workerd's `cloudflare:sockets` path is not equivalent to a real TCP stack.
 * All wire-protocol Postgres traffic from a deployed Worker MUST go through
 * Cloudflare Hyperdrive (`env.HYPERDRIVE.connectionString`), reachable via
 * `getCloudflareContext()` once the OpenNext worker entrypoint has populated
 * the global Cloudflare context (available synchronously in a deployed
 * Worker; throws everywhere else, which we treat as "not on Workers").
 *
 * Workers scope sockets/connections strictly to the request that opened
 * them — caching a postgres.js client across requests in a module-level
 * variable (an otherwise-normal Node.js pattern) leaves it holding a socket
 * tied to an already-completed request, which then hangs or throws on the
 * next request that touches it. So on Workers we open a fresh client per
 * access instead of caching one: Hyperdrive is explicitly designed to make
 * this cheap by pooling the real origin connections on Cloudflare's side.
 *
 * Node.js contexts (the MCP server via `pnpm mcp`, `src/db/migrate.ts`,
 * `src/db/seed.ts`, one-off scripts under `src/db/scripts/`, and local
 * `next dev`) have no such per-request socket scoping, so they keep one
 * long-lived pooled client for the whole process — the original behavior,
 * unchanged for the 66 MCP tools.
 */
function getHyperdriveConnectionString(): string | undefined {
  try {
    const { env } = getCloudflareContext() as { env?: { HYPERDRIVE?: { connectionString?: string } } };
    return env?.HYPERDRIVE?.connectionString;
  } catch {
    return undefined;
  }
}

function createClientDb(connectionString: string, maxConnections: number): Database {
  const client = postgres(connectionString, {
    prepare: false,
    max: maxConnections,
    connection: { search_path: SEARCH_PATH },
  });
  return drizzle(client, { schema });
}

let nodeDb: Database | null = null;

function getNodeDb(): Database {
  if (!nodeDb) {
    const connectionString =
      process.env.DATABASE_URL || process.env.DIRECT_URL || 'postgres://postgres:postgres@localhost:5432/crm';
    nodeDb = createClientDb(connectionString, 10);
  }
  return nodeDb;
}

function getDb(): Database {
  const hyperdriveUrl = getHyperdriveConnectionString();
  if (hyperdriveUrl) {
    return createClientDb(hyperdriveUrl, 1);
  }
  return getNodeDb();
}

// Proxy so every call site (`db.select()`, `db.query.companies.findMany()`, …)
// keeps working unchanged, while resolution happens lazily per access —
// letting a deployed Worker open a fresh Hyperdrive-routed client per access
// and Node.js processes share one long-lived direct-connection client.
export const db: Database = new Proxy({} as Database, {
  get(_target, prop, receiver) {
    return Reflect.get(getDb(), prop, receiver);
  },
});
