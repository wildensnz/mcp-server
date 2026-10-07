import { describe, expect, it } from 'vitest';
import { amount, date, integer, money, plural, table } from '../src/format.js';

describe('money', () => {
  it('formats pesos with grouping and two decimals', () => {
    expect(money(1234.5)).toBe('RD$1,234.50');
    expect(money(0)).toBe('RD$0.00');
    expect(money(1000000)).toBe('RD$1,000,000.00');
  });

  it('accepts the strings pg returns for NUMERIC', () => {
    expect(money('98765.4')).toBe('RD$98,765.40');
    expect(money('0.005')).toBe('RD$0.01');
  });

  it('keeps the sign in front of the currency', () => {
    expect(money(-12.3)).toBe('-RD$12.30');
  });

  it('returns a dash for missing or invalid values', () => {
    expect(money(null)).toBe('—');
    expect(money(undefined)).toBe('—');
    expect(money('abc')).toBe('—');
    expect(money('')).toBe('—');
  });
});

describe('integer', () => {
  it('groups thousands and drops decimals', () => {
    expect(integer(12345)).toBe('12,345');
    expect(integer('4000')).toBe('4,000');
    expect(integer(2.7)).toBe('3');
    expect(integer(null)).toBe('—');
  });
});

describe('amount', () => {
  it('returns a number rounded to cents', () => {
    expect(amount('1234.567')).toBe(1234.57);
    expect(amount(10)).toBe(10);
    expect(amount(null)).toBe(0);
  });
});

describe('date', () => {
  it('formats Date objects as YYYY-MM-DD in UTC', () => {
    expect(date(new Date('2026-03-15T23:30:00.000Z'))).toBe('2026-03-15');
  });

  it('passes through date strings from pg and trims ISO timestamps', () => {
    expect(date('2026-09-30')).toBe('2026-09-30');
    expect(date('2026-09-30T04:00:00.000Z')).toBe('2026-09-30');
  });

  it('returns a dash for missing or invalid values', () => {
    expect(date(null)).toBe('—');
    expect(date('')).toBe('—');
    expect(date('yesterday')).toBe('—');
    expect(date(new Date('nope'))).toBe('—');
  });
});

describe('table', () => {
  interface Row {
    id: number;
    name: string;
    total: string;
  }
  const rows: Row[] = [
    { id: 1, name: 'Colmado La Fe', total: '1500' },
    { id: 2, name: 'Super | Pipe', total: '20.5' },
  ];

  it('renders a markdown table with labels, alignment and formatters', () => {
    const out = table(rows, [
      { key: 'id', label: '#' },
      { key: 'name' },
      { key: 'total', align: 'right', format: (v) => money(v) },
    ]);
    expect(out).toBe(
      [
        '| # | name | total |',
        '| --- | --- | ---: |',
        '| 1 | Colmado La Fe | RD$1,500.00 |',
        '| 2 | Super \\| Pipe | RD$20.50 |',
      ].join('\n'),
    );
  });

  it('returns a placeholder for no rows', () => {
    expect(table([] as Row[], [{ key: 'id' }])).toBe('(no rows)');
  });

  it('renders null and undefined cells as empty', () => {
    const out = table(
      [{ a: null, b: undefined }],
      [{ key: 'a' }, { key: 'b' }],
    );
    expect(out.split('\n')[2]).toBe('|  |  |');
  });
});

describe('plural', () => {
  it('picks singular or plural and groups the count', () => {
    expect(plural(1, 'order')).toBe('1 order');
    expect(plural(4000, 'order')).toBe('4,000 orders');
    expect(plural(0, 'line', 'lines')).toBe('0 lines');
  });
});
