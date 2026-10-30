import { Alert, Button } from '@callback/ui';
import {
  PAGE_ERROR_RETRY_LABEL,
  PAGE_ERROR_RETRY_PENDING_LABEL,
} from '../../lib/error-surface.const.js';
import type { PageErrorStateProps } from './page-error-state.interface.js';

/**
 * Page-level error state: the page's own data is unavailable, but the app still
 * works.
 *
 * It is the second tier of `D11` and is mandatory on every page that reads
 * server data — loading, empty, error and success all have to be explicit. The
 * retry button calls the callback it is given (the query's `refetch`), so this
 * component stays props-driven and cannot issue a request of its own.
 *
 * @param props - see {@link PageErrorStateProps}.
 */
export function PageErrorState({
  title,
  message,
  onRetry,
  isRetrying = false,
  retryLabel = PAGE_ERROR_RETRY_LABEL,
  retryingLabel = PAGE_ERROR_RETRY_PENDING_LABEL,
}: PageErrorStateProps) {
  return (
    <Alert variant="danger" title={title}>
      <p>{message}</p>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="mt-3"
        onClick={onRetry}
        disabled={isRetrying}
      >
        {isRetrying ? retryingLabel : retryLabel}
      </Button>
    </Alert>
  );
}
