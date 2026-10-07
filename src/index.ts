#!/usr/bin/env node
/**
 * Store MCP — read-only MCP server over the "Colmado Digital" demo database.
 *
 * Transport: stdio. stdout is the protocol channel, so nothing here may
 * `console.log`; diagnostics go to stderr.
 */
import { McpServer } from '@modelcontextprotocol/server';
import { StdioServerTransport } from '@modelcontextprotocol/server/stdio';
import { fileURLToPath } from 'node:url';
import { closePool } from './db.js';
import * as schemaResource from './resources/schema.js';
import * as getCustomerSummary from './tools/get-customer-summary.js';
import * as getOrder from './tools/get-order.js';
import * as listOrders from './tools/list-orders.js';
import * as lowStockProducts from './tools/low-stock-products.js';
import * as salesReport from './tools/sales-report.js';
import * as searchCustomers from './tools/search-customers.js';

export const SERVER_NAME = 'store-mcp';
export const SERVER_VERSION = '0.1.0';

export const tools = [
  searchCustomers,
  getCustomerSummary,
  listOrders,
  getOrder,
  lowStockProducts,
  salesReport,
] as const;

export function createServer(): McpServer {
  const server = new McpServer({
    name: SERVER_NAME,
    version: SERVER_VERSION,
  });
  for (const tool of tools) tool.register(server);
  schemaResource.register(server);
  return server;
}

/**
 * Claude Desktop passes DATABASE_URL through its config; for local runs
 * (`npm run dev`, `npm run inspect`) fall back to the repo's `.env`.
 */
function loadLocalEnv(): void {
  if (process.env.DATABASE_URL) return;
  try {
    process.loadEnvFile(fileURLToPath(new URL('../.env', import.meta.url)));
  } catch {
    // No .env: db.ts reports the missing variable on first query.
  }
}

async function main(): Promise<void> {
  loadLocalEnv();
  const server = createServer();
  await server.connect(new StdioServerTransport());
  // When the client closes stdin, release the Postgres connections too.
  server.server.onclose = () => {
    void closePool();
  };
  console.error(`${SERVER_NAME} ${SERVER_VERSION} listening on stdio`);
}

main().catch((error: unknown) => {
  console.error('store-mcp failed to start:', error);
  process.exit(1);
});
