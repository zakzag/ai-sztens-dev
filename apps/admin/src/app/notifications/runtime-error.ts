import { NOTIFICATION_EVENT_DEFAULTS, type NotificationStore } from '@callback/notifications';
import { RUNTIME_ERROR_MESSAGE, toRuntimeDetail } from '@callback/notifications/react';
import type { AppRenderErrorHandler } from '../error/app-error-boundary.interface.js';

/**
 * Emitter of render crashes — the fifth capture channel (AIS-136 `G3`).
 *
 * `AppErrorBoundary` catches a component crash and renders `PageErrorState`, but
 * until AIS-136 that failure left no trace: no log entry, no toast, and nothing
 * for the user who happened to be looking elsewhere. This factory closes that
 * gap with the same shape as the other capture adapters: it reads the report,
 * asks the catalogued defaults, and emits **one** entry.
 *
 * Everything the entry needs is already decided elsewhere:
 *
 * - `level` / `source` / `toast` come from `NOTIFICATION_EVENT_DEFAULTS['runtime.error']`
 *   (`error` / `runtime` / `true`), so a crash is always announced;
 * - the sentence is the package's own `RUNTIME_ERROR_MESSAGE` — a crash has no
 *   caller-owned copy;
 * - `toRuntimeDetail` decides what is safe to record: name and message always,
 *   the stack only when the caller allows it.
 *
 * The store is injected (not imported) so the factory stays testable without the
 * app singleton, and the boundary that consumes the returned handler keeps
 * depending on a port rather than on the store (`D3`).
 *
 * @param store - the application's single notification store.
 * @param includeDetails - whether the stack may be recorded (`import.meta.env.DEV`).
 * @returns the handler `AppErrorBoundary` calls for every caught render error.
 */
export function createRuntimeErrorEmitter(
  store: NotificationStore,
  includeDetails: boolean,
): AppRenderErrorHandler {
  const defaults = NOTIFICATION_EVENT_DEFAULTS['runtime.error'];

  return (report) => {
    store.emit({
      level: defaults.level,
      source: defaults.source,
      message: RUNTIME_ERROR_MESSAGE,
      detail: toRuntimeDetail(report.error, includeDetails),
      toast: defaults.toast,
    });
  };
}
