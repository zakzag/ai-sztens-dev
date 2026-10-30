import { z } from 'zod';
import {
  toIssueDetails,
  toPayloadRelativePath,
  unwrapEnvelope,
} from '../src/envelope.logic.js';
import { TEST_META } from './mocks/fetch.mock.js';

/**
 * Unit tests for `src/envelope.logic.ts` — the pure unwrap.
 *
 * No `Response` and no `fetch` double is involved: the module takes an
 * already-parsed body, so every drift case is expressed as a plain object. The
 * paths are asserted too, because the admin maps them onto form fields and a
 * leftover `data.` prefix would match nothing.
 */

const itemSchema = z.object({ id: z.string(), name: z.string() });

/** Builds a valid envelope around a payload. */
function envelope(data: unknown, meta: unknown = TEST_META): unknown {
  return { data, meta };
}

describe('toPayloadRelativePath', () => {
  it('drops the envelope wrapper from a payload field path', () => {
    expect(toPayloadRelativePath(['data', 'identifier'])).toBe('identifier');
  });

  it('keeps a path that is not wrapped', () => {
    expect(toPayloadRelativePath(['identifier'])).toBe('identifier');
  });

  it('joins nested segments with dots', () => {
    expect(toPayloadRelativePath(['data', 'items', 0, 'id'])).toBe(
      'items.0.id',
    );
  });

  it('maps the payload itself to the empty path', () => {
    expect(toPayloadRelativePath([])).toBe('');
  });

  it('maps a missing `data` to the empty path', () => {
    expect(toPayloadRelativePath(['data'])).toBe('');
  });
});

describe('toIssueDetails', () => {
  it('maps a zod error onto path/message entries', () => {
    const parsed = itemSchema.safeParse({ id: 1, name: 'first' });

    if (parsed.success) {
      throw new Error('expected the payload to be rejected');
    }

    const issues = toIssueDetails(parsed.error);

    expect(issues).toHaveLength(1);
    expect(issues[0]?.path).toBe('id');
    expect(issues[0]?.message.length ?? 0).toBeGreaterThan(0);
  });
});

describe('unwrapEnvelope — success', () => {
  it('returns the payload of a valid envelope', () => {
    const result = unwrapEnvelope(
      itemSchema,
      envelope({ id: '1', name: 'first' }),
    );

    expect(result).toEqual({ ok: true, data: { id: '1', name: 'first' } });
  });

  it('accepts a null `data` when the caller schema allows it', () => {
    expect(unwrapEnvelope(z.null(), envelope(null))).toEqual({
      ok: true,
      data: null,
    });
  });

  it('tolerates extra `meta` fields the contract does not know', () => {
    const result = unwrapEnvelope(
      itemSchema,
      envelope({ id: '1', name: 'first' }, { ...TEST_META, trace: 'extra' }),
    );

    expect(result.ok).toBe(true);
  });

  it('passes a paginated `meta` through untouched', () => {
    const result = unwrapEnvelope(z.array(itemSchema), {
      data: [{ id: '1', name: 'first' }],
      meta: {
        ...TEST_META,
        pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
      },
    });

    expect(result).toEqual({ ok: true, data: [{ id: '1', name: 'first' }] });
  });
});

describe('unwrapEnvelope — envelope drift', () => {
  it('rejects a body without `data`', () => {
    const result = unwrapEnvelope(itemSchema, { meta: TEST_META });

    expect(result.ok).toBe(false);

    if (result.ok) {
      throw new Error('expected a drift');
    }

    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]?.path).toBe('');
  });

  it('rejects a bare payload that has no envelope at all', () => {
    const result = unwrapEnvelope(itemSchema, { id: '1', name: 'first' });

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.issues.length > 0).toBe(true);
  });

  it('rejects a null `data` for a resource schema', () => {
    const result = unwrapEnvelope(itemSchema, envelope(null));

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.issues[0]?.path).toBe('');
  });

  it('rejects a null body', () => {
    const result = unwrapEnvelope(itemSchema, null);

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.issues.length > 0).toBe(true);
  });

  it('rejects a string body', () => {
    const result = unwrapEnvelope(itemSchema, 'not-json');

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.issues.length > 0).toBe(true);
  });

  it('rejects an array body', () => {
    const result = unwrapEnvelope(itemSchema, [{ id: '1', name: 'first' }]);

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.issues.length > 0).toBe(true);
  });
});

describe('unwrapEnvelope — payload drift', () => {
  it('reports a field mismatch with a payload-relative path', () => {
    const result = unwrapEnvelope(itemSchema, envelope({ id: '1', name: 42 }));

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.issues[0]?.path).toBe('name');
    expect(result.ok === false && result.issues[0]?.message).toContain(
      'string',
    );
  });

  it('reports the index of a mismatching array element', () => {
    const result = unwrapEnvelope(
      z.object({ items: z.array(itemSchema) }),
      envelope({
        items: [
          { id: '1', name: 'ok' },
          { id: '2', name: 42 },
        ],
      }),
    );

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.issues[0]?.path).toBe('items.1.name');
  });

  it('keeps the zod error as the cause of the drift', () => {
    const result = unwrapEnvelope(itemSchema, envelope(null));

    expect(result.ok === false && result.cause.name).toBe('ZodError');
  });
});
