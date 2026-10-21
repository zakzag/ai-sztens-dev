import {
  Alert,
  Button,
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
  API_KEYS_ERROR_TITLE,
  API_KEYS_LOADING_MESSAGE,
  API_KEYS_RETRY_LABEL,
  API_KEYS_TABLE_TITLE,
  API_KEY_COLUMNS,
} from '../api-keys.const.js';
import type { ApiKeysTableProps } from '../api-keys.interface.js';

/**
 * Renders exactly one of the four async states of the list: loading, error,
 * empty, success. The component holds no state and performs no requests — it
 * only renders the props it is given, so every branch is directly testable.
 *
 * The `apiKey` token is not part of {@link ApiKeysTableProps}, so this component
 * cannot leak it even by accident.
 *
 * @param props - see {@link ApiKeysTableProps}.
 */
export function ApiKeysTable({ apiKeys, isLoading, error, onRetry }: ApiKeysTableProps) {
  return (
    <Card className="space-y-4">
      <h2 className="text-lg font-semibold text-text-primary">{API_KEYS_TABLE_TITLE}</h2>
      <ApiKeysTableBody apiKeys={apiKeys} isLoading={isLoading} error={error} onRetry={onRetry} />
    </Card>
  );
}

/**
 * @param props - the same props as {@link ApiKeysTable}; extracted so the state
 *   decision reads as a short list instead of nested ternaries in JSX.
 * @returns the markup of the active state.
 */
function ApiKeysTableBody({ apiKeys, isLoading, error, onRetry }: ApiKeysTableProps): ReactNode {
  if (isLoading) {
    return <p className="text-sm text-text-secondary">{API_KEYS_LOADING_MESSAGE}</p>;
  }

  if (error !== null) {
    return (
      <Alert variant="danger" title={API_KEYS_ERROR_TITLE}>
        <p>{error}</p>
        <Button type="button" variant="secondary" size="sm" className="mt-3" onClick={onRetry}>
          {API_KEYS_RETRY_LABEL}
        </Button>
      </Alert>
    );
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
