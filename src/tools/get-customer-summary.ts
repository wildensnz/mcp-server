import type { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import { query } from '../db.js';
import { amount, date, integer, money } from '../format.js';
import { fail, guard, idSchema, ok } from './shared.js';

export const inputSchema = z.object({
  customerId: idSchema.describe('Customer id (from search_customers).'),
});

export const outputSchema = z.object({
  customer: z.object({
    id: z.number().int(),
    name: z.string(),
    customerType: z.string(),
    province: z.string(),
    city: z.string(),
    salesRep: z.string(),
    since: z.string(),
  }),
  paidOrders: z.number().int(),
  paidTotal: z.number(),
  pendingOrders: z.number().int(),
  pendingTotal: z.number(),
  cancelledOrders: z.number().int(),
  lastOrderDate: z.string().nullable(),
});

export type Input = z.output<typeof inputSchema>;
export type Output = z.output<typeof outputSchema>;

interface CustomerRow {
  id: number;
  name: string;
  customer_type: string;
  province: string;
  city: string;
  sales_rep: string;
  since: string;
}

interface TotalsRow {
  paid_orders: string;
  paid_total: string;
  pending_orders: string;
  pending_total: string;
  cancelled_orders: string;
  last_order_date: string | null;
}

export const CUSTOMER_SQL = `
SELECT c.id, c.name, c.customer_type, c.province, c.city, c.since,
       r.name AS sales_rep
FROM customers c
JOIN sales_reps r ON r.id = c.sales_rep_id
WHERE c.id = $1`;

export const TOTALS_SQL = `
SELECT count(*) FILTER (WHERE status = 'paid')                     AS paid_orders,
       coalesce(sum(total) FILTER (WHERE status = 'paid'), 0)      AS paid_total,
       count(*) FILTER (WHERE status = 'pending')                  AS pending_orders,
       coalesce(sum(total) FILTER (WHERE status = 'pending'), 0)   AS pending_total,
       count(*) FILTER (WHERE status = 'cancelled')                AS cancelled_orders,
       max(order_date) FILTER (WHERE status <> 'cancelled')        AS last_order_date
FROM orders
WHERE customer_id = $1`;

export function handler(input: Input) {
  return guard('get_customer_summary', async () => {
    const [customer] = await query<CustomerRow>(CUSTOMER_SQL, [
      input.customerId,
    ]);
    if (!customer) {
      return fail(
        `Customer ${input.customerId} not found. Use search_customers to look up ids.`,
      );
    }
    const [totals] = await query<TotalsRow>(TOTALS_SQL, [input.customerId]);
    const output: Output = {
      customer: {
        id: customer.id,
        name: customer.name,
        customerType: customer.customer_type,
        province: customer.province,
        city: customer.city,
        salesRep: customer.sales_rep,
        since: date(customer.since),
      },
      paidOrders: Number(totals?.paid_orders ?? 0),
      paidTotal: amount(totals?.paid_total),
      pendingOrders: Number(totals?.pending_orders ?? 0),
      pendingTotal: amount(totals?.pending_total),
      cancelledOrders: Number(totals?.cancelled_orders ?? 0),
      lastOrderDate: totals?.last_order_date
        ? date(totals.last_order_date)
        : null,
    };
    const c = output.customer;
    const text = [
      `**${c.name}** (id ${c.id}) · ${c.customerType} · ${c.city}, ${c.province}`,
      `Sales rep: ${c.salesRep} · Customer since: ${c.since}`,
      `Paid orders: ${integer(output.paidOrders)} · Total purchased: ${money(output.paidTotal)}`,
      `Pending orders: ${integer(output.pendingOrders)} (${money(output.pendingTotal)}) · Cancelled: ${integer(output.cancelledOrders)}`,
      `Last order (not cancelled): ${output.lastOrderDate ?? 'none'}`,
    ].join('\n');
    return ok(text, output);
  });
}

export function register(server: McpServer): void {
  server.registerTool(
    'get_customer_summary',
    {
      title: 'Customer summary',
      description:
        'Profile and purchase totals for one customer by id: type, location, sales rep, ' +
        'customer since, number and RD$ total of paid orders, pending orders and amount, ' +
        'cancelled orders, and last order date. Use list_orders for the individual orders.',
      inputSchema,
      outputSchema,
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    handler,
  );
}
