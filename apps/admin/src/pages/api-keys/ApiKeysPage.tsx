import { useMemo } from 'react';
import { apiKeyListQuerySchema } from '@callback/shared';
import { Pagination } from '@callback/ui';
import type { DataTableSort } from '@callback/ui';
import { PageErrorState } from '../../components/error/PageErrorState.js';
import { toApiKeyViewModels } from '../../entities/api-key/api-key.mapper.js';
import { useApiKeysQuery } from '../../features/api-keys/use-api-keys.js';
import { useListParams } from '../../features/api/use-list-params.js';
import {
  API_KEYS_ERROR_TITLE,
  API_KEYS_LIMIT_OPTIONS,
  API_KEYS_PAGE_SUBTITLE,
  API_KEYS_PAGE_TITLE,
} from './api-keys.const.js';
import { toSortParams, toTableSort } from './api-keys.logic.js';
import { ApiKeyForm } from './ui/ApiKeyForm.js';
import { ApiKeysTable } from './ui/ApiKeysTable.js';

/**
 * `/api-keys` — list of the stored API keys plus the create form.
 *
 * Composition only: the page reads the server state through the feature hook,
 * maps the wire rows to view models once per response, and hands both to the
 * presentational parts. It owns no UI state of its own (no filters, no
 * selection, no drawer), which is why there is no Zustand store here — see the
 * state table in `docs/Specs/UI-Architecture.md`.
 *
 * The whole query (page, limit, sort, order, search) lives in the **URL**
 * (AIS-119): `useListParams` parses it through the shared schema and hands it to
 * the hook, which uses it both as the request and as the query key. A deep link
 * such as `/api-keys?page=2&sort=name` therefore works without any page state.
 *
 * The two interactions added in AIS-116:
 * - the **pager** renders `meta.pagination` and writes `page` / `limit` back to
 *   the URL with the single-field setter;
 * - a **sortable header** reports a `DataTableSort`, which becomes one
 *   `setParams` call (`sort` + `order` in a single write, page back to 1) — two
 *   single-field writes would overwrite each other and add a history entry.
 *
 * Failure routing (plan `D11`): the hook reports the *surface* the failure
 * belongs to. Only `page` is rendered here, as `PageErrorState` with a retry;
 * `banner` conditions (offline, `401`, `503`) are shown once by the layout shell,
 * so the same sentence never appears twice.
 *
 * @returns the page content.
 */
export function ApiKeysPage() {
  const { params, setParam, setParams } = useListParams(apiKeyListQuerySchema);
  const {
    apiKeys,
    meta,
    isLoading,
    isFetching,
    errorMessage,
    errorSurface,
    refetch,
  } = useApiKeysQuery(params);
  const viewModels = useMemo(() => toApiKeyViewModels(apiKeys), [apiKeys]);
  const pageErrorMessage = errorSurface === 'page' ? errorMessage : null;

  /**
   * A sort request is two query fields, so it goes through the batch setter.
   *
   * @param next - the sort the table reported.
   */
  const handleSortChange = (next: DataTableSort): void => {
    setParams(toSortParams(next));
  };

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-text-primary">
          {API_KEYS_PAGE_TITLE}
        </h1>
        <p className="mt-2 text-sm text-text-secondary">
          {API_KEYS_PAGE_SUBTITLE}
        </p>
      </header>

      {pageErrorMessage !== null ? (
        <PageErrorState
          title={API_KEYS_ERROR_TITLE}
          message={pageErrorMessage}
          onRetry={refetch}
          isRetrying={isFetching}
        />
      ) : (
        <ApiKeysTable
          apiKeys={viewModels}
          isLoading={isLoading}
          sort={toTableSort(params)}
          onSortChange={handleSortChange}
          pagination={
            meta === null ? undefined : (
              <Pagination
                meta={meta.pagination}
                limitOptions={API_KEYS_LIMIT_OPTIONS}
                onPageChange={(page) => {
                  setParam('page', page);
                }}
                onLimitChange={(limit) => {
                  setParam('limit', limit);
                }}
              />
            )
          }
        />
      )}

      <ApiKeyForm />
    </section>
  );
}
