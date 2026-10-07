/**
 * Postgres access for the read-only role `askdb_reader`.
 *
 * Safety: the only connection string is DATABASE_URL (reader role, read-only
 * transactions enforced server-side). Every statement is parameterized and
 * capped by `statement_timeout` (server) and `query_timeout` (client).
 */
import pg from 'pg';

export const STATEMENT_TIMEOUT_MS = 5000;

/** DATE (oid 1082) comes back as 'YYYY-MM-DD' text, not a local-time Date. */
pg.types.setTypeParser(1082, (value) => value);

let pool: pg.Pool | undefined;

export function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      'DATABASE_URL is not set. Use the read-only connection string (role askdb_reader).',
    );
  }
  return url;
}

export function getPool(): pg.Pool {
  pool ??= new pg.Pool({
    connectionString: getDatabaseUrl(),
    application_name: 'store-mcp',
    max: 3,
    statement_timeout: STATEMENT_TIMEOUT_MS,
    query_timeout: STATEMENT_TIMEOUT_MS + 2000,
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 30_000,
  });
  pool.on('error', (error) => {
    console.error('pg pool error:', error.message);
  });
  return pool;
}

/** Runs one parameterized, read-only query and returns its rows. */
export async function query<T extends pg.QueryResultRow>(
  sql: string,
  params: readonly unknown[] = [],
): Promise<T[]> {
  const result = await getPool().query<T>(sql, [...params]);
  return result.rows;
}

export async function closePool(): Promise<void> {
  if (pool) {
    const p = pool;
    pool = undefined;
    await p.end();
  }
}
