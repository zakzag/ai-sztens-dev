/**
 * Connectivity fixtures for the tests of `useOnlineStatus` and
 * `AppErrorBanner`.
 *
 * jsdom always reports `navigator.onLine === true`, so the offline case has to
 * be simulated by replacing the getter — and restored explicitly, because
 * `restoreMocks` only undoes spies.
 */

/**
 * @param isOnline - the value `navigator.onLine` should report from now on.
 */
export function mockOnlineStatus(isOnline: boolean): void {
  Object.defineProperty(window.navigator, 'onLine', {
    configurable: true,
    get: () => isOnline,
  });
}

/**
 * @param type - the browser event the app listens to.
 */
export function emitConnectivityEvent(type: 'online' | 'offline'): void {
  window.dispatchEvent(new Event(type));
}

/** Puts the prototype getter of jsdom back in charge. */
export function restoreOnlineStatus(): void {
  Reflect.deleteProperty(window.navigator, 'onLine');
}
