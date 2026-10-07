import type { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import { query } from '../db.js';
import { amount, integer, money, table } from '../format.js';
import { guard, limitSchema, ok } from './shared.js';

export const inputSchema = z.object({
  threshold: z
    .number()
    .int()
    .min(0)
    .max(10000)
    .default(10)
    .describe(
      'Report active products with stock strictly below this (default 10).',
    ),
  limit: limitSchema(50, 20),
});

export const outputSchema = z.object({
  threshold: z.number().int(),
  count: z.number().int(),
  totalBelowThreshold: z.number().int(),
  products: z.array(
    z.object({
      id: z.number().int(),
      name: z.string(),
      brand: z.string(),
      category: z.string(),
      unit: z.string(),
      stock: z.number().int(),
      unitPrice: z.number(),
    }),
  ),
});

export type Input = z.output<typeof inputSchema>;
export type Output = z.output<typeof outputSchema>;

interface Row {
  id: number;
  name: string;
  brand: string;
  category: string;
  unit: string;
  stock: number;
  unit_price: string;
  total_matching: string;
}

export const SQL = `
SELECT p.id, p.name, p.brand, c.name AS category, p.unit, p.stock, p.unit_price,
       count(*) OVER () AS total_matching
FROM products p
JOIN categories c ON c.id = p.category_id
WHERE p.active AND p.stock < $1
ORDER BY p.stock ASC, p.name
LIMIT $2`;

export function handler(input: Input) {
  return guard('low_stock_products', async () => {
    const rows = await query<Row>(SQL, [input.threshold, input.limit]);
    const products = rows.map((r) => ({
      id: r.id,
      name: r.name,
      brand: r.brand,
      category: r.category,
      unit: r.unit,
      stock: r.stock,
      unitPrice: amount(r.unit_price),
    }));
    const totalBelowThreshold = Number(rows[0]?.total_matching ?? 0);
    const output: Output = {
      threshold: input.threshold,
      count: products.length,
      totalBelowThreshold,
      products,
    };
    const heading =
      products.length === 0
        ? `No active products with stock below ${input.threshold}.`
        : `${integer(totalBelowThreshold)} active products with stock below ${input.threshold}` +
          (totalBelowThreshold > products.length
            ? ` (showing ${products.length})`
            : '') +
          ', lowest first';
    const body = table(products, [
      { key: 'id' },
      { key: 'name' },
      { key: 'brand' },
      { key: 'category' },
      { key: 'stock', align: 'right', format: integer },
      { key: 'unit' },
      { key: 'unitPrice', label: 'unit price', align: 'right', format: money },
    ]);
    return ok(`${heading}\n\n${body}`, output);
  });
}

export function register(server: McpServer): void {
  server.registerTool(
    'low_stock_products',
    {
      title: 'Low stock products',
      description:
        'Active products whose stock (units on hand) is below a threshold, lowest first. ' +
        'Default threshold 10. Returns id, name, brand, category, stock, unit and RD$ unit ' +
        'price. Use it for "what is running out" or "what should we reorder". Max 50 rows.',
      inputSchema,
      outputSchema,
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    handler,
  );
}
