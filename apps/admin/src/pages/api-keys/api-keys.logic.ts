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
  API_KEY_NAME_MAX_LENGTH,
  API_KEY_SORT_FIELDS,
  createApiKeySchema,
  dateOnlySchema,
  nonEmptyTextSchema,
  trimmedStringSchema,
  updateApiKeySchema,
  type ApiKey,
  type ApiKeyListQuery,
  type ApiKeySortField,
  type CreateApiKeyInput,
  type UpdateApiKeyInput,
} from '@callback/shared';
import type { DataTableSort } from '@callback/ui';
import { z } from 'zod';
import { toDateInputValue, toExpiryIso } from '../../lib/date.js';
import type {
  ApiKeyEditValues,
  ApiKeyFormValues,
} from './api-keys.interface.js';
import {
  API_KEY_DETAIL_PARAM,
  API_KEY_EDIT_ROUTE_PATH,
  API_KEY_VIEW_ROUTE_PATH,
} from './api-keys.const.js';

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
 * Field rules of the **edit** form (AIS-131).
 *
 * Derived from the shared `updateApiKeySchema` by removing what a form must not
 * own — `updatedAt` (a hidden concurrency token, bound at submit time) and
 * `apiKey` (a secret, rotated elsewhere) — and replacing the two fields whose
 * form shape differs from the wire shape, exactly like {@link apiKeyFormSchema}
 * does for create. Limits come from the contract, so the client cannot accept
 * something the server rejects.
 */
export const apiKeyEditFormSchema = updateApiKeySchema
  .omit({ apiKey: true, updatedAt: true })
  .extend({
    name: nonEmptyTextSchema({ max: API_KEY_NAME_MAX_LENGTH }),
    description: trimmedStringSchema({ max: API_KEY_DESCRIPTION_MAX_LENGTH }),
    expiresAt: dateOnlySchema.or(z.literal('')),
  });

/**
 * Builds the request body of `PATCH /api/api-keys/:identifier`.
 *
 * Unlike create, the optional fields are sent **explicitly as `null`** when
 * empty: `PATCH` distinguishes “leave it” (`undefined`) from “clear it” (`null`),
 * and the form always shows the whole current state, so an emptied expiry or
 * description means the user wants it removed.
 *
 * @param values - validated form values.
 * @param updatedAt - the version the user edited; the server's `STALE_WRITE`
 *   check compares it against the stored value.
 * @returns the partial body, always carrying the concurrency token.
 * @throws {RangeError} when `expiresAt` is not a calendar date — unreachable
 *   behind {@link apiKeyEditFormSchema}, and deliberately loud if it happens.
 */
export function toUpdateApiKeyInput(
  values: ApiKeyEditValues,
  updatedAt: string,
): UpdateApiKeyInput {
  const description = values.description.trim();
  const expiresAt = toExpiryIso(values.expiresAt);

  return {
    name: values.name.trim(),
    description: description.length > 0 ? description : null,
    expiresAt: expiresAt ?? null,
    updatedAt,
  };
}

/**
 * Seeds the edit form with the values the current version holds.
 *
 * @param dto - the row the detail query returned.
 * @returns form values: the expiry as a local calendar day, so the date input
 *   shows the same day the user picked when creating the key.
 */
export function toApiKeyEditValues(dto: ApiKey): ApiKeyEditValues {
  return {
    name: dto.name,
    description: dto.description ?? '',
    expiresAt: toDateInputValue(dto.expiresAt),
  };
}

/**
 * Builds the SPA link of the read-only overlay of one key (AIS-155).
 *
 * The template lives in {@link API_KEY_VIEW_ROUTE_PATH}, which the route
 * registry mounts as well: a link can never point at a path the router does not
 * serve.
 *
 * @param identifier - unique, URL-safe key of the resource.
 * @returns the route, e.g. `/api-keys/vapi-staging/view`.
 */
export function toApiKeyViewRoute(identifier: string): string {
  return API_KEY_VIEW_ROUTE_PATH.replace(
    `:${API_KEY_DETAIL_PARAM}`,
    encodeURIComponent(identifier),
  );
}

/**
 * Builds the SPA link of the edit overlay of one key (AIS-172).
 *
 * Same contract as {@link toApiKeyViewRoute}: one literal in
 * {@link API_KEY_EDIT_ROUTE_PATH}, shared by the read-only overlay's footer
 * action and the route registry.
 *
 * @param identifier - unique, URL-safe key of the resource.
 * @returns the route, e.g. `/api-keys/vapi-staging/edit`.
 */
export function toApiKeyEditRoute(identifier: string): string {
  return API_KEY_EDIT_ROUTE_PATH.replace(
    `:${API_KEY_DETAIL_PARAM}`,
    encodeURIComponent(identifier),
  );
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
