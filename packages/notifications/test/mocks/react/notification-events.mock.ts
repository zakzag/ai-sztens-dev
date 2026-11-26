/**
 * Dispatches the two browser events the provider turns into log entries.
 *
 * The constructors differ per environment (jsdom has no `PromiseRejectionEvent`
 * initialiser), so the shapes are built here once instead of inside every test.
 */

/**
 * Fires a `window` `error` event, as an uncaught exception would.
 *
 * @param error - the thrown value; a string is allowed on purpose.
 */
export function dispatchWindowError(error: unknown): void {
  window.dispatchEvent(new ErrorEvent('error', { error, message: 'boom' }));
}

/**
 * Fires a `window` `unhandledrejection` event.
 *
 * @param reason - the rejection reason.
 */
export function dispatchUnhandledRejection(reason: unknown): void {
  const event = new Event('unhandledrejection');

  Object.defineProperty(event, 'reason', { value: reason });
  window.dispatchEvent(event);
}
