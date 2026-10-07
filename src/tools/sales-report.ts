import type { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import { query } from '../db.js';
import { amount, integer, money, table } from '../format.js';
import {
  describeRange,
  fail,
  guard,
  isoDateSchema,
  limitSchema,
  ok,
  rangeError,
} from './shared.js';

export const groupBy = z.enum(['month', 'category', 'sales_rep', 'province']);
export type GroupBy = z.output<typeof groupBy>;

export const inputSchema = z.object({
  groupBy: groupBy.describe(
    'Dimension to aggregate by: month (YYYY-MM), product category, sales rep or customer province.',
  ),
  from: isoDateSchema.optional().describe('Earliest order date, YYYY-MM-DD.'),
  to: isoDateSchema.optional().describe('Latest order date, YYYY-MM-DD.'),
  limit: limitSchema(50, 24),
});

export const outputSchema = z.object({
  groupBy,
  from: z.string().nullable(),
  to: z.string().nullable(),
  status: z.literal('paid'),
  count: z.number().int(),
  rows: z.array(
    z.object({
      label: z.string(),
      orders: z.number().int(),
      revenue: z.number(),
    }),
  ),
  totalOrders: z.number().int(),
  totalRevenue: z.number(),
});

export type Input = z.output<typeof inputSchema>;
export type Output = z.output<typeof outputSchema>;

interface Row {
  label: string;
  orders: string;
  revenue: string;
}

const DATE_FILTER = `
  AND ($1::date IS NULL OR o.order_date >= $1)
  AND ($2::date IS NULL OR o.order_date <= $2)`;

/** One fixed query per dimension; only paid orders count as sales. */
export const SQL: Record<GroupBy, string> = {
  month: `
SELECT to_char(date_trunc('month', o.order_date), 'YYYY-MM') AS label,
       count(*) AS orders, sum(o.total) AS revenue
FROM orders o
WHERE o.status = 'paid'${DATE_FILTER}
GROUP BY 1
ORDER BY 1
LIMIT $3`,
  category: `
SELECT cat.name AS label,
       count(DISTINCT o.id) AS orders, sum(oi.line_total) AS revenue
FROM order_items oi
JOIN orders o ON o.id = oi.order_id
JOIN products p ON p.id = oi.product_id
JOIN categories cat ON cat.id = p.category_id
WHERE o.status = 'paid'${DATE_FILTER}
GROUP BY cat.id, cat.name
ORDER BY revenue DESC, label
LIMIT $3`,
  sales_rep: `
SELECT r.name AS label, count(*) AS orders, sum(o.total) AS revenue
FROM orders o
JOIN sales_reps r ON r.id = o.sales_rep_id
WHERE o.status = 'paid'${DATE_FILTER}
GROUP BY r.id, r.name
ORDER BY revenue DESC, label
LIMIT $3`,
  province: `
SELECT c.province AS label, count(*) AS orders, sum(o.total) AS revenue
FROM orders o
JOIN customers c ON c.id = o.customer_id
WHERE o.status = 'paid'${DATE_FILTER}
GROUP BY c.province
ORDER BY revenue DESC, label
LIMIT $3`,
};

const LABELS: Record<GroupBy, string> = {
  month: 'month',
  category: 'category',
  sales_rep: 'sales rep',
  province: 'province',
};

export function handler(input: Input) {
  return guard('sales_report', async () => {
    const bad = rangeError(input.from, input.to);
    if (bad) return fail(bad);

    const rows = await query<Row>(SQL[input.groupBy], [
      input.from ?? null,
      input.to ?? null,
      input.limit,
    ]);
    const report = rows.map((r) => ({
      label: r.label,
      orders: Number(r.orders),
      revenue: amount(r.revenue),
    }));
    const totalOrders = report.reduce((s, r) => s + r.orders, 0);
    const totalRevenue = amount(report.reduce((s, r) => s + r.revenue, 0));
    const output: Output = {
      groupBy: input.groupBy,
      from: input.from ?? null,
      to: input.to ?? null,
      status: 'paid',
      count: report.length,
      rows: report,
      totalOrders,
      totalRevenue,
    };
    const range = describeRange(input.from, input.to);
    if (report.length === 0) {
      return ok(`No paid orders in the selected range (${range}).`, output);
    }
    const note =
      input.groupBy === 'category'
        ? 'Revenue is the sum of line totals; an order with several categories counts once per category.'
        : '';
    const text = [
      `Paid sales by ${LABELS[input.groupBy]} (${range})` +
        (report.length === input.limit
          ? `, limited to ${input.limit} rows`
          : ''),
      '',
      table(report, [
        { key: 'label', label: LABELS[input.groupBy] },
        { key: 'orders', align: 'right', format: integer },
        { key: 'revenue', align: 'right', format: money },
      ]),
      '',
      `Total: ${integer(totalOrders)} orders · ${money(totalRevenue)}`,
      note,
    ]
      .join('\n')
      .trimEnd();
    return ok(text, output);
  });
}

export function register(server: McpServer): void {
  server.registerTool(
    'sales_report',
    {
      title: 'Sales report',
      description:
        'Aggregate paid sales (RD$ revenue and order count) grouped by month, product ' +
        'category, sales rep or customer province, with an optional date range ' +
        '(YYYY-MM-DD). Only orders with status paid count. Use it for "sales by month", ' +
        '"best category", "top rep" or "revenue by province". Max 50 rows.',
      inputSchema,
      outputSchema,
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    handler,
  );
}
