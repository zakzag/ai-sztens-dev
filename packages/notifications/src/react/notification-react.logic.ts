import { clampDrawerWidth } from '@callback/ui';
import type { LogDrawerSizeRange, LogLevelFilter, ToastItem } from '@callback/ui';
import type {
  NotificationEntry,
  NotificationLevel,
} from '../core/notification.interface.js';
import type { NotificationWriteCancel, NotificationWriteScheduler } from '../core/notification.storage.interface.js';
import {
  DEFAULT_LOCALE,
  TOAST_TTL_MS_BY_LEVEL,
  UNKNOWN_ERROR_NAME,
} from './notification-react.const.js';
import type { AnimationFrameScope, ToastTtl } from './notification-react.interface.js';

/**
 * How long a toast of the given level may stay on screen.
 *
 * @param level - severity of the toast.
 * @returns milliseconds, or `null` when the level is sticky.
 */
export function resolveToastTtl(level: NotificationLevel): ToastTtl {
  return TOAST_TTL_MS_BY_LEVEL[level];
}

/**
 * Projects the store snapshot onto the presentational toast list.
 *
 * Order is the **store's** order (`toasts` is newest first), so the newest card is
 * always index `0`; ids whose entry already left the ring buffer are dropped
 * instead of rendering a hole (AIS-83 decision D4).
 *
 * @param entries - newest-first entries of the snapshot.
 * @param toastIds - ids the snapshot currently wants on screen, newest first.
 * @returns the toast items, newest first; an empty list when nothing is shown.
 */
export function toToastItems(
  entries: readonly NotificationEntry[],
  toastIds: readonly string[],
): readonly ToastItem[] {
  if (toastIds.length === 0) {
    return [];
  }

  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  const items: ToastItem[] = [];

  for (const id of toastIds) {
    const entry = byId.get(id);

    if (entry === undefined) {
      continue;
    }

    items.push({
      id: entry.id,
      level: entry.level,
      message: entry.message,
      detail: entry.detail,
      repeatCount: entry.repeatCount,
    });
  }

  return items;
}

/**
 * Applies the drawer's level filter.
 *
 * @param entries - newest-first entries.
 * @param filter - `all` or one level.
 * @returns the same reference when the filter is `all`, so the window memo stays
 *   cheap and referentially stable.
 */
export function filterEntries(
  entries: readonly NotificationEntry[],
  filter: LogLevelFilter,
): readonly NotificationEntry[] {
  if (filter === 'all') {
    return entries;
  }

  return entries.filter((entry) => entry.level === filter);
}

/**
 * Cuts the paging window out of the filtered list.
 *
 * @param entries - newest-first filtered entries.
 * @param visibleCount - how many rows the window shows.
 * @returns the same reference when the window already covers everything.
 */
export function sliceWindow(
  entries: readonly NotificationEntry[],
  visibleCount: number,
): readonly NotificationEntry[] {
  if (visibleCount >= entries.length) {
    return entries;
  }

  return entries.slice(0, Math.max(visibleCount, 0));
}

/**
 * Whether older rows remain beyond the window.
 *
 * @param entries - newest-first filtered entries.
 * @param visibleCount - how many rows the window shows.
 * @returns `true` when "Korábbiak betöltése" has work to do.
 */
export function hasMoreEntries(
  entries: readonly NotificationEntry[],
  visibleCount: number,
): boolean {
  return entries.length > visibleCount;
}

/**
 * Counts the entries the user has not seen yet.
 *
 * @param entries - newest-first entries.
 * @returns how many carry `read: false`; drives the collapsed tab's badge.
 */
export function countUnseen(entries: readonly NotificationEntry[]): number {
  let unseen = 0;

  for (const entry of entries) {
    if (!entry.read) {
      unseen += 1;
    }
  }

  return unseen;
}

/**
 * Builds the `detail` record of a captured runtime error.
 *
 * Only `name` and `message` are kept by default; the stack is attached when the
 * app explicitly allows it (`includeDetails`, base plan §4.7), because a stack
 * can carry request payloads.
 *
 * @param error - the thrown value, of any type.
 * @param includeDetails - whether the stack may be recorded.
 * @returns a redactable record; never `undefined`, so the log always says why.
 */
export function toRuntimeDetail(
  error: unknown,
  includeDetails: boolean,
): Readonly<Record<string, unknown>> {
  if (error instanceof Error) {
    const detail: Record<string, unknown> = {
      name: error.name,
      message: error.message,
    };

    if (includeDetails && typeof error.stack === 'string') {
      detail.stack = error.stack;
    }

    return detail;
  }

  return {
    name: UNKNOWN_ERROR_NAME,
    message: typeof error === 'string' ? error : String(error),
  };
}

/**
 * Builds the write coalescer the storage adapter should use in a browser.
 *
 * One flush per animation frame; falls back to a microtask when the scope has no
 * `requestAnimationFrame` (jsdom without `pretendToBeVisual`, plain Node), so the
 * adapter keeps its "at most one write per tick" guarantee everywhere (AIS-83 D2).
 *
 * @param scope - an object with rAF/cancelAnimationFrame, usually `window`.
 * @returns a scheduler compatible with `NotificationWriteScheduler`.
 */
export function createRafScheduler(
  scope: AnimationFrameScope | null = null,
): NotificationWriteScheduler {
  const requestFrame = scope?.requestAnimationFrame;
  const cancelFrame = scope?.cancelAnimationFrame;

  if (typeof requestFrame !== 'function' || typeof cancelFrame !== 'function') {
    return (flush: () => void): NotificationWriteCancel => {
      let cancelled = false;

      void Promise.resolve().then(() => {
        if (!cancelled) {
          flush();
        }
      });

      return () => {
        cancelled = true;
      };
    };
  }

  return (flush: () => void): NotificationWriteCancel => {
    const handle = requestFrame.call(scope, flush);

    return () => cancelFrame.call(scope, handle);
  };
}

/**
 * Default `formatTimestamp` of the log rows.
 *
 * Injected as a prop by `NotificationProvider`, because `packages/ui` refuses to
 * own localisation and this package must not import an app helper (AIS-83 D13).
 *
 * @param epochMs - creation time of the entry.
 * @returns `HH:MM:SS` in the package's default locale.
 */
export function formatDefaultTimestamp(epochMs: number): string {
  return new Date(epochMs).toLocaleTimeString(DEFAULT_LOCALE, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/**
 * Turns a stored panel width into a usable number.
 *
 * Three outcomes, one rule each (AIS-150):
 *
 * - nothing stored (`null` or an empty string) is a normal first visit → `initial`;
 * - a payload that is not a finite number (`'abc'`, `'Infinity'`) is corrupt
 *   data, not a width → `initial`;
 * - a number outside the range is a **stale** preference written by an older
 *   build → clamped, because losing the user's intent entirely is worse than
 *   honouring it at the nearest bound.
 *
 * @param raw - the raw storage payload.
 * @param range - bounds and fallback width.
 * @returns a finite width inside the range.
 */
export function parseStoredDrawerWidth(
  raw: string | null,
  range: LogDrawerSizeRange,
): number {
  if (raw === null || raw.trim() === '') {
    return range.initial;
  }

  return clampDrawerWidth(Number(raw.trim()), range);
}

/**
 * Serialises a panel width for storage.
 *
 * Kept next to the parser so a round-trip test covers both halves of the format;
 * the value is written as a plain decimal string, which `Number()` reads back
 * without locale or unit noise.
 *
 * @param width - width in CSS pixels.
 * @returns the payload to store.
 */
export function serializeDrawerWidth(width: number): string {
  return String(width);
}
