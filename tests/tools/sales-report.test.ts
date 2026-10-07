import { beforeEach, describe, expect, it, vi } from 'vitest';
import { query } from '../../src/db.js';
import { SQL, handler, inputSchema } from '../../src/tools/sales-report.js';

vi.mock('../../src/db.js', () => ({ query: vi.fn() }));
const mockQuery = vi.mocked(query);

describe('sales_report', () => {
  beforeEach(() => mockQuery.mockReset());

  it('requires a known groupBy and valid dates', () => {
    expect(inputSchema.safeParse({}).success).toBe(false);
    expect(inputSchema.safeParse({ groupBy: 'week' }).success).toBe(false);
    expect(
      inputSchema.safeParse({ groupBy: 'month', from: '2026-1-1' }).success,
    ).toBe(false);
    expect(inputSchema.parse({ groupBy: 'month' })).toEqual({
      groupBy: 'month',
      limit: 24,
    });
  });

  it('only ever counts paid orders, in every dimension', () => {
    for (const sql of Object.values(SQL)) {
      expect(sql).toContain("o.status = 'paid'");
      expect(sql).toContain('LIMIT $3');
      expect(sql).not.toMatch(/\b(INSERT|UPDATE|DELETE|DROP)\b/i);
    }
  });

  it('aggregates by month in ascending order with totals', async () => {
    mockQuery.mockResolvedValueOnce([
      { label: '2026-08', orders: '320', revenue: '512345.67' },
      { label: '2026-09', orders: '301', revenue: '480000' },
    ]);
    const result = await handler(
      inputSchema.parse({ groupBy: 'month', from: '2026-08-01' }),
    );
    expect(mockQuery).toHaveBeenCalledWith(SQL.month, ['2026-08-01', null, 24]);
    expect(result.structuredContent).toEqual({
      groupBy: 'month',
      from: '2026-08-01',
      to: null,
      status: 'paid',
      count: 2,
      rows: [
        { label: '2026-08', orders: 320, revenue: 512345.67 },
        { label: '2026-09', orders: 301, revenue: 480000 },
      ],
      totalOrders: 621,
      totalRevenue: 992345.67,
    });
    const text = (result.content[0] as { text: string }).text;
    expect(text).toContain('Paid sales by month (from 2026-08-01)');
    expect(text).toContain('| 2026-08 | 320 | RD$512,345.67 |');
    expect(text).toContain('Total: 621 orders · RD$992,345.67');
  });

  it('uses the category query and explains how revenue is counted', async () => {
    mockQuery.mockResolvedValueOnce([
      { label: 'Bebidas', orders: '900', revenue: '1000' },
    ]);
    const result = await handler(inputSchema.parse({ groupBy: 'category' }));
    expect(mockQuery).toHaveBeenCalledWith(SQL.category, [null, null, 24]);
    expect((result.content[0] as { text: string }).text).toContain(
      'sum of line totals',
    );
  });

  it('returns an empty report (not an error) when nothing matches', async () => {
    mockQuery.mockResolvedValueOnce([]);
    const result = await handler(
      inputSchema.parse({ groupBy: 'province', from: '2030-01-01' }),
    );
    expect(result.isError).toBeUndefined();
    expect(result.structuredContent).toMatchObject({
      count: 0,
      totalOrders: 0,
      totalRevenue: 0,
    });
    expect((result.content[0] as { text: string }).text).toContain(
      'No paid orders in the selected range',
    );
  });

  it('rejects an inverted date range without querying', async () => {
    const result = await handler(
      inputSchema.parse({
        groupBy: 'sales_rep',
        from: '2026-09-01',
        to: '2026-01-01',
      }),
    );
    expect(result.isError).toBe(true);
    expect(mockQuery).not.toHaveBeenCalled();
  });
});
