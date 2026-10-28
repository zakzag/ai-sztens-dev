import {
  Card,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from '@callback/ui';
import type { ReactNode } from 'react';
import {
  API_KEYS_EMPTY_MESSAGE,
  API_KEYS_LOADING_MESSAGE,
  API_KEYS_TABLE_TITLE,
  API_KEY_COLUMNS,
} from '../api-keys.const.js';
import type { ApiKeysTableProps } from '../api-keys.interface.js';

/**
 * Renders the three data states of the list: loading, empty, success.
 *
 * The fourth state — the failed read — belongs to the page (`PageErrorState`),
 * because it describes the page's data, not the table's content; this component
 * therefore only receives rows and a loading flag, holds no state and performs no
 * requests.
 *
 * The `apiKey` token is not part of {@link ApiKeysTableProps}, so this component
 * cannot leak it even by accident.
 *
 * @param props - see {@link ApiKeysTableProps}.
 */
export function ApiKeysTable({ apiKeys, isLoading }: ApiKeysTableProps) {
  return (
    <Card className="space-y-4">
      <h2 className="text-lg font-semibold text-text-primary">{API_KEYS_TABLE_TITLE}</h2>
      <ApiKeysTableBody apiKeys={apiKeys} isLoading={isLoading} />
    </Card>
  );
}

/**
 * @param props - the same props as {@link ApiKeysTable}; extracted so the state
 *   decision reads as a short list instead of nested ternaries in JSX.
 * @returns the markup of the active state.
 */
function ApiKeysTableBody({ apiKeys, isLoading }: ApiKeysTableProps): ReactNode {
  if (isLoading) {
    return <p className="text-sm text-text-secondary">{API_KEYS_LOADING_MESSAGE}</p>;
  }

  if (apiKeys.length === 0) {
    return <p className="text-sm text-text-secondary">{API_KEYS_EMPTY_MESSAGE}</p>;
  }

  return (
    <Table>
      <TableHead>
        <TableRow>
          <TableHeaderCell scope="col">{API_KEY_COLUMNS.name}</TableHeaderCell>
          <TableHeaderCell scope="col">{API_KEY_COLUMNS.identifier}</TableHeaderCell>
          <TableHeaderCell scope="col">{API_KEY_COLUMNS.description}</TableHeaderCell>
          <TableHeaderCell scope="col">{API_KEY_COLUMNS.expiresAt}</TableHeaderCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {apiKeys.map((apiKey) => (
          <TableRow key={apiKey.id}>
            <TableCell>{apiKey.name}</TableCell>
            <TableCell>{apiKey.identifier}</TableCell>
            <TableCell>{apiKey.description}</TableCell>
            <TableCell>{apiKey.expiresAtLabel}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
