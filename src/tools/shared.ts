/**
 * Helpers shared by every tool: result builders, common zod pieces and the
 * guard that turns unexpected errors into `isError` results.
 */
import type { CallToolResult } from '@modelcontextprotocol/server';
import { z } from 'zod';

export type ToolResult = CallToolResult;

/** Successful result: compact markdown for the model + typed JSON. */
export function ok(
  text: string,
  structuredContent: Record<string, unknown>,
): ToolResult {
  return { content: [{ type: 'text', text }], structuredContent };
}

/** Expected failure ("not found", bad range). Never thrown. */
export function fail(message: string): ToolResult {
  return { content: [{ type: 'text', text: message }], isError: true };
}

/** `limit` input: 1..max, with a default. Every list is capped. */
export function limitSchema(max: number, defaultValue: number) {
  return z
    .number()
    .int()
    .min(1)
    .max(max)
    .default(defaultValue)
    .describe(`Max rows to return (1-${max}, default ${defaultValue}).`);
}

/** Positive integer id. */
export const idSchema = z.number().int().positive();

function isRealDate(value: string): boolean {
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/** Calendar date as `YYYY-MM-DD`. */
export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use the format YYYY-MM-DD')
  .refine(isRealDate, 'Not a valid calendar date');

/** Returns an error message when `from` is after `to`, else undefined. */
export function rangeError(
  from: string | undefined,
  to: string | undefined,
): string | undefined {
  if (from && to && from > to) {
    return `Invalid date range: from (${from}) is after to (${to}).`;
  }
  return undefined;
}

/** Escapes `%`, `_` and `\` so user text is matched literally in ILIKE. */
export function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/** Describes a date filter for the markdown header. */
export function describeRange(
  from: string | undefined,
  to: string | undefined,
): string {
  if (from && to) return `${from} to ${to}`;
  if (from) return `from ${from}`;
  if (to) return `up to ${to}`;
  return 'all dates';
}

function sanitize(message: string): string {
  // Never echo a connection string, even if a driver error contained one.
  return message.replace(/postgres(ql)?:\/\/\S+/gi, '<connection string>');
}

/**
 * Runs a tool body and converts any thrown error (driver failure, timeout,
 * bug) into an `isError` result so the server never crashes mid-call.
 */
export async function guard(
  toolName: string,
  run: () => Promise<ToolResult>,
): Promise<ToolResult> {
  try {
    return await run();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[${toolName}] ${message}`);
    return fail(`${toolName} failed: ${sanitize(message)}`);
  }
}
