import type { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import { query } from '../db.js';
import { amount, date, money, plural, table } from '../format.js';
import { fail, guard, idSchema, ok } from './shared.js';
import { orderStatus } from './list-orders.js';

export const inputSchema = z.object({
  orderId: idSchema.describe('Order id (from list_orders).'),
});

export const outputSchema = z.object({
  order: z.object({
    id: z.number().int(),
    date: z.string(),
    status: orderStatus,
    total: z.number(),
    customer: z.object({
      id: z.number().int(),
      name: z.string(),
      province: z.string(),
      city: z.string(),
    }),
    salesRep: z.string(),
  }),
  items: z.array(
    z.object({
      productId: z.number().int(),
      product: z.string(),
      brand: z.string(),
      category: z.string(),
      quantity: z.number().int(),
      unit: z.string(),
      unitPrice: z.number(),
      lineTotal: z.number(),
    }),
  ),
});

export type Input = z.output<typeof inputSchema>;
export type Output = z.output<typeof outputSchema>;

interface HeaderRow {
  id: number;
  order_date: string;
  status: 'paid' | 'pending' | 'cancelled';
  total: string;
  customer_id: number;
  customer: string;
  province: string;
  city: string;
  sales_rep: string;
}

interface ItemRow {
  product_id: number;
  product: string;
  brand: string;
  category: string;
  quantity: number;
  unit: string;
  unit_price: string;
  line_total: string;
}

export const HEADER_SQL = `
SELECT o.id, o.order_date, o.status, o.total,
       c.id AS customer_id, c.name AS customer, c.province, c.city,
       r.name AS sales_rep
FROM orders o
JOIN customers c ON c.id = o.customer_id
JOIN sales_reps r ON r.id = o.sales_rep_id
WHERE o.id = $1`;

export const ITEMS_SQL = `
SELECT oi.product_id, p.name AS product, p.brand, cat.name AS category,
       oi.quantity, p.unit, oi.unit_price, oi.line_total
FROM order_items oi
JOIN products p ON p.id = oi.product_id
JOIN categories cat ON cat.id = p.category_id
WHERE oi.order_id = $1
ORDER BY oi.id`;

export function handler(input: Input) {
  return guard('get_order', async () => {
    const [header] = await query<HeaderRow>(HEADER_SQL, [input.orderId]);
    if (!header) {
      return fail(
        `Order ${input.orderId} not found. Use list_orders to look up ids.`,
      );
    }
    const rows = await query<ItemRow>(ITEMS_SQL, [input.orderId]);
    const items = rows.map((r) => ({
      productId: r.product_id,
      product: r.product,
      brand: r.brand,
      category: r.category,
      quantity: r.quantity,
      unit: r.unit,
      unitPrice: amount(r.unit_price),
      lineTotal: amount(r.line_total),
    }));
    const output: Output = {
      order: {
        id: header.id,
        date: date(header.order_date),
        status: header.status,
        total: amount(header.total),
        customer: {
          id: header.customer_id,
          name: header.customer,
          province: header.province,
          city: header.city,
        },
        salesRep: header.sales_rep,
      },
      items,
    };
    const o = output.order;
    const text = [
      `**Order ${o.id}** · ${o.date} · ${o.status} · total ${money(o.total)}`,
      `Customer: ${o.customer.name} (id ${o.customer.id}), ${o.customer.city}, ${o.customer.province} · Sales rep: ${o.salesRep}`,
      `${plural(items.length, 'line item')}:`,
      '',
      table(items, [
        { key: 'product' },
        { key: 'brand' },
        { key: 'quantity', label: 'qty', align: 'right' },
        { key: 'unit' },
        {
          key: 'unitPrice',
          label: 'unit price',
          align: 'right',
          format: money,
        },
        {
          key: 'lineTotal',
          label: 'line total',
          align: 'right',
          format: money,
        },
      ]),
    ].join('\n');
    return ok(text, output);
  });
}

export function register(server: McpServer): void {
  server.registerTool(
    'get_order',
    {
      title: 'Order detail',
      description:
        'Full detail of one order by id: date, status, customer, sales rep, RD$ total ' +
        'and every line item (product, brand, category, quantity, unit price, line total). ' +
        'Use list_orders first to find order ids.',
      inputSchema,
      outputSchema,
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    handler,
  );
}
