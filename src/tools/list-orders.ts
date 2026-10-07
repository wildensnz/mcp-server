import type { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import { query } from '../db.js';
import { amount, date, money, plural, table } from '../format.js';
import {
  describeRange,
  fail,
  guard,
  idSchema,
  isoDateSchema,
  limitSchema,
  ok,
  rangeError,
} from './shared.js';

export const orderStatus = z.enum(['paid', 'pending', 'cancelled']);

export const inputSchema = z.object({
  customerId: idSchema
    .optional()
    .describe('Only orders of this customer (id from search_customers).'),
  status: orderStatus.optional().describe('Only orders with this status.'),
  from: isoDateSchema.optional().describe('Earliest order date, YYYY-MM-DD.'),
  to: isoDateSchema.optional().describe('Latest order date, YYYY-MM-DD.'),
  limit: limitSchema(50, 20),
});

export const outputSchema = z.object({
  filters: z.object({
    customerId: z.number().int().nullable(),
    status: orderStatus.nullable(),
    from: z.string().nullable(),
    to: z.string().nullable(),
  }),
  count: z.number().int(),
  orders: z.array(
    z.object({
      id: z.number().int(),
      date: z.string(),
      customerId: z.number().int(),
      customer: z.string(),
      salesRep: z.string(),
      status: orderStatus,
      total: z.number(),
    }),
  ),
});

export type Input = z.output<typeof inputSchema>;
export type Output = z.output<typeof outputSchema>;

interface Row {
  id: number;
  order_date: string;
  customer_id: number;
  customer: string;
  sales_rep: string;
  status: 'paid' | 'pending' | 'cancelled';
  total: string;
}

export const SQL = `
SELECT o.id, o.order_date, o.customer_id, c.name AS customer,
       r.name AS sales_rep, o.status, o.total
FROM orders o
JOIN customers c ON c.id = o.customer_id
JOIN sales_reps r ON r.id = o.sales_rep_id
WHERE ($1::int  IS NULL OR o.customer_id = $1)
  AND ($2::text IS NULL OR o.status = $2)
  AND ($3::date IS NULL OR o.order_date >= $3)
  AND ($4::date IS NULL OR o.order_date <= $4)
ORDER BY o.order_date DESC, o.id DESC
LIMIT $5`;

export function handler(input: Input) {
  return guard('list_orders', async () => {
    const bad = rangeError(input.from, input.to);
    if (bad) return fail(bad);

    const rows = await query<Row>(SQL, [
      input.customerId ?? null,
      input.status ?? null,
      input.from ?? null,
      input.to ?? null,
      input.limit,
    ]);
    const orders = rows.map((r) => ({
      id: r.id,
      date: date(r.order_date),
      customerId: r.customer_id,
      customer: r.customer,
      salesRep: r.sales_rep,
      status: r.status,
      total: amount(r.total),
    }));
    const output: Output = {
      filters: {
        customerId: input.customerId ?? null,
        status: input.status ?? null,
        from: input.from ?? null,
        to: input.to ?? null,
      },
      count: orders.length,
      orders,
    };
    const filters = [
      input.customerId ? `customer ${input.customerId}` : 'all customers',
      input.status ?? 'any status',
      describeRange(input.from, input.to),
    ].join(' · ');
    const heading =
      orders.length === 0
        ? `No orders found (${filters}).`
        : `${plural(orders.length, 'order')} (${filters}), newest first` +
          (orders.length === input.limit ? `, limited to ${input.limit}` : '');
    const body = table(orders, [
      { key: 'id' },
      { key: 'date' },
      { key: 'customer' },
      { key: 'salesRep', label: 'sales rep' },
      { key: 'status' },
      { key: 'total', align: 'right', format: (v) => money(v) },
    ]);
    return ok(`${heading}\n\n${body}`, output);
  });
}

export function register(server: McpServer): void {
  server.registerTool(
    'list_orders',
    {
      title: 'List orders',
      description:
        'List orders, newest first, optionally filtered by customer id, status ' +
        '(paid, pending, cancelled) and date range (YYYY-MM-DD). Returns id, date, ' +
        'customer, sales rep, status and RD$ total per order. Max 50 rows; use ' +
        'get_order for the line items and sales_report for aggregates.',
      inputSchema,
      outputSchema,
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    handler,
  );
}
