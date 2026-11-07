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
  FILLED_API_KEY,
  VALIDATION_ERROR_MAP,
  VALIDATION_MESSAGE_CATALOGUE,
  formatMessage,
  type ApiKeyListQuery,
} from '@callback/shared';
import type { DataTableSort } from '@callback/ui';
import type {
  ApiKeyEditFormValues,
  ApiKeyFormValues,
} from './api-keys.interface.js';
import { API_KEY_DETAIL_ROUTE_PATH } from './api-keys.const.js';
import {
  apiKeyEditFormSchema,
  apiKeyFormSchema,
  isApiKeySortable,
  toApiKeyDetailRoute,
  toApiKeyEditFormValues,
  toApiKeyViewRoute,
  toCreateApiKeyInput,
  toSortParams,
  toTableSort,
  toUpdateApiKeyInput,
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

/** Valid values of the edit form; tests override one field at a time. */
const VALID_EDIT_VALUES: ApiKeyEditFormValues = {
  name: 'Vapi prod',
  description: 'Produkciós kulcs',
  expiresAt: '2027-02-01',
};

/** The version token every patch body must carry. */
const UPDATED_AT = '2026-11-04T09:00:00.000Z';

/**
 * @param patch - fields to override.
 * @returns the base edit values with the patch applied.
 */
function withEditValues(
  patch: Partial<ApiKeyEditFormValues>,
): ApiKeyEditFormValues {
  return { ...VALID_EDIT_VALUES, ...patch };
}

describe('apiKeyEditFormSchema', () => {
  it('accepts the three editable fields', () => {
    expect(apiKeyEditFormSchema.safeParse(VALID_EDIT_VALUES).success).toBe(true);
  });

  it('rejects an empty name with the shared required copy', () => {
    const result = apiKeyEditFormSchema.safeParse(
      withEditValues({ name: '   ' }),
      { errorMap: VALIDATION_ERROR_MAP },
    );

    expect(result.success).toBe(false);
    expect(
      result.success
        ? undefined
        : result.error.issues.find((issue) => issue.path[0] === 'name')
            ?.message,
    ).toBe(HUNGARIAN.REQUIRED);
  });

  it('accepts an empty expiry (the key then never expires)', () => {
    expect(
      apiKeyEditFormSchema.safeParse(withEditValues({ expiresAt: '' })).success,
    ).toBe(true);
  });

  it('rejects a field the PATCH contract does not accept', () => {
    // `.strict()` survives `omit`/`extend`, so a caller cannot smuggle the URL
    // identifier (or the token) into a partial update.
    expect(
      apiKeyEditFormSchema.safeParse({ ...VALID_EDIT_VALUES, identifier: 'x' })
        .success,
    ).toBe(false);
  });

  it('rejects the concurrency token as a field of its own', () => {
    expect(
      apiKeyEditFormSchema.safeParse({ ...VALID_EDIT_VALUES, updatedAt: UPDATED_AT })
        .success,
    ).toBe(false);
  });
});

describe('toUpdateApiKeyInput', () => {
  it('sends the values, the expiry as an instant and the version token', () => {
    const input = toUpdateApiKeyInput(VALID_EDIT_VALUES, UPDATED_AT);

    expect(input.name).toBe('Vapi prod');
    expect(input.description).toBe('Produkciós kulcs');
    expect(input.updatedAt).toBe(UPDATED_AT);
    expect(new Date(input.expiresAt ?? '').getFullYear()).toBe(2027);
    expect(input).not.toHaveProperty('identifier');
    expect(input).not.toHaveProperty('apiKey');
  });

  it('clears the optional fields with null instead of omitting them', () => {
    // `undefined` means “leave it”, `null` means “clear it”: the form always
    // shows the whole state, so an emptied field is an instruction.
    const input = toUpdateApiKeyInput(
      withEditValues({ description: '', expiresAt: '' }),
      UPDATED_AT,
    );

    expect(input.description).toBeNull();
    expect(input.expiresAt).toBeNull();
  });

  it('trims the texts before sending them', () => {
    const input = toUpdateApiKeyInput(
      withEditValues({ name: '  Vapi prod  ', description: '  kulcs  ' }),
      UPDATED_AT,
    );

    expect(input.name).toBe('Vapi prod');
    expect(input.description).toBe('kulcs');
  });

  it('throws for a calendar day that does not exist', () => {
    expect(() =>
      toUpdateApiKeyInput(withEditValues({ expiresAt: '2027-02-31' }), UPDATED_AT),
    ).toThrow(RangeError);
  });
});

describe('toApiKeyEditFormValues', () => {
  it('seeds the form with the current values and a date-input expiry', () => {
    const values = toApiKeyEditFormValues(FILLED_API_KEY);

    expect(values.name).toBe(FILLED_API_KEY.name);
    expect(values.description).toBe(FILLED_API_KEY.description ?? '');
    // `YYYY-MM-DD`, the value an `<input type="date">` expects.
    expect(values.expiresAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('renders an empty expiry for a row without one', () => {
    const values = toApiKeyEditFormValues({
      ...FILLED_API_KEY,
      description: null,
      expiresAt: null,
    });

    expect(values.description).toBe('');
    expect(values.expiresAt).toBe('');
  });
});

describe('toApiKeyDetailRoute', () => {
  it('substitutes and encodes the identifier', () => {
    expect(toApiKeyDetailRoute('vapi-staging')).toBe('/api-keys/vapi-staging');
    expect(toApiKeyDetailRoute('a b')).toBe('/api-keys/a%20b');
  });

  it('builds the read-only overlay route from the same parameter', () => {
    // AIS-155: the table links to `/view`; the legacy detail page stays a
    // sibling route reached from the overlay.
    expect(toApiKeyViewRoute('vapi-staging')).toBe(
      '/api-keys/vapi-staging/view',
    );
    expect(toApiKeyViewRoute('a b')).toBe('/api-keys/a%20b/view');
  });

  it('keeps the parameter of the route template untouched otherwise', () => {
    expect(API_KEY_DETAIL_ROUTE_PATH).toBe('/api-keys/:identifier');
  });
});
