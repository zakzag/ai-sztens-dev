import { createListQuerySchema } from '../src/contract/list-query.schema.js';

/**
 * Unit tests for the list-query factory (AIS-106).
 *
 * The factory is what makes the `sort` column an **enum** over the resource's
 * allow-list. That is the whole point of the ticket's `D3`: an unknown column
 * must be a `400`, not a `500` from the database — and the error message has to
 * name the permitted values.
 */

const SORTABLE = ['name', 'createdAt'] as const;

describe('createListQuerySchema', () => {
  it('accepts a sortable column', () => {
    const schema = createListQuerySchema(SORTABLE);

    expect(schema.parse({ sort: 'name' }).sort).toBe('name');
  });

  it('rejects an unknown column, so the request never reaches the database', () => {
    const schema = createListQuerySchema(SORTABLE);

    expect(() => schema.parse({ sort: 'secretColumn' })).toThrow();
  });

  it('names the permitted columns in the error message', () => {
    const schema = createListQuerySchema(SORTABLE);

    try {
      schema.parse({ sort: 'secretColumn' });
      throw new Error('the parse should have failed');
    } catch (error) {
      const message = (error as { message: string }).message;
      expect(message).toContain('name');
      expect(message).toContain('createdAt');
    }
  });

  it('fills in the default column when the request does not specify one', () => {
    const schema = createListQuerySchema(SORTABLE);

    expect(schema.parse({}).sort).toBe('name');
  });

  it('accepts an explicit default column', () => {
    const schema = createListQuerySchema(SORTABLE, 'createdAt');

    expect(schema.parse({}).sort).toBe('createdAt');
  });

  it('keeps the base fields of the static schema', () => {
    const schema = createListQuerySchema(SORTABLE);

    const parsed = schema.parse({
      page: '2',
      limit: '10',
      order: 'asc',
      q: 'acme',
    });

    expect(parsed.page).toBe(2);
    expect(parsed.limit).toBe(10);
    expect(parsed.order).toBe('asc');
    expect(parsed.q).toBe('acme');
  });

  it('rejects a page below 1, like the base schema does', () => {
    const schema = createListQuerySchema(SORTABLE);

    expect(() => schema.parse({ page: '0' })).toThrow();
  });
});
