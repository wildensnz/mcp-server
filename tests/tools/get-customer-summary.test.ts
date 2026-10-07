import { beforeEach, describe, expect, it, vi } from 'vitest';
import { query } from '../../src/db.js';
import {
  CUSTOMER_SQL,
  TOTALS_SQL,
  handler,
  inputSchema,
} from '../../src/tools/get-customer-summary.js';

vi.mock('../../src/db.js', () => ({ query: vi.fn() }));
const mockQuery = vi.mocked(query);

describe('get_customer_summary', () => {
  beforeEach(() => mockQuery.mockReset());

  it('requires a positive integer id', () => {
    expect(inputSchema.safeParse({ customerId: 0 }).success).toBe(false);
    expect(inputSchema.safeParse({ customerId: 1.5 }).success).toBe(false);
    expect(inputSchema.safeParse({}).success).toBe(false);
  });

  it('returns isError when the customer does not exist', async () => {
    mockQuery.mockResolvedValueOnce([]);
    const result = await handler({ customerId: 999 });
    expect(result.isError).toBe(true);
    expect((result.content[0] as { text: string }).text).toContain(
      'Customer 999 not found',
    );
    expect(mockQuery).toHaveBeenCalledTimes(1);
    expect(mockQuery).toHaveBeenCalledWith(CUSTOMER_SQL, [999]);
  });

  it('combines profile and totals, converting pg strings to numbers', async () => {
    mockQuery
      .mockResolvedValueOnce([
        {
          id: 12,
          name: 'Colmado Doña Ana',
          customer_type: 'Colmado',
          province: 'La Vega',
          city: 'Cotuí',
          since: '2025-11-03',
          sales_rep: 'Luis Gómez',
        },
      ])
      .mockResolvedValueOnce([
        {
          paid_orders: '14',
          paid_total: '35250.50',
          pending_orders: '2',
          pending_total: '4100',
          cancelled_orders: '1',
          last_order_date: '2026-09-28',
        },
      ]);
    const result = await handler({ customerId: 12 });
    expect(mockQuery).toHaveBeenNthCalledWith(2, TOTALS_SQL, [12]);
    expect(result.isError).toBeUndefined();
    expect(result.structuredContent).toEqual({
      customer: {
        id: 12,
        name: 'Colmado Doña Ana',
        customerType: 'Colmado',
        province: 'La Vega',
        city: 'Cotuí',
        salesRep: 'Luis Gómez',
        since: '2025-11-03',
      },
      paidOrders: 14,
      paidTotal: 35250.5,
      pendingOrders: 2,
      pendingTotal: 4100,
      cancelledOrders: 1,
      lastOrderDate: '2026-09-28',
    });
    const text = (result.content[0] as { text: string }).text;
    expect(text).toContain('**Colmado Doña Ana** (id 12)');
    expect(text).toContain('Total purchased: RD$35,250.50');
    expect(text).toContain('Pending orders: 2 (RD$4,100.00)');
  });

  it('handles a customer with no orders', async () => {
    mockQuery
      .mockResolvedValueOnce([
        {
          id: 1,
          name: 'Nuevo',
          customer_type: 'Minimarket',
          province: 'Azua',
          city: 'Azua',
          since: '2026-09-01',
          sales_rep: 'Ana',
        },
      ])
      .mockResolvedValueOnce([
        {
          paid_orders: '0',
          paid_total: '0',
          pending_orders: '0',
          pending_total: '0',
          cancelled_orders: '0',
          last_order_date: null,
        },
      ]);
    const result = await handler({ customerId: 1 });
    expect(result.structuredContent).toMatchObject({
      paidOrders: 0,
      paidTotal: 0,
      lastOrderDate: null,
    });
    expect((result.content[0] as { text: string }).text).toContain(
      'Last order (not cancelled): none',
    );
  });
});
