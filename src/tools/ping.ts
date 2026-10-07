import type { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';

/**
 * Phase 1 smoke-test tool: proves the stdio pipeline works end to end.
 * Replaced by the real tools in Phase 3.
 */
export const pingInput = z.object({
  message: z
    .string()
    .max(200)
    .optional()
    .describe('Optional text to echo back.'),
});

export const pingOutput = z.object({
  pong: z.string(),
  serverTime: z.string(),
});

export type PingInput = z.infer<typeof pingInput>;
export type PingOutput = z.infer<typeof pingOutput>;

export function ping(input: PingInput, now: Date = new Date()): PingOutput {
  return {
    pong: input.message ?? 'pong',
    serverTime: now.toISOString(),
  };
}

export function registerPing(server: McpServer): void {
  server.registerTool(
    'ping',
    {
      title: 'Ping',
      description:
        'Health check. Returns "pong" (or echoes `message`) and the server time. Use it to confirm the Store MCP server is reachable.',
      inputSchema: pingInput,
      outputSchema: pingOutput,
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    (input) => {
      const output = ping(input);
      return {
        content: [{ type: 'text', text: output.pong }],
        structuredContent: output,
      };
    },
  );
}
