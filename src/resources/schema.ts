/**
 * `store://schema`: a plain-text description of the Colmado Digital tables
 * so the model understands the domain without calling any tool.
 */
import type { McpServer } from '@modelcontextprotocol/server';
import { query } from '../db.js';
import { date } from '../format.js';

export const SCHEMA_URI = 'store://schema';

export const RANGE_SQL = `
SELECT min(order_date) AS first_date, max(order_date) AS last_date,
       count(*) AS orders
FROM orders`;

interface RangeRow {
  first_date: string | null;
  last_date: string | null;
  orders: string;
}

export interface DataRange {
  firstDate: string;
  lastDate: string;
  orders: number;
}

export function schemaText(range?: DataRange): string {
  const rangeLine = range
    ? `Orders span ${range.firstDate} to ${range.lastDate} (${range.orders} orders). ` +
      `"This month" or "this year" refer to that range, not to today's date.`
    : 'Order dates: call sales_report with groupBy "month" to see the range covered.';
  return `# Colmado Digital — data model

Fictional Dominican distributor that sells groceries and household goods to
small retailers (colmados, minimarkets, supermarkets). All amounts are in
Dominican pesos (RD$). The data is synthetic and read-only.

${rangeLine}

## Tables

- categories(id, name) — 8 product categories, e.g. Bebidas, Snacks, Lácteos, Limpieza.
- products(id, category_id, name, brand, unit_price, unit, stock, active) —
  ~80 products. unit_price is the list price in RD$; stock is units on hand
  (a snapshot); active = false means discontinued.
- sales_reps(id, name, region, hired_at) — 8 reps, each covering a region such
  as "Gran Santo Domingo" or "Cibao Norte".
- customers(id, name, customer_type, province, city, sales_rep_id, since) —
  ~300 retail customers. customer_type is one of Colmado, Supermercado,
  Minimarket, Cafetería, Almacén. since = first purchase date.
- orders(id, customer_id, sales_rep_id, order_date, status, total) —
  status is paid, pending or cancelled. total = sum of the order's line totals.
- order_items(id, order_id, product_id, quantity, unit_price, line_total) —
  unit_price is the price at the time of sale; line_total = quantity × unit_price.

## Business rules

- "Sales" or "revenue" means orders with status = paid. Pending orders are
  not yet collected; cancelled orders never count.
- orders.sales_rep_id is the rep credited for the order (usually the
  customer's rep, occasionally a colleague covering).
- Stock is not derived from orders; it is a snapshot of units on hand.

## Tools

- search_customers → ids for get_customer_summary and list_orders.
- list_orders → ids for get_order.
- low_stock_products → what is running out.
- sales_report → totals by month, category, sales rep or province.
`;
}

export async function readSchema(): Promise<string> {
  try {
    const [row] = await query<RangeRow>(RANGE_SQL);
    if (row?.first_date && row.last_date) {
      return schemaText({
        firstDate: date(row.first_date),
        lastDate: date(row.last_date),
        orders: Number(row.orders),
      });
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[store://schema] range query failed: ${message}`);
  }
  return schemaText();
}

export function register(server: McpServer): void {
  server.registerResource(
    'schema',
    SCHEMA_URI,
    {
      title: 'Colmado Digital schema',
      description:
        'Tables, columns and business rules of the Colmado Digital database, plus the date range the data covers.',
      mimeType: 'text/markdown',
    },
    async (uri) => ({
      contents: [
        { uri: uri.href, mimeType: 'text/markdown', text: await readSchema() },
      ],
    }),
  );
}
