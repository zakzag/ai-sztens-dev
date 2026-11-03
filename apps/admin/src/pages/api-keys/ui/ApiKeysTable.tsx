import { Card, DataTable, EmptyState } from '@callback/ui';
import type { DataTableColumn } from '@callback/ui';
import type { ApiKeyViewModel } from '../../../entities/api-key/api-key.interface.js';
import {
  API_KEYS_EMPTY_MESSAGE,
  API_KEYS_LOADING_MESSAGE,
  API_KEYS_TABLE_TITLE,
  API_KEY_COLUMNS,
} from '../api-keys.const.js';
import type { ApiKeysTableProps } from '../api-keys.interface.js';
import { isApiKeySortable } from '../api-keys.logic.js';

/**
 * Columns of the list, in render order.
 *
 * `sortable` asks the shared contract (`API_KEY_SORT_FIELDS`) whether the API
 * accepts the column in `?sort=`, so the table can never offer a sort the server
 * would answer with a `400` — and adding a sortable column to the contract
 * automatically makes its header clickable here.
 */
const API_KEY_TABLE_COLUMNS: readonly DataTableColumn<ApiKeyViewModel>[] = [
  {
    id: 'name',
    header: API_KEY_COLUMNS.name,
    cell: (apiKey) => apiKey.name,
    sortable: isApiKeySortable('name'),
  },
  {
    id: 'identifier',
    header: API_KEY_COLUMNS.identifier,
    cell: (apiKey) => apiKey.identifier,
    sortable: isApiKeySortable('identifier'),
  },
  {
    id: 'description',
    header: API_KEY_COLUMNS.description,
    cell: (apiKey) => apiKey.description,
    sortable: isApiKeySortable('description'),
  },
  {
    id: 'expiresAt',
    header: API_KEY_COLUMNS.expiresAt,
    cell: (apiKey) => apiKey.expiresAtLabel,
    sortable: isApiKeySortable('expiresAt'),
  },
];

/**
 * The list part of the page: a `DataTable` plus the pager slot.
 *
 * Renders the three data states of the list — loading (skeleton rows, header
 * kept), empty (`EmptyState`) and success — and holds no state of its own. The
 * failure state belongs to the page (`PageErrorState`), because an unavailable
 * list is the page's data being unavailable, not a property of the table.
 *
 * The loading sentence is `sr-only` on purpose: the skeleton rows are
 * `aria-hidden`, so without it a screen reader would get no announcement at all.
 *
 * The `apiKey` token is not part of {@link ApiKeysTableProps}, so this component
 * cannot leak it even by accident.
 *
 * @param props - see {@link ApiKeysTableProps}.
 */
export function ApiKeysTable({
  apiKeys,
  isLoading,
  sort,
  onSortChange,
  pagination,
}: ApiKeysTableProps) {
  return (
    <Card className="space-y-4">
      <h2 className="text-lg font-semibold text-text-primary">
        {API_KEYS_TABLE_TITLE}
      </h2>
      {isLoading ? (
        <p role="status" className="sr-only">
          {API_KEYS_LOADING_MESSAGE}
        </p>
      ) : null}
      <DataTable
        rows={apiKeys}
        columns={API_KEY_TABLE_COLUMNS}
        rowKey={(apiKey) => apiKey.id}
        sort={sort}
        onSortChange={onSortChange}
        isLoading={isLoading}
        caption={API_KEYS_TABLE_TITLE}
        empty={<EmptyState title={API_KEYS_EMPTY_MESSAGE} />}
      />
      {pagination}
    </Card>
  );
}
