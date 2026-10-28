import { z } from 'zod';
import type { ApiErrorDetail } from '@callback/shared';
import { toApiErrorDetails } from './zod-error.mapper.js';

/**
 * The mapper is the only place where a zod issue becomes an API `details[]`
 * entry. The admin maps `path` onto a form field, so an off-by-one segment or a
 * `String(name)`-only path would silently attach a message to the wrong input —
 * hence the path notation is pinned here, not just the message text.
 */

/**
 * @param schema - schema to run.
 * @param value - candidate payload.
 * @returns the mapped details of a payload the schema must reject.
 */
function failedDetails(
  schema: z.ZodTypeAny,
  value: unknown,
): readonly ApiErrorDetail[] {
  const result = schema.safeParse(value);

  if (result.success) {
    throw new Error('expected the payload to be rejected');
  }

  return toApiErrorDetails(result.error);
}

describe('toApiErrorDetails', () => {
  it('uses the field name as the path', () => {
    const details = failedDetails(
      z.object({ name: z.string().min(1, 'Name is required') }),
      { name: '' },
    );

    expect(details).toEqual([{ path: 'name', message: 'Name is required' }]);
  });

  it('joins a nested array index into a dot path', () => {
    const details = failedDetails(
      z.object({
        lines: z.array(z.object({ quantity: z.number() })),
      }),
      { lines: [{ quantity: 1 }, { quantity: 'two' }] },
    );

    expect(details[0]?.path).toBe('lines.1.quantity');
  });

  it('reports a whole-payload failure with an empty path', () => {
    const details = failedDetails(z.object({ name: z.string() }), null);

    expect(details[0]?.path).toBe('');
  });

  it('keeps the order zod reported the issues in', () => {
    const details = failedDetails(
      z.object({
        alpha: z.string().min(1),
        beta: z.string().min(1),
      }),
      { alpha: '', beta: '' },
    );

    expect(details.map((detail) => detail.path)).toEqual(['alpha', 'beta']);
  });

  it('stringifies a record key segment', () => {
    const details = failedDetails(z.object({ limits: z.record(z.number()) }), {
      limits: { daily: 'many' },
    });

    expect(details[0]?.path).toBe('limits.daily');
  });

  it('always returns a non-empty message', () => {
    const details = failedDetails(z.object({ name: z.string() }), {});

    expect(details[0]?.message.length).toBeGreaterThan(0);
  });
});
