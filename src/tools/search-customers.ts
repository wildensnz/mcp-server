import type { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import { query } from '../db.js';
import { plural, table } from '../format.js';
import { escapeLike, guard, limitSchema, ok } from './shared.js';

export const inputSchema = z.object({
  query: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .describe(
      'Text to match (partial, case-insensitive) against customer name, city or province.',
    ),
  limit: limitSchema(20, 10),
});

export const outputSchema = z.object({
  query: z.string(),
  count: z.number().int(),
  customers: z.array(
    z.object({
      id: z.number().int(),
      name: z.string(),
      customerType: z.string(),
      province: z.string(),
      city: z.string(),
      salesRep: z.string(),
    }),
  ),
});

export type Input = z.output<typeof inputSchema>;
export type Output = z.output<typeof outputSchema>;

interface Row {
  id: number;
  name: string;
  customer_type: string;
  province: string;
  city: string;
  sales_rep: string;
}

export const SQL = `
SELECT c.id, c.name, c.customer_type, c.province, c.city, r.name AS sales_rep
FROM customers c
JOIN sales_reps r ON r.id = c.sales_rep_id
WHERE c.name ILIKE $1 ESCAPE '\\'
   OR c.city ILIKE $1 ESCAPE '\\'
   OR c.province ILIKE $1 ESCAPE '\\'
ORDER BY c.name
LIMIT $2`;

export function handler(input: Input) {
  return guard('search_customers', async () => {
    const pattern = `%${escapeLike(input.query)}%`;
    const rows = await query<Row>(SQL, [pattern, input.limit]);
    const customers = rows.map((r) => ({
      id: r.id,
      name: r.name,
      customerType: r.customer_type,
      province: r.province,
      city: r.city,
      salesRep: r.sales_rep,
    }));
    const output: Output = {
      query: input.query,
      count: customers.length,
      customers,
    };
    const heading =
      customers.length === 0
        ? `No customers match "${input.query}".`
        : `${plural(customers.length, 'customer')} matching "${input.query}"` +
          (customers.length === input.limit ? ` (limit ${input.limit})` : '');
    const body = table(customers, [
      { key: 'id' },
      { key: 'name' },
      { key: 'customerType', label: 'type' },
      { key: 'province' },
      { key: 'city' },
      { key: 'salesRep', label: 'sales rep' },
    ]);
    return ok(`${heading}\n\n${body}`, output);
  });
}

export function register(server: McpServer): void {
  server.registerTool(
    'search_customers',
    {
      title: 'Search customers',
      description:
        'Find customers of Colmado Digital by partial name, city or province (case-insensitive). ' +
        'Returns id, name, type (Colmado, Supermercado...), province, city and sales rep. ' +
        'Use the returned id with get_customer_summary or list_orders. Max 20 rows.',
      inputSchema,
      outputSchema,
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    handler,
  );
}
