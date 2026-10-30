/**
 * Tests of the `api-keys` page rules.
 *
 * Two groups:
 * - `apiKeyFormSchema` — every field rule, including the edge cases the backend
 *   would reject with a 400 (identifier pattern, max lengths, fake dates);
 * - `toCreateApiKeyInput` — the payload shape, where the critical property is
 *   that empty optional fields are **absent** from the object, not `''`/`null`.
 */

import { describe, expect, it } from 'vitest';
import { API_KEY_FORM_VALIDATION_MESSAGES } from './api-keys.const.js';
import type { ApiKeyFormValues } from './api-keys.interface.js';
import { apiKeyFormSchema, toCreateApiKeyInput } from './api-keys.logic.js';

/** Minimal, valid values; individual tests override one field at a time. */
const VALID_VALUES: ApiKeyFormValues = {
  name: 'Vapi prod',
  identifier: 'vapi-prod',
  description: '',
  apiKey: 'sk-live-abcdef',
  expiresAt: '',
};

/**
 * @param patch - fields to override.
 * @returns the valid base values with the patch applied.
 */
function withValues(patch: Partial<ApiKeyFormValues>): ApiKeyFormValues {
  return { ...VALID_VALUES, ...patch };
}

/**
 * @param values - form values to validate.
 * @returns the error message of the given field, or `undefined` when valid.
 */
function fieldError(
  values: ApiKeyFormValues,
  field: keyof ApiKeyFormValues,
): string | undefined {
  const result = apiKeyFormSchema.safeParse(values);

  if (result.success) {
    return undefined;
  }

  return result.error.issues.find((issue) => issue.path[0] === field)?.message;
}

describe('apiKeyFormSchema', () => {
  it('accepts the minimal valid values', () => {
    expect(apiKeyFormSchema.safeParse(VALID_VALUES).success).toBe(true);
  });

  it('accepts a filled description and a valid expiry date', () => {
    const result = apiKeyFormSchema.safeParse(
      withValues({ description: 'Éles kulcs', expiresAt: '2027-01-31' }),
    );

    expect(result.success).toBe(true);
  });

  it('rejects a missing name', () => {
    expect(fieldError(withValues({ name: '' }), 'name')).toBe(
      API_KEY_FORM_VALIDATION_MESSAGES.nameRequired,
    );
  });

  it('rejects a whitespace-only name', () => {
    expect(fieldError(withValues({ name: '   ' }), 'name')).toBe(
      API_KEY_FORM_VALIDATION_MESSAGES.nameRequired,
    );
  });

  it('rejects a name longer than 200 characters', () => {
    expect(fieldError(withValues({ name: 'a'.repeat(201) }), 'name')).toBe(
      API_KEY_FORM_VALIDATION_MESSAGES.nameTooLong,
    );
  });

  it('accepts a name of exactly 200 characters', () => {
    expect(
      apiKeyFormSchema.safeParse(withValues({ name: 'a'.repeat(200) })).success,
    ).toBe(true);
  });

  it('rejects a missing identifier', () => {
    expect(fieldError(withValues({ identifier: '' }), 'identifier')).toBe(
      API_KEY_FORM_VALIDATION_MESSAGES.identifierRequired,
    );
  });

  it('rejects an identifier with a space', () => {
    expect(
      fieldError(withValues({ identifier: 'vapi prod' }), 'identifier'),
    ).toBe(API_KEY_FORM_VALIDATION_MESSAGES.identifierInvalid);
  });

  it('rejects an identifier with a slash', () => {
    expect(
      fieldError(withValues({ identifier: 'vapi/prod' }), 'identifier'),
    ).toBe(API_KEY_FORM_VALIDATION_MESSAGES.identifierInvalid);
  });

  it('accepts dots, dashes and underscores in the identifier', () => {
    expect(
      apiKeyFormSchema.safeParse(withValues({ identifier: 'Vapi.prod_1-x' }))
        .success,
    ).toBe(true);
  });

  it('rejects a description longer than 2000 characters', () => {
    expect(
      fieldError(withValues({ description: 'a'.repeat(2001) }), 'description'),
    ).toBe(API_KEY_FORM_VALIDATION_MESSAGES.descriptionTooLong);
  });

  it('rejects a missing api key value', () => {
    expect(fieldError(withValues({ apiKey: '  ' }), 'apiKey')).toBe(
      API_KEY_FORM_VALIDATION_MESSAGES.apiKeyRequired,
    );
  });

  it('rejects an api key value longer than 4000 characters', () => {
    expect(fieldError(withValues({ apiKey: 'k'.repeat(4001) }), 'apiKey')).toBe(
      API_KEY_FORM_VALIDATION_MESSAGES.apiKeyTooLong,
    );
  });

  it('rejects a malformed expiry date', () => {
    expect(
      fieldError(withValues({ expiresAt: '2027.01.31' }), 'expiresAt'),
    ).toBe(API_KEY_FORM_VALIDATION_MESSAGES.expiresAtInvalid);
  });

  it('rejects a calendar day that does not exist', () => {
    expect(
      fieldError(withValues({ expiresAt: '2027-02-29' }), 'expiresAt'),
    ).toBe(API_KEY_FORM_VALIDATION_MESSAGES.expiresAtInvalid);
  });
});

describe('toCreateApiKeyInput', () => {
  it('trims the text fields', () => {
    const input = toCreateApiKeyInput(
      withValues({
        name: '  Vapi prod  ',
        identifier: ' vapi-prod ',
        apiKey: ' sk-live ',
      }),
    );

    expect(input).toEqual({
      name: 'Vapi prod',
      identifier: 'vapi-prod',
      apiKey: 'sk-live',
    });
  });

  it('omits empty optional fields instead of sending "" or null', () => {
    const input = toCreateApiKeyInput(
      withValues({ description: '', expiresAt: '' }),
    );

    expect(input).not.toHaveProperty('description');
    expect(input).not.toHaveProperty('expiresAt');
    expect(JSON.stringify(input)).not.toContain('null');
  });

  it('omits a whitespace-only description', () => {
    const input = toCreateApiKeyInput(withValues({ description: '   ' }));

    expect(input).not.toHaveProperty('description');
  });

  it('keeps a filled description', () => {
    const input = toCreateApiKeyInput(
      withValues({ description: ' Éles kulcs ' }),
    );

    expect(input.description).toBe('Éles kulcs');
  });

  it('converts a date input to that day local midnight as ISO', () => {
    const input = toCreateApiKeyInput(withValues({ expiresAt: '2027-01-31' }));

    const instant = new Date(input.expiresAt ?? '');

    expect(instant.getFullYear()).toBe(2027);
    expect(instant.getMonth()).toBe(0);
    expect(instant.getDate()).toBe(31);
    expect(instant.getHours()).toBe(0);
  });

  it('throws when an unvalidated malformed date reaches the mapping', () => {
    expect(() =>
      toCreateApiKeyInput(withValues({ expiresAt: '2027-13-01' })),
    ).toThrow(RangeError);
  });
});
