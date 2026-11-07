import { useMemo } from 'react';
import { apiKeyListQuerySchema } from '@callback/shared';
import { Pagination, buttonVariants } from '@callback/ui';
import { PlusIcon } from '@callback/ui';
import type { DataTableSort } from '@callback/ui';
import { Link, Outlet } from 'react-router-dom';
import { PageErrorState } from '../../components/error/PageErrorState.js';
import { toApiKeyViewModels } from '../../entities/api-key/api-key.mapper.js';
import { useApiKeysQuery } from '../../features/api-keys/use-api-keys.js';
import { useListParams } from '../../features/api/use-list-params.js';
import {
  API_KEYS_CREATE_LABEL,
  API_KEYS_CREATE_ROUTE_PATH,
  API_KEYS_ERROR_TITLE,
  API_KEYS_LIMIT_OPTIONS,
  API_KEYS_PAGE_SUBTITLE,
  API_KEYS_PAGE_TITLE,
} from './api-keys.const.js';
import { toSortParams, toTableSort } from './api-keys.logic.js';
import { ApiKeysTable } from './ui/ApiKeysTable.js';

/**
 * `/api-keys` — the list of the stored API keys, plus its overlay routes.
 *
 * Since AIS-155 the page is **list first**: the create form is no longer inline
 * under the table but a route-mounted overlay (`/api-keys/new`), and the
 * read-only view is the sibling `/api-keys/:identifier/view`. Both paint into
 * the `<Outlet/>` of this page, which is why the list stays mounted behind the
 * dialog — no second fetch, no lost scroll position, and the URL of the list is
 * still the URL the user returns to.
 *
 * Composition only: the page reads the server state through the feature hook,
 * maps the wire rows to view models once per response, and hands both to the
 * presentational parts. It owns no UI state of its own (no filters, no
 * selection, no drawer), which is why there is no Zustand store here — the
 * overlay's open/closed state is a URL, not page state.
 *
 * The whole query (page, limit, sort, order, search) lives in the **URL**
 * (AIS-119): `useListParams` parses it through the shared schema and hands it to
 * the hook, which uses it both as the request and as the query key.
 *
 * Failure routing (plan `D11`): the hook reports the *surface* the failure
 * belongs to. Only `page` is rendered here, as `PageErrorState` with a retry;
 * `banner` conditions (offline, `401`, `503`) are shown once by the layout shell,
 * so the same sentence never appears twice.
 *
 * @returns the page content with the overlay outlet.
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
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">
            {API_KEYS_PAGE_TITLE}
          </h1>
          <p className="mt-2 text-sm text-text-secondary">
            {API_KEYS_PAGE_SUBTITLE}
          </p>
        </div>

        {/*
          A link, not a button: opening the create overlay is a navigation to
          `/api-keys/new`, so the browser's own affordances (open in a new tab,
          copy the link) work. `buttonVariants` keeps the primary look without a
          second hand-written class recipe.
        */}
        <Link to={API_KEYS_CREATE_ROUTE_PATH} className={buttonVariants()}>
          <PlusIcon />
          {API_KEYS_CREATE_LABEL}
        </Link>
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

      {/* The overlay routes (`new`, `:identifier/view`) render here. */}
      <Outlet />
    </section>
  );
}
