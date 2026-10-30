/**
 * Props of `PageErrorState` (plan `D11`, tier 2).
 */
export interface PageErrorStateProps {
  /** Bold first line — the client-owned summary of the failed read. */
  readonly title: string;
  /** Already-mapped, user-facing sentence from `toErrorMessage`. */
  readonly message: string;
  /** Calls the owning query's `refetch`; the component never requests itself. */
  readonly onRetry: () => void;
  /** `true` while the retry is in flight; disables the button. */
  readonly isRetrying?: boolean;
  /** Override of the default “retry” label. */
  readonly retryLabel?: string;
  /** Override of the default label shown while retrying. */
  readonly retryingLabel?: string;
}
