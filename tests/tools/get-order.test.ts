import { beforeEach, describe, expect, it, vi } from 'vitest';
import { query } from '../../src/db.js';
import {
  HEADER_SQL,
  ITEMS_SQL,
  handler,
  inputSchema,
} from '../../src/tools/get-order.js';

vi.mock('../../src/db.js', () => ({ query: vi.fn() }));
const mockQuery = vi.mocked(query);

describe('get_order', () => {
  beforeEach(() => mockQuery.mockReset());

  it('requires a positive integer id', () => {
    expect(inputSchema.safeParse({ orderId: -1 }).success).toBe(false);
    expect(inputSchema.safeParse({ orderId: '5' }).success).toBe(false);
  });

  it('returns isError for an unknown order and skips the items query', async () => {
    mockQuery.mockResolvedValueOnce([]);
    const result = await handler({ orderId: 123456 });
    expect(result.isError).toBe(true);
    expect((result.content[0] as { text: string }).text).toContain(
      'Order 123456 not found',
    );
    expect(mockQuery).toHaveBeenCalledTimes(1);
    expect(mockQuery).toHaveBeenCalledWith(HEADER_SQL, [123456]);
  });

  it('returns header and line items', async () => {
    mockQuery
      .mockResolvedValueOnce([
        {
          id: 10,
          order_date: '2026-05-04',
          status: 'paid',
          total: '1500.00',
          customer_id: 3,
          customer: 'Super Pipe',
          province: 'Santo Domingo',
          city: 'Los Alcarrizos',
          sales_rep: 'Luis Gómez',
        },
      ])
      .mockResolvedValueOnce([
        {
          product_id: 4,
          product: 'Jugo de Chinola 1 L',
          brand: 'Rica',
          category: 'Bebidas',
          quantity: 10,
          unit: 'unidad',
          unit_price: '95.00',
          line_total: '950.00',
        },
        {
          product_id: 12,
          product: 'Papitas Sal 45 g',
          brand: 'Frito Lay',
          category: 'Snacks',
          quantity: 11,
          unit: 'unidad',
          unit_price: '50.00',
          line_total: '550.00',
        },
      ]);
    const result = await handler({ orderId: 10 });
    expect(mockQuery).toHaveBeenNthCalledWith(2, ITEMS_SQL, [10]);
    expect(result.isError).toBeUndefined();
    expect(result.structuredContent).toEqual({
      order: {
        id: 10,
        date: '2026-05-04',
        status: 'paid',
        total: 1500,
        customer: {
          id: 3,
          name: 'Super Pipe',
          province: 'Santo Domingo',
          city: 'Los Alcarrizos',
        },
        salesRep: 'Luis Gómez',
      },
      items: [
        {
          productId: 4,
          product: 'Jugo de Chinola 1 L',
          brand: 'Rica',
          category: 'Bebidas',
          quantity: 10,
          unit: 'unidad',
          unitPrice: 95,
          lineTotal: 950,
        },
        {
          productId: 12,
          product: 'Papitas Sal 45 g',
          brand: 'Frito Lay',
          category: 'Snacks',
          quantity: 11,
          unit: 'unidad',
          unitPrice: 50,
          lineTotal: 550,
        },
      ],
    });
    const text = (result.content[0] as { text: string }).text;
    expect(text).toContain(
      '**Order 10** · 2026-05-04 · paid · total RD$1,500.00',
    );
    expect(text).toContain('2 line items:');
    expect(text).toContain(
      '| Jugo de Chinola 1 L | Rica | 10 | unidad | RD$95.00 | RD$950.00 |',
    );
  });
});
