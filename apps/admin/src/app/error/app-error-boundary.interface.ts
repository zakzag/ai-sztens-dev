import type { ReactNode } from 'react';

/**
 * One caught render error, as the boundary reports it.
 *
 * `error` is `unknown` on purpose: React types it as `Error`, but a thrown
 * non-error value (a rejected string inside a render path, a broken polyfill)
 * reaches the same handler, and the emitter must not assume otherwise.
 *
 * `componentStack` is React's own component trace, or `null` when React did not
 * provide one — never an empty string, so “no trace” and “empty trace” cannot be
 * confused.
 */
export interface AppRenderErrorReport {
  readonly error: unknown;
  readonly componentStack: string | null;
}

/**
 * The injected error port of {@link AppErrorBoundary} (AIS-136 `D3`).
 *
 * The boundary is a class component, so it cannot use a hook to reach the
 * notification store; the DI rule also forbids it from importing the singleton.
 * `App.tsx` builds the implementation from the app's single store and passes it
 * in, which keeps the boundary testable without a store.
 */
export type AppRenderErrorHandler = (report: AppRenderErrorReport) => void;

/** Props of {@link AppErrorBoundary}. */
export interface AppErrorBoundaryProps {
  /** The subtree to protect. */
  readonly children: ReactNode;

  /** Title of the error state. */
  readonly title?: string;

  /** Message of the error state. */
  readonly message?: string;

  /** Label of the reload button. */
  readonly reloadLabel?: string;

  /**
   * Receives every caught render error exactly once.
   *
   * Optional, so the boundary works in isolation; a throwing implementation must
   * never break the fallback UI — the boundary guards the call.
   */
  readonly onError?: AppRenderErrorHandler;
}
