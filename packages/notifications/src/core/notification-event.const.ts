import type {
  NotificationEventDefaults,
  NotificationEventKind,
} from './notification.interface.js';

/**
 * Catalogued event kinds, as a runtime list.
 *
 * Runtime mirror of the {@link NotificationEventKind} union; iteration and tests
 * need the values, not just the type.
 */
export const NOTIFICATION_EVENT_KINDS: readonly NotificationEventKind[] = [
  'api.failure',
  'api.schema-drift',
  'mutation.failure',
  'form.success',
  'runtime.error',
  'router.navigation',
];

/**
 * How a catalogued event is classified by default.
 *
 * Contains **no message text** (AIS-79 decision D15): this package knows nothing
 * about localisation, so the Hungarian sentence is supplied by the emitter that
 * raises the event. `router.navigation` and `api.schema-drift` are log-only —
 * they are noise on screen but valuable in the log panel.
 */
export const NOTIFICATION_EVENT_DEFAULTS: Readonly<
  Record<NotificationEventKind, NotificationEventDefaults>
> = {
  'api.failure': { level: 'error', source: 'api', toast: true },
  'api.schema-drift': { level: 'system', source: 'api', toast: false },
  'mutation.failure': { level: 'error', source: 'api', toast: true },
  'form.success': { level: 'success', source: 'form', toast: true },
  'runtime.error': { level: 'error', source: 'runtime', toast: true },
  'router.navigation': { level: 'system', source: 'router', toast: false },
};
