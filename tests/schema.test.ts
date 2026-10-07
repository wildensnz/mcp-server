import { beforeEach, describe, expect, it, vi } from 'vitest';
import { query } from '../src/db.js';
import {
  RANGE_SQL,
  SCHEMA_URI,
  readSchema,
  schemaText,
} from '../src/resources/schema.js';

vi.mock('../src/db.js', () => ({ query: vi.fn() }));
const mockQuery = vi.mocked(query);

describe('store://schema', () => {
  beforeEach(() => mockQuery.mockReset());

  it('has a stable uri', () => {
    expect(SCHEMA_URI).toBe('store://schema');
  });

  it('describes every table and the paid-only rule', () => {
    const text = schemaText();
    for (const table of [
      'categories',
      'products',
      'sales_reps',
      'customers',
      'orders',
      'order_items',
    ]) {
      expect(text).toContain(`- ${table}(`);
    }
    expect(text).toContain('stock');
    expect(text).toContain('status = paid');
    expect(text).toContain('RD$');
  });

  it('includes the live date range when the query succeeds', async () => {
    mockQuery.mockResolvedValueOnce([
      { first_date: '2025-10-01', last_date: '2026-09-30', orders: '4000' },
    ]);
    const text = await readSchema();
    expect(mockQuery).toHaveBeenCalledWith(RANGE_SQL);
    expect(text).toContain(
      'Orders span 2025-10-01 to 2026-09-30 (4000 orders)',
    );
  });

  it('still returns the schema when the database is unreachable', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mockQuery.mockRejectedValueOnce(new Error('connection refused'));
    const text = await readSchema();
    expect(text).toContain('# Colmado Digital');
    expect(text).not.toContain('Orders span');
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
