import { beforeEach, describe, expect, it, vi } from 'vitest';
import { query } from '../../src/db.js';
import {
  SQL,
  handler,
  inputSchema,
} from '../../src/tools/low-stock-products.js';

vi.mock('../../src/db.js', () => ({ query: vi.fn() }));
const mockQuery = vi.mocked(query);

const row = (id: number, name: string, stock: number, total: string) => ({
  id,
  name,
  brand: 'Marca',
  category: 'Bebidas',
  unit: 'unidad',
  stock,
  unit_price: '95.50',
  total_matching: total,
});

describe('low_stock_products', () => {
  beforeEach(() => mockQuery.mockReset());

  it('defaults threshold to 10 and limit to 20, and caps both', () => {
    expect(inputSchema.parse({})).toEqual({ threshold: 10, limit: 20 });
    expect(inputSchema.safeParse({ threshold: -1 }).success).toBe(false);
    expect(inputSchema.safeParse({ threshold: 2.5 }).success).toBe(false);
    expect(inputSchema.safeParse({ limit: 51 }).success).toBe(false);
  });

  it('lists products below the threshold, lowest first', async () => {
    mockQuery.mockResolvedValueOnce([
      row(4, 'Jugo de Chinola 1 L', 0, '2'),
      row(20, 'Chicle Menta 10 u', 2, '2'),
    ]);
    const result = await handler(inputSchema.parse({ threshold: 5 }));
    expect(mockQuery).toHaveBeenCalledWith(SQL, [5, 20]);
    expect(result.structuredContent).toEqual({
      threshold: 5,
      count: 2,
      totalBelowThreshold: 2,
      products: [
        {
          id: 4,
          name: 'Jugo de Chinola 1 L',
          brand: 'Marca',
          category: 'Bebidas',
          unit: 'unidad',
          stock: 0,
          unitPrice: 95.5,
        },
        {
          id: 20,
          name: 'Chicle Menta 10 u',
          brand: 'Marca',
          category: 'Bebidas',
          unit: 'unidad',
          stock: 2,
          unitPrice: 95.5,
        },
      ],
    });
    const text = (result.content[0] as { text: string }).text;
    expect(text).toContain(
      '2 active products with stock below 5, lowest first',
    );
    expect(text).toContain('| 4 | Jugo de Chinola 1 L | Marca | Bebidas | 0 |');
  });

  it('says how many more exist when the limit truncates the list', async () => {
    mockQuery.mockResolvedValueOnce([row(4, 'A', 0, '10')]);
    const result = await handler(inputSchema.parse({ limit: 1 }));
    expect(result.structuredContent).toMatchObject({
      count: 1,
      totalBelowThreshold: 10,
    });
    expect((result.content[0] as { text: string }).text).toContain(
      '10 active products with stock below 10 (showing 1)',
    );
  });

  it('returns a normal result when nothing is low', async () => {
    mockQuery.mockResolvedValueOnce([]);
    const result = await handler(inputSchema.parse({ threshold: 0 }));
    expect(result.isError).toBeUndefined();
    expect(result.structuredContent).toMatchObject({
      count: 0,
      totalBelowThreshold: 0,
    });
    expect((result.content[0] as { text: string }).text).toContain(
      'No active products with stock below 0',
    );
  });
});
