import { Component, type ErrorInfo, type ReactNode } from 'react';
import { PageErrorState } from '../../components/error/PageErrorState.js';
import {
  APP_ERROR_BOUNDARY_MESSAGE,
  APP_ERROR_BOUNDARY_RELOAD_LABEL,
  APP_ERROR_BOUNDARY_TITLE,
} from '../app.const.js';
import type { AppErrorBoundaryProps } from './app-error-boundary.interface.js';

/** State of {@link AppErrorBoundary}. */
interface AppErrorBoundaryState {
  /** `true` when a descendant threw during rendering. */
  readonly hasError: boolean;
}

/**
 * The component-level error boundary of the admin application.
 *
 * A render error would otherwise blank the page: React unmounts the whole
 * tree and the user is left with a white screen and no way forward. This
 * boundary catches the error and renders the page-level error state instead —
 * so the failure is visible and the user can reload (AIS-118, `D5`).
 *
 * It is deliberately a **class component**: React still only supports error
 * boundaries as classes.
 *
 * This is the fourth tier of the error model (`D11`), and it is a different
 * kind of failure than the other three:
 *
 * - tiers 1–2 are *query* failures — the page's data could not be loaded;
 * - tier 3 is the *app-level banner* — a persistent condition (offline,
 *   expired session);
 * - tier 4 is this boundary — a one-off crash of a component.
 */
export class AppErrorBoundary extends Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  public constructor(props: AppErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  public static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true };
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // The error boundary is the last resort: there is no error-reporting
    // service in the app yet, so the error is logged for the developer.
    console.error(
      '[AppErrorBoundary] uncaught render error',
      error,
      errorInfo.componentStack,
    );
  }

  public override render(): ReactNode {
    if (this.state.hasError) {
      return (
        <PageErrorState
          title={this.props.title ?? APP_ERROR_BOUNDARY_TITLE}
          message={this.props.message ?? APP_ERROR_BOUNDARY_MESSAGE}
          onRetry={reloadPage}
          retryLabel={this.props.reloadLabel ?? APP_ERROR_BOUNDARY_RELOAD_LABEL}
        />
      );
    }

    return this.props.children;
  }
}

/**
 * Reloads the document.
 *
 * There is no query to refetch here — the failure was a render error, not a
 * failed read — so the only honest recovery is a fresh page load.
 */
function reloadPage(): void {
  window.location.reload();
}
