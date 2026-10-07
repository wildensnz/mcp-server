#!/usr/bin/env node
/**
 * Store MCP — read-only MCP server over the "Colmado Digital" demo database.
 *
 * Transport: stdio. stdout is the protocol channel, so nothing here may
 * `console.log`; diagnostics go to stderr.
 */
import { McpServer } from '@modelcontextprotocol/server';
import { StdioServerTransport } from '@modelcontextprotocol/server/stdio';
import { registerPing } from './tools/ping.js';

export const SERVER_NAME = 'store-mcp';
export const SERVER_VERSION = '0.1.0';

export function createServer(): McpServer {
  const server = new McpServer({
    name: SERVER_NAME,
    version: SERVER_VERSION,
  });
  registerPing(server);
  return server;
}

async function main(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`${SERVER_NAME} ${SERVER_VERSION} listening on stdio`);
}

main().catch((error: unknown) => {
  console.error('store-mcp failed to start:', error);
  process.exit(1);
});
