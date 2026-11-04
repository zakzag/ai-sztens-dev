/**
 * Pure rules of the `api-keys` page.
 *
 * Four jobs, all testable with values alone:
 *
 * 1. `apiKeyFormSchema` — **derived** from the shared `createApiKeySchema`
 *    (AIS-112 plan `D1`/`D2`), so the client cannot accept something the server
 *    rejects. Only two fields are overridden: `description` may be empty in a
 *    form (the mapper omits it) and `expiresAt` holds a calendar day instead of
 *    an ISO instant.
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
 * There is deliberately **no** copy in this module: every message comes from the
 * shared catalogue, and the schema is derived rather than re-typed.
 */

import {
  API_KEY_DEFAULT_SORT,
  API_KEY_DESCRIPTION_MAX_LENGTH,
  API_KEY_SORT_FIELDS,
  createApiKeySchema,
  dateOnlySchema,
  trimmedStringSchema,
  type ApiKeyListQuery,
  type ApiKeySortField,
  type CreateApiKeyInput,
} from '@callback/shared';
import type { DataTableSort } from '@callback/ui';
import { z } from 'zod';
import { toExpiryIso } from '../../lib/date.js';
import type { ApiKeyFormValues } from './api-keys.interface.js';

/**
 * Field rules of the create form.
 *
 * Built with `omit` + `extend` on the request schema: the limits, the
 * identifier pattern and every rejection message stay in the contract, and only
 * the two genuinely form-specific shapes are replaced. An unknown key is still
 * rejected, because `omit`/`extend` preserve the schema's `strict` policy.
 */
export const apiKeyFormSchema = createApiKeySchema
  .omit({ description: true, expiresAt: true })
  .extend({
    description: trimmedStringSchema({ max: API_KEY_DESCRIPTION_MAX_LENGTH }),
    expiresAt: dateOnlySchema.or(z.literal('')),
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
