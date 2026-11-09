import { describe, expect, it } from 'vitest';

import { NOTIFICATION_STORAGE_VERSION } from '../src/core/notification.const.js';
import {
  fromPersistedEnvelope,
  isPersistedEntry,
  toPersistedEnvelope,
} from '../src/core/notification.storage.logic.js';
import { createTestDetailField, createTestEntry } from './mocks/notification.fixtures.js';
import { createTestEntryList } from './mocks/notification-storage.fixtures.js';

/**
 * Wraps candidates in a versioned envelope.
 *
 * The parameter is `unknown[]` on purpose: half of the cases are *invalid* entries
 * that a correct writer would never produce.
 *
 * @param entries - candidate entries.
 * @returns the envelope as an unknown payload.
 */
function envelope(entries: readonly unknown[]): unknown {
  return { version: NOTIFICATION_STORAGE_VERSION, entries };
}

/**
 * Serialises a candidate payload the way storage would hold it.
 *
 * @param payload - JSON-serialisable candidate.
 * @returns the raw string handed to `fromPersistedEnvelope`.
 */
function raw(payload: unknown): string {
  return JSON.stringify(payload);
}

describe('toPersistedEnvelope', () => {
  it('writes an empty versioned envelope for an empty log', () => {
    expect(toPersistedEnvelope([], 200)).toEqual({ version: NOTIFICATION_STORAGE_VERSION, entries: [] });
  });

  it('keeps only the newest entries up to the cap', () => {
    const entries = createTestEntryList(201);

    const persisted = toPersistedEnvelope(entries, 200);

    expect(persisted.entries).toHaveLength(200);
    expect(persisted.entries[0]?.id).toBe('ntf-storage-0');
    expect(persisted.entries.at(-1)?.id).toBe('ntf-storage-199');
    expect(persisted.entries.some((entry) => entry.id === 'ntf-storage-200')).toBe(false);
  });

  it('serialises nothing but the version and the entries', () => {
    const serialised = JSON.parse(JSON.stringify(toPersistedEnvelope(createTestEntryList(2), 200)));

    expect(Object.keys(serialised)).toEqual(['version', 'entries']);
    expect(Object.keys(serialised.entries[0])).toEqual([
      'id',
      'level',
      'message',
      'source',
      'createdAt',
      'read',
      'toast',
      'repeatCount',
    ]);
  });

  it('round-trips through the parser with the order preserved', () => {
    const entries = createTestEntryList(5);

    const result = fromPersistedEnvelope(raw(toPersistedEnvelope(entries, 200)));

    expect(result.ok).toBe(true);
    expect(result.ok ? result.entries.map((entry) => entry.id) : []).toEqual([
      'ntf-storage-0',
      'ntf-storage-1',
      'ntf-storage-2',
      'ntf-storage-3',
      'ntf-storage-4',
    ]);
  });
});

describe('fromPersistedEnvelope — rejections', () => {
  it('reports a missing payload for absent or blank values', () => {
    expect(fromPersistedEnvelope(null)).toEqual({ ok: false, reason: 'missing' });
    expect(fromPersistedEnvelope('')).toEqual({ ok: false, reason: 'missing' });
    expect(fromPersistedEnvelope('   ')).toEqual({ ok: false, reason: 'missing' });
  });

  it('reports malformed JSON instead of throwing', () => {
    expect(fromPersistedEnvelope('{ not json')).toEqual({ ok: false, reason: 'malformed-json' });
  });

  it('reports a wrong version for a foreign schema and for a missing version', () => {
    expect(fromPersistedEnvelope(raw({ version: 2, entries: [] }))).toEqual({
      ok: false,
      reason: 'wrong-version',
    });
    expect(fromPersistedEnvelope(raw({ entries: [] }))).toEqual({ ok: false, reason: 'wrong-version' });
  });

  it('reports a wrong shape for a non-object payload', () => {
    expect(fromPersistedEnvelope('5')).toEqual({ ok: false, reason: 'wrong-shape' });
    expect(fromPersistedEnvelope('[]')).toEqual({ ok: false, reason: 'wrong-shape' });
  });

  it('reports a wrong shape when entries is not a list', () => {
    expect(fromPersistedEnvelope(raw({ version: NOTIFICATION_STORAGE_VERSION, entries: 'nope' }))).toEqual({
      ok: false,
      reason: 'wrong-shape',
    });
    expect(fromPersistedEnvelope(raw({ version: NOTIFICATION_STORAGE_VERSION }))).toEqual({
      ok: false,
      reason: 'wrong-shape',
    });
    expect(fromPersistedEnvelope(raw(envelope([null])))).toEqual({ ok: false, reason: 'wrong-shape' });
  });

  it('drops the whole payload when a single entry is incomplete', () => {
    const valid = createTestEntry();
    const withoutId: Record<string, unknown> = { ...valid };

    delete withoutId['id'];

    expect(fromPersistedEnvelope(raw(envelope([valid, withoutId])))).toEqual({
      ok: false,
      reason: 'wrong-shape',
    });
  });

  it.each([
    ['an empty id', { id: '' }],
    ['an unknown level', { level: 'critical' }],
    ['an unknown source', { source: 'somewhere' }],
    ['a non-string message', { message: 42 }],
    ['a non-string detail', { detail: 42 }],
    ['a non-array details field', { details: 'status=422' }],
    ['a details element that is not an object', { details: ['status=422'] }],
    ['a details field with a blank label', { details: [{ label: '', value: '422' }] }],
    ['a details field with a non-string value', { details: [{ label: 'status', value: 422 }] }],
    ['a details field with a non-string label', { details: [{ label: 42, value: '422' }] }],
    ['a non-boolean mono flag', { details: [{ label: 'status', value: '422', mono: 'yes' }] }],
    ['a non-boolean read flag', { read: 'yes' }],
    ['a non-boolean toast flag', { toast: 1 }],
    ['a non-finite createdAt', { createdAt: 'now' }],
    ['a zero repeatCount', { repeatCount: 0 }],
    ['a fractional repeatCount', { repeatCount: 1.5 }],
  ])('rejects an entry with %s', (_label, override) => {
    const candidate = { ...createTestEntry(), ...override };

    expect(fromPersistedEnvelope(raw(envelope([candidate])))).toEqual({
      ok: false,
      reason: 'wrong-shape',
    });
  });
});

describe('fromPersistedEnvelope — tolerance', () => {
  it('ignores unknown extra keys on the envelope and on an entry', () => {
    const entryWithExtra = { ...createTestEntry(), futureField: 'ignore me' };
    const payload = {
      version: NOTIFICATION_STORAGE_VERSION,
      entries: [entryWithExtra],
      writtenAt: 'tomorrow',
    };

    const result = fromPersistedEnvelope(raw(payload));

    expect(result.ok).toBe(true);
    expect(result.ok ? result.entries : []).toHaveLength(1);
  });

  it('accepts an entry without an optional detail', () => {
    const result = fromPersistedEnvelope(raw(envelope([createTestEntry()])));

    expect(result.ok).toBe(true);
  });

  it('accepts an entry with a detail string', () => {
    const result = fromPersistedEnvelope(raw(envelope([{ ...createTestEntry(), detail: 'GET /api -> 500' }])));

    expect(result.ok).toBe(true);
  });

  it('accepts an entry without details, so a pre-AIS-151 payload still loads', () => {
    expect(fromPersistedEnvelope(raw(envelope([createTestEntry()]))).ok).toBe(true);
  });

  it('accepts an entry with structured details', () => {
    const entry = {
      ...createTestEntry(),
      details: [createTestDetailField({ label: 'requestId', mono: true })],
    };

    expect(fromPersistedEnvelope(raw(envelope([entry]))).ok).toBe(true);
  });

  it('accepts an empty details list', () => {
    expect(fromPersistedEnvelope(raw(envelope([{ ...createTestEntry(), details: [] }]))).ok).toBe(true);
  });

  it('keeps the details through a full round trip', () => {
    const entry = { ...createTestEntry(), details: [createTestDetailField({ value: 'req-1' })] };

    const result = fromPersistedEnvelope(raw(toPersistedEnvelope([entry], 200)));

    expect(result.ok ? result.entries[0]?.details : undefined).toEqual([
      { label: 'requestId', value: 'req-1' },
    ]);
  });
});

describe('isPersistedEntry', () => {
  it('accepts a complete entry', () => {
    expect(isPersistedEntry(createTestEntry())).toBe(true);
  });

  it('accepts an entry with a valid details list', () => {
    expect(isPersistedEntry({ ...createTestEntry(), details: [createTestDetailField()] })).toBe(true);
  });

  it('rejects a details list with one broken element', () => {
    expect(
      isPersistedEntry({
        ...createTestEntry(),
        details: [createTestDetailField(), { label: 'status' }],
      }),
    ).toBe(false);
  });

  it('rejects non-objects and arrays', () => {
    expect(isPersistedEntry(null)).toBe(false);
    expect(isPersistedEntry('entry')).toBe(false);
    expect(isPersistedEntry([createTestEntry()])).toBe(false);
  });
});
