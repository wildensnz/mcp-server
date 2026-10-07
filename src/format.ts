/**
 * Pure formatting helpers for tool output. No I/O, fully tested.
 *
 * Amounts are Dominican pesos (RD$). `pg` returns NUMERIC as strings, so
 * every helper accepts `number | string`.
 */

export type Numeric = number | string | null | undefined;

function toNumber(value: Numeric): number | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : undefined;
}

const moneyFormat = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const integerFormat = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 0,
});

/** `money(1234.5)` → `RD$1,234.50`. Non-numeric input → `—`. */
export function money(value: Numeric): string {
  const n = toNumber(value);
  if (n === undefined) return '—';
  const sign = n < 0 ? '-' : '';
  return `${sign}RD$${moneyFormat.format(Math.abs(n))}`;
}

/** `integer(12345)` → `12,345`. Non-numeric input → `—`. */
export function integer(value: Numeric): string {
  const n = toNumber(value);
  return n === undefined ? '—' : integerFormat.format(n);
}

/** Rounds to 2 decimals and returns a number (for structuredContent). */
export function amount(value: Numeric): number {
  const n = toNumber(value);
  return n === undefined ? 0 : Math.round(n * 100) / 100;
}

/** Dates as `YYYY-MM-DD`. Accepts Date, ISO strings or `YYYY-MM-DD`. */
export function date(value: Date | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—';
  if (value instanceof Date) {
    return Number.isNaN(value.getTime())
      ? '—'
      : value.toISOString().slice(0, 10);
  }
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(value);
  return match?.[1] ?? '—';
}

export interface Column<Row> {
  key: keyof Row & string;
  label?: string;
  align?: 'left' | 'right';
  format?: (value: Row[keyof Row & string], row: Row) => string;
}

function cell(value: unknown): string {
  if (value === null || value === undefined) return '';
  let text: string;
  switch (typeof value) {
    case 'string':
      text = value;
      break;
    case 'number':
    case 'bigint':
    case 'boolean':
      text = value.toString();
      break;
    default:
      text = JSON.stringify(value) ?? '';
  }
  return text.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

/**
 * Compact markdown table. Returns `(no rows)` for empty input so the model
 * never sees a bare header.
 */
export function table<Row extends object>(
  rows: readonly Row[],
  columns: readonly Column<Row>[],
): string {
  if (rows.length === 0) return '(no rows)';
  const header = columns.map((c) => c.label ?? c.key);
  const separator = columns.map((c) => (c.align === 'right' ? '---:' : '---'));
  const body = rows.map((row) =>
    columns.map((c) => {
      const value = row[c.key];
      return cell(c.format ? c.format(value, row) : value);
    }),
  );
  return [header, separator, ...body]
    .map((cells) => `| ${cells.join(' | ')} |`)
    .join('\n');
}

/** `plural(1, 'order')` → `1 order`; `plural(3, 'order')` → `3 orders`. */
export function plural(
  count: number,
  noun: string,
  pluralNoun?: string,
): string {
  const word = count === 1 ? noun : (pluralNoun ?? `${noun}s`);
  return `${integer(count)} ${word}`;
}
