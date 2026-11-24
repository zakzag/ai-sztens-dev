import { isTagNameConflict } from './customers-tags.error-guard.js';

/**
 * Unit tests of the tag-name guard (AIS-178, slice e).
 *
 * The guard is the only thing standing between a concurrent "create the same
 * label" and a `500`, so every branch of the matching rule is asserted: the code,
 * the constraint name, both spellings of the name, and the wrapped `cause` chain.
 */
describe('isTagNameConflict', () => {
  it('recognises a 23505 on tags_name_key', () => {
    expect(
      isTagNameConflict({ code: '23505', constraint_name: 'tags_name_key' }),
    ).toBe(true);
  });

  it('accepts the `constraint` spelling as well', () => {
    expect(
      isTagNameConflict({ code: '23505', constraint: 'tags_name_key' }),
    ).toBe(true);
  });

  it('walks a wrapped cause chain', () => {
    const error = new Error('DrizzleQueryError', {
      cause: { code: '23505', constraint_name: 'tags_name_key' },
    });

    expect(isTagNameConflict(error)).toBe(true);
  });

  it('rejects another unique constraint on the same table', () => {
    expect(
      isTagNameConflict({
        code: '23505',
        constraint_name: 'customer_tags_pkey',
      }),
    ).toBe(false);
  });

  it('rejects another SQLSTATE', () => {
    expect(
      isTagNameConflict({ code: '23503', constraint_name: 'tags_name_key' }),
    ).toBe(false);
  });

  it('rejects a value that carries no driver fields', () => {
    expect(isTagNameConflict('23505')).toBe(false);
    expect(isTagNameConflict(null)).toBe(false);
    expect(isTagNameConflict(undefined)).toBe(false);
  });
});
