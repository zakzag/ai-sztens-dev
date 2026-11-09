import type { HttpEvent } from '@callback/api-client';
import {
  NOTIFICATION_EVENT_DEFAULTS,
  type NotificationDetailField,
  type NotificationEventKind,
} from '@callback/notifications';
import { toErrorMessage } from '../../lib/error-message.js';
import { toApiError, toErrorSurface } from '../../lib/error-surface.logic.js';
import type { ErrorSurface } from '../../lib/error-surface.interface.js';
import type { AppRenderErrorReport } from '../error/app-error-boundary.interface.js';
import {
  DETAIL_LABEL_BODY_PREVIEW,
  DETAIL_LABEL_CODE,
  DETAIL_LABEL_COMPONENT_STACK,
  DETAIL_LABEL_DURATION,
  DETAIL_LABEL_ERROR_NAME,
  DETAIL_LABEL_ISSUES,
  DETAIL_LABEL_MESSAGE,
  DETAIL_LABEL_METHOD,
  DETAIL_LABEL_OPERATION,
  DETAIL_LABEL_OUTCOME,
  DETAIL_LABEL_PATH,
  DETAIL_LABEL_QUERY,
  DETAIL_LABEL_REQUEST_ID,
  DETAIL_LABEL_RESPONSE_TIMESTAMP,
  DETAIL_LABEL_SOURCE,
  DETAIL_LABEL_STACK,
  DETAIL_LABEL_STATUS,
  DETAIL_LABEL_SURFACE,
  DETAIL_LABEL_TOTAL_ITEMS,
  DETAIL_LABEL_URL,
  HTTP_EVENT_SEPARATOR,
  HTTP_EVENT_SOURCE,
  HTTP_EVENT_SUCCESS_LEVEL,
  HTTP_EVENT_TIMING_SUFFIX,
  HTTP_NETWORK_ERROR_LABEL,
  MUTATION_KEY_DETAIL_LABEL,
  NOTIFICATION_DETAIL_SEPARATOR,
  NOTIFICATION_KEY_LENGTH_LIMIT,
  NOTIFICATION_KEY_UNSERIALIZABLE,
  OPERATION_META_KEY,
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
 * The visibility rule reuses the existing classifier ({@link toErrorSurface})
 * and is **total** over its four surfaces (AIS-136 `D1`):
 *
 * | surface  | log entry | toast | who else speaks                       |
 * | -------- | --------- | ----- | ------------------------------------- |
 * | `silent` | no        | no    | — (a cancellation is not a failure)   |
 * | `field`  | yes       | **no**| the input + the form residue `Alert`  |
 * | `banner` | yes       | yes   | `AppErrorBanner` (the condition)      |
 * | `page`   | yes       | yes   | the page's own error region           |
 *
 * A field error deliberately stays off the toast: it must not steal the
 * announcement from the input that keeps focus and shows the message, while
 * every other tier is announced even when the user is looking elsewhere.
 * A `banner` failure is toasted even though the banner also shows it, because
 * the banner expresses the persistent **condition** and the toast marks the
 * **moment** of the failure (D2).
 *
 * Since AIS-152 every entry also carries the **structured** half: `details`, the
 * key/value rows of the expandable row. `detail` stays the one-line summary the
 * toast and the collapsed row show (AIS-151 `D-A`), so the two never compete.
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
 * Builds one detail row, or `null` when there is nothing to show.
 *
 * “Nothing” is an absent value **and** an all-whitespace one: an empty row would
 * render as a label with no value in the expandable panel, which looks like a
 * bug to the person reading the log.
 *
 * @param label - row label, always a `DETAIL_LABEL_*` constant.
 * @param value - raw value; truncated and redacted later by the store.
 * @param mono - `true` to ask for a monospace rendering.
 * @returns the row, or `null` when the value is empty.
 */
function toDetailField(
  label: string,
  value: string | null | undefined,
  mono = false,
): NotificationDetailField | null {
  if (value === null || value === undefined) {
    return null;
  }

  const trimmed = value.trim();

  if (trimmed.length === 0) {
    return null;
  }

  return mono ? { label, value: trimmed, mono: true } : { label, value: trimmed };
}

/**
 * Drops the rows that had no value.
 *
 * @param fields - candidate rows, in the order they must be rendered.
 * @returns only the rows that carry a value, in the same order.
 */
function compactDetailFields(
  fields: readonly (NotificationDetailField | null)[],
): readonly NotificationDetailField[] {
  return fields.filter(
    (field): field is NotificationDetailField => field !== null,
  );
}

/**
 * @param status - HTTP status of an attempt.
 * @returns the status as text, or the network-failure label when there was none.
 */
function toStatusText(status: number | null): string {
  return status === null ? HTTP_NETWORK_ERROR_LABEL : String(status);
}

/**
 * @param operation - domain operation of the entry, or `null` when unknown.
 * @returns the operation row, or `null` for an unknown operation.
 */
function toOperationField(
  operation: string | null,
): NotificationDetailField | null {
  return toDetailField(DETAIL_LABEL_OPERATION, operation);
}

/**
 * @param fields - the rows built for an entry.
 * @returns the rows, or `undefined` when the entry has none (AIS-151 `D-E`).
 */
function toOptionalDetails(
  fields: readonly NotificationDetailField[],
): readonly NotificationDetailField[] | undefined {
  return fields.length === 0 ? undefined : fields;
}

/**
 * Structured rows of one finished HTTP attempt (AIS-152).
 *
 * Order is the reading order of a request: what was called, how it was answered,
 * how it can be traced, what was sent, and where from. Every row whose value is
 * unknown is **skipped**, so the panel never shows an empty label.
 *
 * @param event - the transport's enriched `HttpEvent`.
 * @param operation - domain operation of the attempt, or `null` when unknown.
 * @returns the rows, in insertion order (the store keeps that order).
 */
export function toHttpDetails(
  event: HttpEvent,
  operation: string | null,
): readonly NotificationDetailField[] {
  return compactDetailFields([
    toDetailField(DETAIL_LABEL_METHOD, event.method),
    toDetailField(DETAIL_LABEL_PATH, event.path, true),
    toDetailField(DETAIL_LABEL_QUERY, event.query, true),
    toDetailField(DETAIL_LABEL_STATUS, toStatusText(event.status)),
    toDetailField(
      DETAIL_LABEL_DURATION,
      `${event.durationMs}${HTTP_EVENT_TIMING_SUFFIX}`,
    ),
    toDetailField(DETAIL_LABEL_OUTCOME, event.outcome),
    toDetailField(DETAIL_LABEL_REQUEST_ID, event.requestId, true),
    toDetailField(
      DETAIL_LABEL_RESPONSE_TIMESTAMP,
      event.responseMeta?.timestamp,
      true,
    ),
    toDetailField(
      DETAIL_LABEL_TOTAL_ITEMS,
      event.responseMeta?.totalItems === null ||
        event.responseMeta?.totalItems === undefined
        ? null
        : String(event.responseMeta.totalItems),
    ),
    toDetailField(DETAIL_LABEL_BODY_PREVIEW, event.bodyPreview, true),
    toDetailField(DETAIL_LABEL_OPERATION, operation),
    toDetailField(DETAIL_LABEL_SOURCE, HTTP_EVENT_SOURCE),
  ]);
}

/**
 * Structured rows of a failed query or mutation (AIS-152).
 *
 * Every field issue becomes **its own row** (`path` label, message value), so a
 * validation failure with three bad inputs reads as three lines instead of one
 * glued sentence — that is the whole point of the expandable row.
 *
 * @param error - anything a query or mutation rejected with.
 * @param keyLabel - row label of the resource key (`queryKey`/`mutationKey`).
 * @param key - query or mutation key, when declared.
 * @param surface - the tier the classifier picked, recorded for the reader.
 * @returns the rows; a non-`ApiError` yields a single `error` row.
 */
export function toFailureDetails(
  error: unknown,
  keyLabel: string,
  key: readonly unknown[] | undefined,
  surface: ErrorSurface,
): readonly NotificationDetailField[] {
  const apiError = toApiError(error);
  const keyValue = toSerialisedKey(key);

  if (apiError === null) {
    return compactDetailFields([
      toDetailField(
        DETAIL_LABEL_ERROR_NAME,
        error instanceof Error ? error.name : typeof error,
      ),
      toDetailField(keyLabel, keyValue, true),
      toDetailField(DETAIL_LABEL_SURFACE, surface),
    ]);
  }

  return compactDetailFields([
    toDetailField(DETAIL_LABEL_CODE, apiError.code),
    toDetailField(DETAIL_LABEL_STATUS, toStatusText(apiError.status)),
    toDetailField(DETAIL_LABEL_REQUEST_ID, apiError.requestId, true),
    toDetailField(keyLabel, keyValue, true),
    ...apiError.issues.map((issue) =>
      toDetailField(
        issue.path.length === 0 ? DETAIL_LABEL_ISSUES : issue.path,
        issue.message,
      ),
    ),
    toDetailField(DETAIL_LABEL_URL, apiError.url, true),
    toDetailField(DETAIL_LABEL_SURFACE, surface),
    toDetailField(DETAIL_LABEL_ERROR_NAME, apiError.name),
  ]);
}

/**
 * Structured rows of a render crash (AIS-152).
 *
 * The stack is recorded only when the caller allows it (`import.meta.env.DEV`),
 * because a production log file is read by people who cannot act on it and it is
 * the largest value the entry can carry.
 *
 * @param report - the boundary's report: the thrown value and React's trace.
 * @param includeStack - whether the stack may be recorded.
 * @returns the rows; always at least the error name.
 */
export function toRuntimeDetails(
  report: AppRenderErrorReport,
  includeStack: boolean,
): readonly NotificationDetailField[] {
  const { error, componentStack } = report;
  const isError = error instanceof Error;

  return compactDetailFields([
    toDetailField(
      DETAIL_LABEL_ERROR_NAME,
      isError ? error.name : typeof error,
    ),
    toDetailField(DETAIL_LABEL_MESSAGE, isError ? error.message : null),
    toDetailField(DETAIL_LABEL_STACK, isError && includeStack ? error.stack : null, true),
    toDetailField(DETAIL_LABEL_COMPONENT_STACK, componentStack, true),
  ]);
}

/**
 * Builds the technical context of a failure as one line: status, code,
 * correlation id and the resource key. Never the request or response body —
 * `ApiError` does not carry one, and the store redacts records anyway (AIS-79 D9).
 *
 * Kept **byte-identical** after AIS-152 (decision `D-F`): the toast and the
 * collapsed row show this string, and the structured rows are an addition.
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
 * @param operation - domain operation of the attempt, or `null`.
 * @returns the entry to emit (the caller must not ask for a toast).
 */
export function toHttpEntry(
  event: HttpEvent,
  operation: string | null,
): NotificationEntryDraft {
  const outcome =
    event.status === null ? HTTP_NETWORK_ERROR_LABEL : String(event.status);

  const message = `${event.method} ${event.path}${HTTP_EVENT_SEPARATOR}${outcome}`;
  const detail = `${event.durationMs}${HTTP_EVENT_TIMING_SUFFIX}`;
  const details = toHttpDetails(event, operation);

  if (event.outcome === 'success') {
    return {
      level: HTTP_EVENT_SUCCESS_LEVEL,
      source: HTTP_EVENT_SOURCE,
      message,
      detail,
      details,
      toast: false,
    };
  }

  const defaults = NOTIFICATION_EVENT_DEFAULTS['api.failure'];

  return {
    level: defaults.level,
    source: defaults.source,
    message,
    detail,
    details,
    toast: false,
  };
}

/**
 * @param error - whatever a query rejected with.
 * @param context - the failing query's key and operation.
 * @returns the entry, or `null` when the failure must stay invisible.
 */
export function toQueryErrorEntry(
  error: unknown,
  context: QueryFailureContext,
): NotificationEntryDraft | null {
  return toFailureEntry(
    error,
    'api.failure',
    QUERY_KEY_DETAIL_LABEL,
    context.queryKey,
    context.operation,
  );
}

/**
 * @param error - whatever a mutation rejected with.
 * @param context - the mutation's key and operation.
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
    context.operation,
  );
}

/**
 * @param context - the mutation's `meta`, key and operation.
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
    details: toOptionalDetails(
      compactDetailFields([
        toOperationField(context.operation),
        toDetailField(
          MUTATION_KEY_DETAIL_LABEL,
          toSerialisedKey(context.mutationKey),
          true,
        ),
      ]),
    ),
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
 * Reads `meta.operation` with the same defensiveness as the success copy.
 *
 * The operation labels the entry (AIS-152 decision `D-E`); a query/mutation `meta`
 * is `unknown`, so anything that is not a non-empty string means “unknown
 * operation” instead of putting `undefined` into the log.
 *
 * @param meta - the query's or mutation's `meta`.
 * @returns the trimmed operation, or `null` when there is none.
 */
export function readOperationMeta(meta: unknown): string | null {
  if (!isRecord(meta)) {
    return null;
  }

  const value = meta[OPERATION_META_KEY];

  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();

  return trimmed.length === 0 ? null : trimmed;
}

/**
 * The toast half of the failure matrix (AIS-136 `D1`).
 *
 * Exhaustive on purpose: a new {@link ErrorSurface} member fails to compile
 * until somebody decides whether it is announced, instead of silently
 * inheriting one of the two answers.
 *
 * `silent` never reaches this function — {@link toFailureEntry} returns early —
 * but it is listed so the switch stays total.
 *
 * @param surface - the tier the classifier picked for the failure.
 * @returns `true` when the failure must also appear as a toast.
 */
export function toFailureToast(surface: ErrorSurface): boolean {
  switch (surface) {
    case 'silent':
    case 'field':
      return false;
    case 'banner':
    case 'page':
      return true;
  }
}

/**
 * Shared failure mapping of the query and the mutation cache.
 *
 * @param error - anything that was thrown.
 * @param kind - catalogued event kind the entry is filed under.
 * @param keyLabel - detail label of the resource key.
 * @param key - query or mutation key, when declared.
 * @param operation - domain operation of the failing call, or `null`.
 * @returns the entry, or `null` for a cancellation (the only invisible failure).
 */
function toFailureEntry(
  error: unknown,
  kind: NotificationEventKind,
  keyLabel: string,
  key: readonly unknown[] | undefined,
  operation: string | null,
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
    details: toOptionalDetails(
      compactDetailFields([
        toOperationField(operation),
        ...toFailureDetails(error, keyLabel, key, surface),
      ]),
    ),
    toast: toFailureToast(surface),
  };
}
