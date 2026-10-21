import { useMemo } from 'react';
import { toApiKeyViewModels } from '../../entities/api-key/api-key.mapper.js';
import { useApiKeysQuery } from '../../features/api-keys/use-api-keys.js';
import { API_KEYS_PAGE_SUBTITLE, API_KEYS_PAGE_TITLE } from './api-keys.const.js';
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
 * @returns the page content.
 */
export function ApiKeysPage() {
  const { apiKeys, isLoading, error, refetch } = useApiKeysQuery();
  const viewModels = useMemo(() => toApiKeyViewModels(apiKeys), [apiKeys]);

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-text-primary">{API_KEYS_PAGE_TITLE}</h1>
        <p className="mt-2 text-sm text-text-secondary">{API_KEYS_PAGE_SUBTITLE}</p>
      </header>

      <ApiKeysTable
        apiKeys={viewModels}
        isLoading={isLoading}
        error={error}
        onRetry={refetch}
      />

      <ApiKeyForm />
    </section>
  );
}
