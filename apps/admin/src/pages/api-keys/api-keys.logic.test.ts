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
import {
  API_KEY_DESCRIPTION_MAX_LENGTH,
  API_KEY_NAME_MAX_LENGTH,
  API_KEY_VALUE_MAX_LENGTH,
  VALIDATION_ERROR_MAP,
  VALIDATION_MESSAGE_CATALOGUE,
  formatMessage,
  type ApiKeyListQuery,
} from '@callback/shared';
import type { DataTableSort } from '@callback/ui';
import type { ApiKeyFormValues } from './api-keys.interface.js';
import {
  apiKeyFormSchema,
  isApiKeySortable,
  toCreateApiKeyInput,
  toSortParams,
  toTableSort,
} from './api-keys.logic.js';

/** Hungarian copy, i.e. what the admin renders (AIS-112 `D2`). */
const HUNGARIAN = VALIDATION_MESSAGE_CATALOGUE.hu;

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
  // The map is what makes the zod-generated issues (`too_small`, …) speak the
  // configured locale — the same object `ApiKeyForm` hands to `zodResolver`.
  const result = apiKeyFormSchema.safeParse(values, {
    errorMap: VALIDATION_ERROR_MAP,
  });

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

  it('rejects a missing name with the shared REQUIRED copy', () => {
    expect(fieldError(withValues({ name: '' }), 'name')).toBe(
      HUNGARIAN.REQUIRED,
    );
  });

  it('rejects a whitespace-only name with the shared REQUIRED copy', () => {
    expect(fieldError(withValues({ name: '   ' }), 'name')).toBe(
      HUNGARIAN.REQUIRED,
    );
  });

  it('rejects a name longer than the shared limit', () => {
    expect(
      fieldError(
        withValues({ name: 'a'.repeat(API_KEY_NAME_MAX_LENGTH + 1) }),
        'name',
      ),
    ).toBe(formatMessage(HUNGARIAN.TOO_LONG_TEMPLATE, {
      max: API_KEY_NAME_MAX_LENGTH,
    }));
  });

  it('accepts a name of exactly the shared limit', () => {
    expect(
      apiKeyFormSchema.safeParse(
        withValues({ name: 'a'.repeat(API_KEY_NAME_MAX_LENGTH) }),
      ).success,
    ).toBe(true);
  });

  it('rejects a missing identifier', () => {
    expect(fieldError(withValues({ identifier: '' }), 'identifier')).toBe(
      HUNGARIAN.REQUIRED,
    );
  });

  it('rejects an identifier with a space', () => {
    expect(
      fieldError(withValues({ identifier: 'vapi prod' }), 'identifier'),
    ).toBe(HUNGARIAN.IDENTIFIER);
  });

  it('rejects an identifier with a slash', () => {
    expect(
      fieldError(withValues({ identifier: 'vapi/prod' }), 'identifier'),
    ).toBe(HUNGARIAN.IDENTIFIER);
  });

  it('accepts dots, dashes and underscores in the identifier', () => {
    expect(
      apiKeyFormSchema.safeParse(withValues({ identifier: 'Vapi.prod_1-x' }))
        .success,
    ).toBe(true);
  });

  it('trims the identifier before returning it', () => {
    const parsed = apiKeyFormSchema.parse(
      withValues({ identifier: '  vapi-prod  ' }),
    );

    expect(parsed.identifier).toBe('vapi-prod');
  });

  it('rejects a description longer than the shared limit', () => {
    expect(
      fieldError(
        withValues({
          description: 'a'.repeat(API_KEY_DESCRIPTION_MAX_LENGTH + 1),
        }),
        'description',
      ),
    ).toBe(formatMessage(HUNGARIAN.TOO_LONG_TEMPLATE, {
      max: API_KEY_DESCRIPTION_MAX_LENGTH,
    }));
  });

  it('rejects a whitespace-only api key value', () => {
    expect(fieldError(withValues({ apiKey: '  ' }), 'apiKey')).toBe(
      HUNGARIAN.REQUIRED,
    );
  });

  it('rejects an api key value longer than the shared limit', () => {
    expect(
      fieldError(
        withValues({ apiKey: 'k'.repeat(API_KEY_VALUE_MAX_LENGTH + 1) }),
        'apiKey',
      ),
    ).toBe(formatMessage(HUNGARIAN.TOO_LONG_TEMPLATE, {
      max: API_KEY_VALUE_MAX_LENGTH,
    }));
  });

  it('rejects a malformed expiry date', () => {
    expect(
      fieldError(withValues({ expiresAt: '2027.01.31' }), 'expiresAt'),
    ).toBe(HUNGARIAN.DATE_ONLY);
  });

  it('rejects a calendar day that does not exist', () => {
    expect(
      fieldError(withValues({ expiresAt: '2027-02-29' }), 'expiresAt'),
    ).toBe(HUNGARIAN.DATE_ONLY);
  });

  it('is derived from the request schema: an undeclared key is rejected', () => {
    const result = apiKeyFormSchema.safeParse({
      ...VALID_VALUES,
      id: 'injected',
    });

    expect(result.success).toBe(false);
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

describe('isApiKeySortable', () => {
  it('accepts a column of the contract allow-list', () => {
    expect(isApiKeySortable('name')).toBe(true);
    expect(isApiKeySortable('expiresAt')).toBe(true);
  });

  it('rejects a column that is not sortable', () => {
    expect(isApiKeySortable('description')).toBe(false);
    expect(isApiKeySortable('metadata')).toBe(false);
  });
});

describe('toTableSort', () => {
  it('maps the parsed URL query onto the table sort', () => {
    const params: ApiKeyListQuery = {
      page: 1,
      limit: 20,
      order: 'asc',
      q: undefined,
      sort: 'name',
    };

    expect(toTableSort(params)).toEqual({ columnId: 'name', order: 'asc' });
  });
});

describe('toSortParams', () => {
  it('maps a table sort back onto the URL query fields', () => {
    const sort: DataTableSort = { columnId: 'identifier', order: 'desc' };

    expect(toSortParams(sort)).toEqual({
      sort: 'identifier',
      order: 'desc',
    });
  });

  it('falls back to the contract default for an unknown column', () => {
    const sort: DataTableSort = { columnId: 'description', order: 'asc' };

    expect(toSortParams(sort).sort).toBe('createdAt');
  });
});
