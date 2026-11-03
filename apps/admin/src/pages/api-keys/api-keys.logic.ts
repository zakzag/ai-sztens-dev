/**
 * Pure rules of the `api-keys` page.
 *
 * Four jobs, all testable with values alone:
 *
 * 1. `apiKeyFormSchema` — client-side validation that mirrors the backend
 *    limits. The numbers and the identifier pattern come from
 *    `@callback/shared`, so the form cannot drift away from the API contract.
 * 2. `toCreateApiKeyInput` — form values → request body. Empty optional fields
 *    are **omitted** (not `null`, not `''`), because the backend DTO declares
 *    them as optional strings and rejects anything else.
 * 3. `toTableSort` / `toSortParams` — the two directions between the URL query
 *    and the table's `DataTableSort` (AIS-116 §7.3). The table reports intent,
 *    the URL owns the truth, and these are the only translation points.
 * 4. `isApiKeySortable` — asks the **contract's** allow-list whether a column may
 *    be sorted, so the table cannot offer a sort the API would answer with a
 *    `400`.
 *
 * Why not reuse the shared `createApiKeySchema` for the form? Because it expects
 * an ISO instant in `expiresAt`, while the form holds a calendar day. The wire
 * schema still guards the request on the service side (plan decision D31).
 */

import {
  API_KEY_DEFAULT_SORT,
  API_KEY_DESCRIPTION_MAX_LENGTH,
  API_KEY_IDENTIFIER_PATTERN,
  API_KEY_NAME_MAX_LENGTH,
  API_KEY_SORT_FIELDS,
  API_KEY_VALUE_MAX_LENGTH,
  type ApiKeyListQuery,
  type ApiKeySortField,
  type CreateApiKeyInput,
} from '@callback/shared';
import type { DataTableSort } from '@callback/ui';
import { z } from 'zod';
import { toExpiryIso } from '../../lib/date.js';
import { API_KEY_FORM_VALIDATION_MESSAGES } from './api-keys.const.js';
import type { ApiKeyFormValues } from './api-keys.interface.js';

/**
 * @param value - date input value; may be empty.
 * @returns `true` when {@link toExpiryIso} would accept the value.
 */
function isExpiryInputAccepted(value: string): boolean {
  try {
    toExpiryIso(value);

    return true;
  } catch {
    // `toExpiryIso` signals “not a calendar date” by throwing `RangeError`. For
    // a validation predicate that throw *is* the answer, so it is turned into
    // `false` here and nowhere else — the real conversion stays untouched.
    return false;
  }
}

/**
 * Field rules of the create form.
 *
 * `z.string().trim()` is applied before the length checks, so a name of spaces
 * is rejected instead of being stored as `'   '`.
 */
export const apiKeyFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, API_KEY_FORM_VALIDATION_MESSAGES.nameRequired)
    .max(API_KEY_NAME_MAX_LENGTH, API_KEY_FORM_VALIDATION_MESSAGES.nameTooLong),
  identifier: z
    .string()
    .trim()
    .min(1, API_KEY_FORM_VALIDATION_MESSAGES.identifierRequired)
    .regex(
      API_KEY_IDENTIFIER_PATTERN,
      API_KEY_FORM_VALIDATION_MESSAGES.identifierInvalid,
    ),
  description: z
    .string()
    .trim()
    .max(
      API_KEY_DESCRIPTION_MAX_LENGTH,
      API_KEY_FORM_VALIDATION_MESSAGES.descriptionTooLong,
    ),
  apiKey: z
    .string()
    .trim()
    .min(1, API_KEY_FORM_VALIDATION_MESSAGES.apiKeyRequired)
    .max(
      API_KEY_VALUE_MAX_LENGTH,
      API_KEY_FORM_VALIDATION_MESSAGES.apiKeyTooLong,
    ),
  expiresAt: z
    .string()
    .refine(
      isExpiryInputAccepted,
      API_KEY_FORM_VALIDATION_MESSAGES.expiresAtInvalid,
    ),
});

/**
 * Builds the request body of `POST /api/api-keys`.
 *
 * @param values - validated form values.
 * @returns the payload the API expects: trimmed texts, and the optional fields
 *   present only when they carry a value.
 * @throws {RangeError} when `expiresAt` is not a calendar date — unreachable
 *   behind {@link apiKeyFormSchema}, and deliberately loud if it happens.
 */
export function toCreateApiKeyInput(
  values: ApiKeyFormValues,
): CreateApiKeyInput {
  const description = values.description.trim();
  const expiresAt = toExpiryIso(values.expiresAt);

  return {
    name: values.name.trim(),
    identifier: values.identifier.trim(),
    apiKey: values.apiKey.trim(),
    ...(description.length > 0 ? { description } : {}),
    ...(expiresAt === undefined ? {} : { expiresAt }),
  };
}

/**
 * @param columnId - the `id` of a table column.
 * @returns `true` when the API accepts that column in `?sort=`.
 */
export function isApiKeySortable(
  columnId: string,
): columnId is ApiKeySortField {
  return API_KEY_SORT_FIELDS.some((field) => field === columnId);
}

/**
 * URL → table: what the header should mark as sorted.
 *
 * @param params - the parsed list query (the URL).
 * @returns the sort the table renders.
 */
export function toTableSort(params: ApiKeyListQuery): DataTableSort {
  return { columnId: params.sort, order: params.order };
}

/**
 * Narrows a table column id onto the contract's sort allow-list.
 *
 * A column that is not sortable never reaches this function (the table only
 * offers controls for `sortable` columns), but the fallback keeps the URL valid
 * if it ever did: the server would reject an unknown `sort` with a `400`.
 *
 * @param columnId - the column the user clicked.
 * @returns one of {@link API_KEY_SORT_FIELDS}.
 */
function toApiKeySortField(columnId: string): ApiKeySortField {
  return isApiKeySortable(columnId) ? columnId : API_KEY_DEFAULT_SORT;
}

/**
 * Table → URL: the query patch a sort request becomes.
 *
 * Returned as a patch (not as two separate writes) so the caller can hand it to
 * `setParams`, which performs **one** URL write for `sort` + `order` and resets
 * the page (AIS-116 D4).
 *
 * @param sort - the sort the table reported.
 * @returns the query fields to write.
 */
export function toSortParams(
  sort: DataTableSort,
): Pick<ApiKeyListQuery, 'sort' | 'order'> {
  return { sort: toApiKeySortField(sort.columnId), order: sort.order };
}
