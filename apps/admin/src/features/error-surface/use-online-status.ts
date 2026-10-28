/**
 * Browser connectivity as a React value.
 *
 * `navigator.onLine` is not React state: it changes on its own, from outside the
 * app. `useSyncExternalStore` is the sanctioned bridge — the store is the
 * browser, the app only mirrors it, and no copy is kept in Zustand.
 */

import { useSyncExternalStore } from 'react';

/** Browser events that signal a connectivity change. */
const CONNECTIVITY_EVENTS = ['online', 'offline'] as const;

/**
 * @param onStoreChange - callback React hands over to be notified.
 * @returns the unsubscribe function.
 */
function subscribeToConnectivity(onStoreChange: () => void): () => void {
  for (const event of CONNECTIVITY_EVENTS) {
    window.addEventListener(event, onStoreChange);
  }

  return () => {
    for (const event of CONNECTIVITY_EVENTS) {
      window.removeEventListener(event, onStoreChange);
    }
  };
}

/**
 * @returns `true` when the browser does not report “offline”.
 */
function getOnlineSnapshot(): boolean {
  return navigator.onLine;
}

/**
 * Server-side snapshot for the (never used in this SPA) hydration path.
 *
 * @returns `true`, so a banner never flashes during a first render.
 */
function getAssumedOnlineSnapshot(): boolean {
  return true;
}

/**
 * @returns `true` while the browser believes it has connectivity; updates on
 *   the `online` / `offline` events.
 */
export function useOnlineStatus(): boolean {
  return useSyncExternalStore(
    subscribeToConnectivity,
    getOnlineSnapshot,
    getAssumedOnlineSnapshot,
  );
}
