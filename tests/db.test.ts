import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const poolQuery = vi.fn();
const poolEnd = vi.fn(() => Promise.resolve());
const poolOn = vi.fn();
// A regular function so `new pg.Pool(...)` works against the mock.
const PoolMock = vi.fn(function () {
  return { query: poolQuery, end: poolEnd, on: poolOn };
});
const setTypeParser = vi.fn();

vi.mock('pg', () => ({
  default: { Pool: PoolMock, types: { setTypeParser } },
}));

describe('db', () => {
  const original = process.env.DATABASE_URL;

  beforeEach(() => {
    vi.resetModules();
    PoolMock.mockClear();
    poolQuery.mockReset();
    poolEnd.mockClear();
    poolOn.mockClear();
    process.env.DATABASE_URL = 'postgresql://askdb_reader:x@host/db';
  });

  afterEach(() => {
    if (original === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = original;
  });

  it('fails clearly when DATABASE_URL is missing', async () => {
    delete process.env.DATABASE_URL;
    const { getPool } = await import('../src/db.js');
    expect(() => getPool()).toThrow(/DATABASE_URL is not set/);
  });

  it('keeps DATE columns as plain strings', async () => {
    await import('../src/db.js');
    expect(setTypeParser).toHaveBeenCalledWith(1082, expect.any(Function));
    const parser = setTypeParser.mock.calls[0]?.[1] as (v: string) => string;
    expect(parser('2026-09-30')).toBe('2026-09-30');
  });

  it('creates one pool with timeouts and reuses it', async () => {
    const { getPool, STATEMENT_TIMEOUT_MS } = await import('../src/db.js');
    const a = getPool();
    const b = getPool();
    expect(a).toBe(b);
    expect(PoolMock).toHaveBeenCalledTimes(1);
    expect(poolOn).toHaveBeenCalledTimes(1);
    expect(PoolMock).toHaveBeenCalledWith(
      expect.objectContaining({
        connectionString: 'postgresql://askdb_reader:x@host/db',
        statement_timeout: STATEMENT_TIMEOUT_MS,
        max: 3,
      }),
    );
  });

  it('runs parameterized queries and returns rows', async () => {
    poolQuery.mockResolvedValueOnce({ rows: [{ id: 1 }] });
    const { query } = await import('../src/db.js');
    const rows = await query<{ id: number }>('SELECT $1::int AS id', [1]);
    expect(rows).toEqual([{ id: 1 }]);
    expect(poolQuery).toHaveBeenCalledWith('SELECT $1::int AS id', [1]);
  });

  it('closes the pool once', async () => {
    const { getPool, closePool } = await import('../src/db.js');
    getPool();
    await closePool();
    await closePool();
    expect(poolEnd).toHaveBeenCalledTimes(1);
  });
});
