import { beforeEach, describe, expect, it, vi } from 'vitest';
import { query } from '../../src/db.js';
import { SQL, handler, inputSchema } from '../../src/tools/list-orders.js';

vi.mock('../../src/db.js', () => ({ query: vi.fn() }));
const mockQuery = vi.mocked(query);

const row = {
  id: 3999,
  order_date: '2026-09-30',
  customer_id: 42,
  customer: 'Colmado Reyes',
  sales_rep: 'Ana Pérez',
  status: 'paid' as const,
  total: '2095.00',
};

describe('list_orders', () => {
  beforeEach(() => mockQuery.mockReset());

  it('validates status, dates and limit', () => {
    expect(inputSchema.safeParse({ status: 'shipped' }).success).toBe(false);
    expect(inputSchema.safeParse({ from: '2026-13-01' }).success).toBe(false);
    expect(inputSchema.safeParse({ from: '2026-02-30' }).success).toBe(false);
    expect(inputSchema.safeParse({ from: '30/09/2026' }).success).toBe(false);
    expect(inputSchema.safeParse({ limit: 500 }).success).toBe(false);
    expect(inputSchema.parse({})).toEqual({ limit: 20 });
  });

  it('passes nulls for absent filters and the limit', async () => {
    mockQuery.mockResolvedValueOnce([row]);
    const result = await handler(inputSchema.parse({}));
    expect(mockQuery).toHaveBeenCalledWith(SQL, [null, null, null, null, 20]);
    expect(result.structuredContent).toEqual({
      filters: { customerId: null, status: null, from: null, to: null },
      count: 1,
      orders: [
        {
          id: 3999,
          date: '2026-09-30',
          customerId: 42,
          customer: 'Colmado Reyes',
          salesRep: 'Ana Pérez',
          status: 'paid',
          total: 2095,
        },
      ],
    });
    const text = (result.content[0] as { text: string }).text;
    expect(text).toContain('1 order (all customers · any status · all dates)');
    expect(text).toContain('| 3999 | 2026-09-30 | Colmado Reyes |');
    expect(text).toContain('RD$2,095.00');
  });

  it('passes every filter through as parameters', async () => {
    mockQuery.mockResolvedValueOnce([]);
    const result = await handler(
      inputSchema.parse({
        customerId: 42,
        status: 'pending',
        from: '2026-01-01',
        to: '2026-03-31',
        limit: 5,
      }),
    );
    expect(mockQuery).toHaveBeenCalledWith(SQL, [
      42,
      'pending',
      '2026-01-01',
      '2026-03-31',
      5,
    ]);
    expect(result.isError).toBeUndefined();
    expect((result.content[0] as { text: string }).text).toContain(
      'No orders found (customer 42 · pending · 2026-01-01 to 2026-03-31)',
    );
  });

  it('rejects a range whose from is after to without querying', async () => {
    const result = await handler(
      inputSchema.parse({ from: '2026-06-01', to: '2026-05-01' }),
    );
    expect(result.isError).toBe(true);
    expect((result.content[0] as { text: string }).text).toContain(
      'Invalid date range',
    );
    expect(mockQuery).not.toHaveBeenCalled();
  });
});
