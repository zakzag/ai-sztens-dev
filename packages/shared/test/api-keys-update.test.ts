import {
  API_KEY_DESCRIPTION_MAX_LENGTH,
  API_KEY_NAME_MAX_LENGTH,
  API_KEY_UPDATE_FORBIDDEN_FIELDS,
  updateApiKeySchema,
} from '../src/index.js';
import type { UpdateApiKeyInput } from '../src/index.js';

/**
 * Unit tests for `updateApiKeySchema` (AIS-108, plan `D4`).
 *
 * Four behaviours carry the whole mutation contract, and each has its own
 * `describe` block below:
 *
 * 1. `updatedAt` is **required** — otherwise `{}` would be a successful no-op
 *    and the client would believe it wrote something.
 * 2. Unknown / server-managed fields are **rejected** (`.strict()`), so a
 *    client cannot pretend it renamed the address or set the token.
 * 3. `null` is a *value* for `description` and `expiresAt` — “clear it” —
 *    while an omitted key means “leave it”.
 * 4. The shape rules of the writable fields stay the same as on create
 *    (non-empty name, ISO-8601 dates, bounded strings).
 */

const UPDATED_AT = '2026-11-02T10:00:00.000Z';

/** Minimal body: one writable field plus the concurrency token. */
const MINIMAL_BODY = {
  name: 'Vapi production',
  updatedAt: UPDATED_AT,
} as const;

describe('updateApiKeySchema', () => {
  describe('the concurrency token', () => {
    it('accepts a body with only the token and one field', () => {
      const result = updateApiKeySchema.parse(MINIMAL_BODY);

      expect(result).toEqual({ name: 'Vapi production', updatedAt: UPDATED_AT });
    });

    it('accepts a body that only carries the token', () => {
      // Legal, if pointless: the update still bumps `updatedAt`. Rejecting it
      // would make "touch this row" impossible without inventing a field.
      expect(() =>
        updateApiKeySchema.parse({ updatedAt: UPDATED_AT }),
      ).not.toThrow();
    });

    it('rejects a body without updatedAt', () => {
      const result = updateApiKeySchema.safeParse({ name: 'Vapi production' });

      expect(result.success).toBe(false);
    });

    it('rejects an empty body', () => {
      expect(updateApiKeySchema.safeParse({}).success).toBe(false);
    });

    it('rejects a non-ISO updatedAt', () => {
      const result = updateApiKeySchema.safeParse({
        ...MINIMAL_BODY,
        updatedAt: '2026-11-02 10:00',
      });

      expect(result.success).toBe(false);
    });

    it('rejects a timestamp without a timezone', () => {
      const result = updateApiKeySchema.safeParse({
        ...MINIMAL_BODY,
        updatedAt: '2026-11-02T10:00:00',
      });

      expect(result.success).toBe(false);
    });

    it('accepts a numeric UTC offset instead of Z', () => {
      const result = updateApiKeySchema.parse({
        ...MINIMAL_BODY,
        updatedAt: '2026-11-02T11:00:00+01:00',
      });

      expect(result.updatedAt).toBe('2026-11-02T11:00:00+01:00');
    });
  });

  describe('server-managed fields are not patchable', () => {
    it.each(API_KEY_UPDATE_FORBIDDEN_FIELDS)('rejects %s', (field) => {
      const result = updateApiKeySchema.safeParse({
        ...MINIMAL_BODY,
        [field]: 'anything',
      });

      expect(result.success).toBe(false);
    });

    it('rejects an unknown field', () => {
      const result = updateApiKeySchema.safeParse({
        ...MINIMAL_BODY,
        surprise: true,
      });

      expect(result.success).toBe(false);
    });

    it('names the offending field in the error keys', () => {
      const result = updateApiKeySchema.safeParse({
        ...MINIMAL_BODY,
        identifier: 'renamed',
      });

      expect(result.success).toBe(false);
      if (result.success) return;
      // `.strict()` reports unknown keys as one `unrecognized_keys` issue that
      // lists them — so a client can still point at the field it must drop.
      const issue = result.error.issues[0];
      expect(issue?.code).toBe('unrecognized_keys');
      expect(
        issue !== undefined && 'keys' in issue ? issue.keys : [],
      ).toEqual(['identifier']);
    });
  });

  describe('clearable fields', () => {
    it('accepts description: null (clear it)', () => {
      const result = updateApiKeySchema.parse({
        ...MINIMAL_BODY,
        description: null,
      });

      expect(result.description).toBeNull();
    });

    it('accepts expiresAt: null (no expiry)', () => {
      const result = updateApiKeySchema.parse({
        ...MINIMAL_BODY,
        expiresAt: null,
      });

      expect(result.expiresAt).toBeNull();
    });

    it('leaves an omitted description undefined (leave it)', () => {
      const result = updateApiKeySchema.parse(MINIMAL_BODY);

      expect(result.description).toBeUndefined();
      expect('description' in result).toBe(false);
    });

    it('leaves an omitted expiresAt undefined (leave it)', () => {
      const result = updateApiKeySchema.parse(MINIMAL_BODY);

      expect(result.expiresAt).toBeUndefined();
    });

    it('keeps an explicit description', () => {
      const result = updateApiKeySchema.parse({
        ...MINIMAL_BODY,
        description: 'rotated 2026-11',
      });

      expect(result.description).toBe('rotated 2026-11');
    });

    it('rejects a description over the contract limit', () => {
      const result = updateApiKeySchema.safeParse({
        ...MINIMAL_BODY,
        description: 'x'.repeat(API_KEY_DESCRIPTION_MAX_LENGTH + 1),
      });

      expect(result.success).toBe(false);
    });
  });

  describe('writable field rules match create', () => {
    it('rejects an empty name', () => {
      expect(
        updateApiKeySchema.safeParse({ ...MINIMAL_BODY, name: '' }).success,
      ).toBe(false);
    });

    it('rejects a name over the contract limit', () => {
      expect(
        updateApiKeySchema.safeParse({
          ...MINIMAL_BODY,
          name: 'x'.repeat(API_KEY_NAME_MAX_LENGTH + 1),
        }).success,
      ).toBe(false);
    });

    it('rejects an empty apiKey', () => {
      expect(
        updateApiKeySchema.safeParse({ ...MINIMAL_BODY, apiKey: '' }).success,
      ).toBe(false);
    });

    it('accepts a rotated apiKey', () => {
      const result = updateApiKeySchema.parse({
        ...MINIMAL_BODY,
        apiKey: 'sk-live-rotated',
      });

      expect(result.apiKey).toBe('sk-live-rotated');
    });

    it('accepts a future expiresAt', () => {
      const result = updateApiKeySchema.parse({
        ...MINIMAL_BODY,
        expiresAt: '2027-01-31T23:00:00.000Z',
      });

      expect(result.expiresAt).toBe('2027-01-31T23:00:00.000Z');
    });

    it('rejects an expiresAt that is not an ISO timestamp', () => {
      expect(
        updateApiKeySchema.safeParse({
          ...MINIMAL_BODY,
          expiresAt: 'next-year',
        }).success,
      ).toBe(false);
    });

    it('infers a type where every mutable field is optional', () => {
      // Compile-time guard: the token is required, everything else may be
      // absent — the shape the repository turns into a column subset.
      const input: UpdateApiKeyInput = { updatedAt: UPDATED_AT };

      expect(input.name).toBeUndefined();
    });
  });
});
