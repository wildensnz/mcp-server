import { describe, expect, it } from 'vitest';
import { ping, pingInput } from '../src/tools/ping.js';

describe('ping', () => {
  it('returns pong and the server time by default', () => {
    const now = new Date('2026-10-06T12:00:00.000Z');
    expect(ping({}, now)).toEqual({
      pong: 'pong',
      serverTime: '2026-10-06T12:00:00.000Z',
    });
  });

  it('echoes the message when given', () => {
    expect(ping({ message: 'hola' }).pong).toBe('hola');
  });

  it('rejects messages over 200 characters', () => {
    const result = pingInput.safeParse({ message: 'x'.repeat(201) });
    expect(result.success).toBe(false);
  });
});
