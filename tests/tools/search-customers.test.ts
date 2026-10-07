import { beforeEach, describe, expect, it, vi } from 'vitest';
import { query } from '../../src/db.js';
import { SQL, handler, inputSchema } from '../../src/tools/search-customers.js';

vi.mock('../../src/db.js', () => ({ query: vi.fn() }));
const mockQuery = vi.mocked(query);

const row = {
  id: 7,
  name: 'Ferretería La Fe',
  customer_type: 'Colmado',
  province: 'Santiago',
  city: 'Santiago',
  sales_rep: 'Ana Pérez',
};

describe('search_customers', () => {
  beforeEach(() => mockQuery.mockReset());

  it('rejects an empty query and a limit above 20', () => {
    expect(inputSchema.safeParse({ query: '   ' }).success).toBe(false);
    expect(inputSchema.safeParse({ query: 'a', limit: 21 }).success).toBe(
      false,
    );
    expect(inputSchema.parse({ query: ' ferre ' })).toEqual({
      query: 'ferre',
      limit: 10,
    });
  });

  it('runs one parameterized ILIKE query with the escaped pattern', async () => {
    mockQuery.mockResolvedValueOnce([row]);
    const result = await handler(inputSchema.parse({ query: '50%_x' }));
    expect(mockQuery).toHaveBeenCalledWith(SQL, ['%50\\%\\_x%', 10]);
    expect(result.isError).toBeUndefined();
    expect(result.structuredContent).toEqual({
      query: '50%_x',
      count: 1,
      customers: [
        {
          id: 7,
          name: 'Ferretería La Fe',
          customerType: 'Colmado',
          province: 'Santiago',
          city: 'Santiago',
          salesRep: 'Ana Pérez',
        },
      ],
    });
    const text = (result.content[0] as { text: string }).text;
    expect(text).toContain('1 customer matching "50%_x"');
    expect(text).toContain('| 7 | Ferretería La Fe | Colmado |');
  });

  it('returns a normal (non-error) result with no matches', async () => {
    mockQuery.mockResolvedValueOnce([]);
    const result = await handler(inputSchema.parse({ query: 'zzz' }));
    expect(result.isError).toBeUndefined();
    expect(result.structuredContent).toMatchObject({ count: 0, customers: [] });
    expect((result.content[0] as { text: string }).text).toContain(
      'No customers match "zzz"',
    );
  });

  it('turns a database failure into an isError result', async () => {
    mockQuery.mockRejectedValueOnce(
      new Error('canceling statement due to statement timeout'),
    );
    const result = await handler(inputSchema.parse({ query: 'a' }));
    expect(result.isError).toBe(true);
    expect((result.content[0] as { text: string }).text).toContain(
      'statement timeout',
    );
  });
});
