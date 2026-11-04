import type { HttpEventListener } from './http-events.interface.js';

/**
 * The single HTTP event sink of the application (AIS-84).
 *
 * Why a registry instead of a direct import: the notification store lives in
 * `app/notifications`, and `services` may not depend on `app/`
 * (`no-service-to-higher-layer`). The transport therefore asks this module for
 * "whoever is listening" at call time, and the app layer registers itself at
 * boot (`main.tsx`) — the dependency still points downwards.
 *
 * A module-level variable is acceptable here precisely because it holds **no
 * data**: it is a single function reference, replaced once per boot, never
 * state that a render depends on.
 */
let listener: HttpEventListener | null = null;

/**
 * Registers (or clears) the listener the transport reports to.
 *
 * @param next - the listener to install, or `null` to detach the current one.
 */
export function setHttpEventListener(next: HttpEventListener | null): void {
  listener = next;
}

/**
 * @returns the installed listener, or `null` when nobody listens.
 */
export function getHttpEventListener(): HttpEventListener | null {
  return listener;
}
