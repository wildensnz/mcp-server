import { describe, expect, it, vi } from 'vitest';
import {
  describeRange,
  escapeLike,
  fail,
  guard,
  isoDateSchema,
  limitSchema,
  ok,
  rangeError,
} from '../src/tools/shared.js';

describe('result builders', () => {
  it('ok returns text plus structured content', () => {
    expect(ok('hi', { a: 1 })).toEqual({
      content: [{ type: 'text', text: 'hi' }],
      structuredContent: { a: 1 },
    });
  });

  it('fail sets isError and carries no structured content', () => {
    expect(fail('nope')).toEqual({
      content: [{ type: 'text', text: 'nope' }],
      isError: true,
    });
  });
});

describe('schemas', () => {
  it('limitSchema applies the default and the bounds', () => {
    const s = limitSchema(50, 20);
    expect(s.parse(undefined)).toBe(20);
    expect(s.safeParse(0).success).toBe(false);
    expect(s.safeParse(51).success).toBe(false);
    expect(s.safeParse(3.5).success).toBe(false);
  });

  it('isoDateSchema accepts real calendar dates only', () => {
    expect(isoDateSchema.safeParse('2026-02-28').success).toBe(true);
    expect(isoDateSchema.safeParse('2026-02-30').success).toBe(false);
    expect(isoDateSchema.safeParse('2026-00-10').success).toBe(false);
    expect(isoDateSchema.safeParse('2026/01/01').success).toBe(false);
  });
});

describe('helpers', () => {
  it('escapeLike neutralizes wildcards', () => {
    expect(escapeLike('50%_a\\b')).toBe('50\\%\\_a\\\\b');
  });

  it('rangeError only complains when from is after to', () => {
    expect(rangeError('2026-01-01', '2026-02-01')).toBeUndefined();
    expect(rangeError(undefined, '2026-02-01')).toBeUndefined();
    expect(rangeError('2026-03-01', '2026-02-01')).toContain(
      'Invalid date range',
    );
  });

  it('describeRange reads naturally', () => {
    expect(describeRange(undefined, undefined)).toBe('all dates');
    expect(describeRange('2026-01-01', undefined)).toBe('from 2026-01-01');
    expect(describeRange(undefined, '2026-01-31')).toBe('up to 2026-01-31');
    expect(describeRange('2026-01-01', '2026-01-31')).toBe(
      '2026-01-01 to 2026-01-31',
    );
  });
});

describe('guard', () => {
  it('passes successful results through', async () => {
    const result = await guard('t', () => Promise.resolve(ok('x', {})));
    expect(result.isError).toBeUndefined();
  });

  it('converts thrown errors into isError results and logs to stderr', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const result = await guard('my_tool', () =>
      Promise.reject(new Error('boom')),
    );
    expect(result).toEqual({
      content: [{ type: 'text', text: 'my_tool failed: boom' }],
      isError: true,
    });
    expect(spy).toHaveBeenCalledWith('[my_tool] boom');
    spy.mockRestore();
  });

  it('never leaks a connection string', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const result = await guard('t', () =>
      Promise.reject(
        new Error('cannot connect to postgresql://user:secret@host/db'),
      ),
    );
    const text = (result.content[0] as { text: string }).text;
    expect(text).not.toContain('secret');
    expect(text).toContain('<connection string>');
    vi.restoreAllMocks();
  });
});
