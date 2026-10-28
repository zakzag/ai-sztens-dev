import { useMemo } from 'react';
import { PageErrorState } from '../../components/error/PageErrorState.js';
import { toApiKeyViewModels } from '../../entities/api-key/api-key.mapper.js';
import { useApiKeysQuery } from '../../features/api-keys/use-api-keys.js';
import {
  API_KEYS_ERROR_TITLE,
  API_KEYS_PAGE_SUBTITLE,
  API_KEYS_PAGE_TITLE,
} from './api-keys.const.js';
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
 * Failure routing (plan `D11`): the hook reports the *surface* the failure
 * belongs to. Only `page` is rendered here, as `PageErrorState` with a retry;
 * `banner` conditions (offline, `401`, `503`) are shown once by the layout shell,
 * so the same sentence never appears twice.
 *
 * @returns the page content.
 */
export function ApiKeysPage() {
  const { apiKeys, isLoading, isFetching, errorMessage, errorSurface, refetch } = useApiKeysQuery();
  const viewModels = useMemo(() => toApiKeyViewModels(apiKeys), [apiKeys]);
  const pageErrorMessage = errorSurface === 'page' ? errorMessage : null;

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-text-primary">{API_KEYS_PAGE_TITLE}</h1>
        <p className="mt-2 text-sm text-text-secondary">{API_KEYS_PAGE_SUBTITLE}</p>
      </header>

      {pageErrorMessage !== null ? (
        <PageErrorState
          title={API_KEYS_ERROR_TITLE}
          message={pageErrorMessage}
          onRetry={refetch}
          isRetrying={isFetching}
        />
      ) : (
        <ApiKeysTable apiKeys={viewModels} isLoading={isLoading} />
      )}

      <ApiKeyForm />
    </section>
  );
}
