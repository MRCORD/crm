/**
 * Edge-aware Postgres client for Next.js routes deployed to Cloudflare Workers.
 *
 * Cloudflare Workers cannot open a raw TCP connection directly — outbound
 * PostgreSQL wire-protocol connections must go through Cloudflare Hyperdrive
 * (see wrangler.jsonc `hyperdrive` binding). Hyperdrive exposes a per-request
 * connection string via `env.HYPERDRIVE.connectionString`.
 *
 * Locally (`next dev` / `next build` outside Workers), there is no Cloudflare
 * `env` binding, so this falls back to `process.env.DATABASE_URL` — the same
 * direct Polygres connection the MCP server and all `src/lib/*.ts` modules use.
 *
 * IMPORTANT: This client is separate from `src/db/index.ts` (the MCP server's
 * long-lived singleton). Cloudflare Workers are request-scoped — a new
 * lightweight client is created per request here, which is fast because
 * Hyperdrive maintains the actual connection pool on Cloudflare's side.
 */
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import * as schema from './schema/index';

interface HyperdriveEnv {
  HYPERDRIVE?: { connectionString: string };
}

async function resolveConnectionString(): Promise<string> {
  try {
    // Only resolves when running inside a Cloudflare Workers request context
    // (deployed via @opennextjs/cloudflare, or `next dev` with
    // initOpenNextCloudflareForDev() active in next.config.ts). Throws
    // outside that context, which we treat as "not on Workers".
    const { env } = await getCloudflareContext({ async: true });
    const hyperdriveEnv = env as HyperdriveEnv;
    if (hyperdriveEnv.HYPERDRIVE?.connectionString) {
      return hyperdriveEnv.HYPERDRIVE.connectionString;
    }
  } catch {
    // Not running in a Cloudflare Workers context — fall through to env var.
  }

  const fallback = process.env.DATABASE_URL || process.env.DIRECT_URL;
  if (!fallback) {
    throw new Error('No database connection available: neither Hyperdrive binding nor DATABASE_URL is set.');
  }
  return fallback;
}

/**
 * Create a fresh Drizzle client for the current request.
 * Cheap to call per-request under Hyperdrive (pooling happens on Cloudflare's side).
 */
export async function getEdgeDb() {
  const connectionString = await resolveConnectionString();
  const client = postgres(connectionString, {
    prepare: false,
    max: 5,
    connection: {
      search_path: 'crm,system,mcp,retrieval,ingest,public',
    },
  });
  return drizzle(client, { schema });
}
