import type { HttpEvent } from '@callback/api-client';
import {
  NOTIFICATION_EVENT_DEFAULTS,
  type NotificationEventKind,
} from '@callback/notifications';
import { toErrorMessage } from '../../lib/error-message.js';
import { toApiError, toErrorSurface } from '../../lib/error-surface.logic.js';
import {
  HTTP_EVENT_SEPARATOR,
  HTTP_EVENT_SOURCE,
  HTTP_EVENT_SUCCESS_LEVEL,
  HTTP_EVENT_TIMING_SUFFIX,
  HTTP_NETWORK_ERROR_LABEL,
  MUTATION_KEY_DETAIL_LABEL,
  NOTIFICATION_DETAIL_SEPARATOR,
  NOTIFICATION_KEY_LENGTH_LIMIT,
  NOTIFICATION_KEY_UNSERIALIZABLE,
  QUERY_KEY_DETAIL_LABEL,
  SUCCESS_MESSAGE_META_KEY,
} from './notification.const.js';
import type {
  MutationContext,
  MutationSuccessContext,
  NotificationEntryDraft,
  QueryFailureContext,
  SerialisedKey,
} from './notification.interface.js';

/**
 * The single mapping from "something happened" to "one log entry" (AIS-84).
 *
 * Pure by construction: no React, no I/O, no `import.meta`. Every rule that
 * decides *whether* a failure reaches the user and *whether* it becomes a toast
 * lives here, so the capture wiring stays a three-line adapter and the whole
 * policy is testable with plain values.
 *
 * The visibility rule reuses the existing classifier
 * ({@link toErrorSurface}): `silent` → nothing, `field`/`banner` → log only (the
 * form or the banner is already speaking), `page` → log **and** toast. One
 * failure therefore produces exactly one visible surface.
 */

/**
 * @param value - anything that may be an object.
 * @returns `true` when the value can be indexed as a record.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * @param value - candidate key segment.
 * @returns the serialised key, or `null` when there is nothing to show.
 */
function toSerialisedKey(key: readonly unknown[] | undefined): SerialisedKey {
  if (key === undefined || key.length === 0) {
    return null;
  }

  let serialised: string;

  try {
    serialised = JSON.stringify(key);
  } catch {
    // A circular key is a programming error, not a reason to lose the entry.
    return NOTIFICATION_KEY_UNSERIALIZABLE;
  }

  if (serialised === undefined) {
    return null;
  }

  return serialised.length > NOTIFICATION_KEY_LENGTH_LIMIT
    ? `${serialised.slice(0, NOTIFICATION_KEY_LENGTH_LIMIT)}…`
    : serialised;
}

/**
 * @param label - detail label the key is filed under.
 * @param key - query or mutation key, when the caller declared one.
 * @returns `"label=[…]"`, or `null` for an absent key.
 */
function toKeyDetail(
  label: string,
  key: readonly unknown[] | undefined,
): string | null {
  const serialised = toSerialisedKey(key);

  return serialised === null ? null : `${label}=${serialised}`;
}

/**
 * Builds the technical context of a failure: status, code, correlation id and
 * the resource key. Never the request or response body — `ApiError` does not
 * carry one, and the store redacts records anyway (AIS-79 D9).
 *
 * @param error - anything a query or mutation rejected with.
 * @param keyLabel - detail label of the resource key.
 * @param key - query or mutation key, when declared.
 * @returns the joined detail string, or `null` when nothing is known.
 */
export function toErrorDetail(
  error: unknown,
  keyLabel: string,
  key: readonly unknown[] | undefined,
): string | null {
  const parts: string[] = [];
  const apiError = toApiError(error);

  if (apiError === null) {
    parts.push(`error=${error instanceof Error ? error.name : typeof error}`);
  } else {
    parts.push(`status=${apiError.status === null ? 'null' : apiError.status}`);

    if (typeof apiError.code === 'string' && apiError.code.length > 0) {
      parts.push(`code=${apiError.code}`);
    }

    if (typeof apiError.requestId === 'string' && apiError.requestId.length > 0) {
      parts.push(`requestId=${apiError.requestId}`);
    }
  }

  const keyDetail = toKeyDetail(keyLabel, key);

  if (keyDetail !== null) {
    parts.push(keyDetail);
  }

  return parts.length === 0 ? null : parts.join(NOTIFICATION_DETAIL_SEPARATOR);
}

/**
 * Maps one finished HTTP attempt of the transport.
 *
 * **Log only, never a toast** (AIS-84 decision D3): a transport event carries a
 * status but no error code, so it can neither pick the accurate copy nor respect
 * the silence rules — the query/mutation caches own the toast. What the panel
 * gains is visibility: every request, successful or not, leaves a trace.
 *
 * @param event - the transport's `HttpEvent`.
 * @returns the entry to emit (the caller must not ask for a toast).
 */
export function toHttpEntry(event: HttpEvent): NotificationEntryDraft {
  const outcome =
    event.status === null ? HTTP_NETWORK_ERROR_LABEL : String(event.status);

  const message = `${event.method} ${event.path}${HTTP_EVENT_SEPARATOR}${outcome}`;
  const detail = `${event.durationMs}${HTTP_EVENT_TIMING_SUFFIX}`;

  if (event.outcome === 'success') {
    return {
      level: HTTP_EVENT_SUCCESS_LEVEL,
      source: HTTP_EVENT_SOURCE,
      message,
      detail,
      toast: false,
    };
  }

  const defaults = NOTIFICATION_EVENT_DEFAULTS['api.failure'];

  return {
    level: defaults.level,
    source: defaults.source,
    message,
    detail,
    toast: false,
  };
}

/**
 * @param error - whatever a query rejected with.
 * @param context - the failing query's key.
 * @returns the entry, or `null` when the failure must stay invisible.
 */
export function toQueryErrorEntry(
  error: unknown,
  context: QueryFailureContext,
): NotificationEntryDraft | null {
  return toFailureEntry(error, 'api.failure', QUERY_KEY_DETAIL_LABEL, context.queryKey);
}

/**
 * @param error - whatever a mutation rejected with.
 * @param context - the mutation's key, when declared.
 * @returns the entry, or `null` when the failure must stay invisible.
 */
export function toMutationErrorEntry(
  error: unknown,
  context: MutationContext,
): NotificationEntryDraft | null {
  return toFailureEntry(
    error,
    'mutation.failure',
    MUTATION_KEY_DETAIL_LABEL,
    context.mutationKey,
  );
}

/**
 * @param context - the mutation's `meta` and key.
 * @returns the success entry, or `null` when the caller announced nothing.
 */
export function toMutationSuccessEntry(
  context: MutationSuccessContext,
): NotificationEntryDraft | null {
  const message = readSuccessMessage(context.meta);

  if (message === null) {
    return null;
  }

  const defaults = NOTIFICATION_EVENT_DEFAULTS['form.success'];

  return {
    level: defaults.level,
    source: defaults.source,
    message,
    detail: toKeyDetail(MUTATION_KEY_DETAIL_LABEL, context.mutationKey) ?? undefined,
    toast: defaults.toast,
  };
}

/**
 * Reads `meta.successMessage` without trusting the object.
 *
 * `meta` is `unknown` on purpose: TanStack Query never validates it, so a
 * non-string or an empty string must mean “nothing to announce” instead of
 * producing a toast with `undefined` in it.
 *
 * @param meta - the mutation's `meta`.
 * @returns the trimmed copy, or `null` when there is none.
 */
export function readSuccessMessage(meta: unknown): string | null {
  if (!isRecord(meta)) {
    return null;
  }

  const value = meta[SUCCESS_MESSAGE_META_KEY];

  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();

  return trimmed.length === 0 ? null : trimmed;
}

/**
 * Shared failure mapping of the query and the mutation cache.
 *
 * @param error - anything that was thrown.
 * @param kind - catalogued event kind the entry is filed under.
 * @param keyLabel - detail label of the resource key.
 * @param key - query or mutation key, when declared.
 * @returns the entry, or `null` for a cancellation or an already-surfaced failure.
 */
function toFailureEntry(
  error: unknown,
  kind: NotificationEventKind,
  keyLabel: string,
  key: readonly unknown[] | undefined,
): NotificationEntryDraft | null {
  const surface = toErrorSurface(error);

  if (surface === 'silent') {
    return null;
  }

  const defaults = NOTIFICATION_EVENT_DEFAULTS[kind];

  return {
    level: defaults.level,
    source: defaults.source,
    message: toErrorMessage(error),
    detail: toErrorDetail(error, keyLabel, key) ?? undefined,
    toast: surface === 'page',
  };
}
