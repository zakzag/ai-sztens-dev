import { Component, type ErrorInfo, type ReactNode } from 'react';
import { PageErrorState } from '../../components/error/PageErrorState.js';
import {
  APP_ERROR_BOUNDARY_MESSAGE,
  APP_ERROR_BOUNDARY_RELOAD_LABEL,
  APP_ERROR_BOUNDARY_TITLE,
} from '../app.const.js';
import type {
  AppErrorBoundaryProps,
  AppRenderErrorReport,
} from './app-error-boundary.interface.js';

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
 *
 * Since AIS-136 the crash is also **reported**, not only rendered: the injected
 * `onError` port receives it exactly once, so the notification log and the toast
 * stack learn about a failure that no query callback would ever see. The port is
 * injected rather than imported (`D3`) because a class component cannot use a
 * hook and the DI rule forbids reaching for the store singleton here.
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

  /**
   * Reports the crash to the developer console **and** to the injected port.
   *
   * React calls this once per error that reaches the boundary, so the port never
   * sees a duplicate. The call is guarded: if the emitter itself throws, the user
   * must still get the fallback UI instead of a second, uncaught crash.
   *
   * @param error - the thrown value React caught.
   * @param errorInfo - React's component trace.
   */
  public override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // The error boundary is the last resort: there is no error-reporting
    // service in the app yet, so the error is logged for the developer.
    console.error(
      '[AppErrorBoundary] uncaught render error',
      error,
      errorInfo.componentStack,
    );

    this.reportError({
      error,
      componentStack:
        typeof errorInfo.componentStack === 'string'
          ? errorInfo.componentStack
          : null,
    });
  }

  /**
   * Hands one report to the caller's port, never letting it break the fallback.
   *
   * @param report - the caught error and React's component trace.
   */
  private reportError(report: AppRenderErrorReport): void {
    const { onError } = this.props;

    if (onError === undefined) {
      return;
    }

    try {
      onError(report);
    } catch (emitterError) {
      // Intentional: a broken notification emitter must not turn a handled
      // render error into an unhandled one. It is still logged for diagnosis.
      console.error(
        '[AppErrorBoundary] the error port threw',
        emitterError,
      );
    }
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
