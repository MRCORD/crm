import 'dotenv/config';
import postgres from 'postgres';

async function initDatabase() {
  const url = process.env.DATABASE_URL || process.env.DIRECT_URL;
  if (!url) {
    throw new Error('DATABASE_URL or DIRECT_URL is required in .env');
  }

  console.log('[Init] Connecting to Polygres database...');
  const sql = postgres(url, { ssl: 'require', max: 1 });

  try {
    const [version] = await sql`SELECT version()`;
    console.log('[Init] Connected successfully!');
    console.log('[Init] PostgreSQL Version:', version.version);

    console.log('[Init] Enabling extensions...');
    try {
      await sql`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`;
      console.log('[Init] Extension uuid-ossp enabled.');
    } catch (e: unknown) {
      console.warn('[Init] uuid-ossp notice:', e instanceof Error ? e.message : e);
    }

    try {
      await sql`CREATE EXTENSION IF NOT EXISTS "vector"`;
      console.log('[Init] Extension vector enabled.');
    } catch (e: unknown) {
      console.warn('[Init] vector extension notice:', e instanceof Error ? e.message : e);
    }

    console.log('[Init] Creating logical schemas: system, crm, mcp, retrieval, ingest...');
    await sql`CREATE SCHEMA IF NOT EXISTS system`;
    await sql`CREATE SCHEMA IF NOT EXISTS crm`;
    await sql`CREATE SCHEMA IF NOT EXISTS mcp`;
    await sql`CREATE SCHEMA IF NOT EXISTS retrieval`;
    await sql`CREATE SCHEMA IF NOT EXISTS ingest`;
    console.log('[Init] All 5 logical schemas created successfully!');

    const schemas = await sql`
      SELECT schema_name 
      FROM information_schema.schemata 
      WHERE schema_name IN ('system', 'crm', 'mcp', 'retrieval', 'ingest')
      ORDER BY schema_name
    `;
    console.log('[Init] Verified schemas in database:', schemas.map(s => s.schema_name).join(', '));
  } finally {
    await sql.end();
  }
}

initDatabase().catch((err: unknown) => {
  console.error('[Init Fatal Error]', err);
  process.exit(1);
});
