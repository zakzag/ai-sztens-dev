import type { EmitNotificationInput } from '@callback/notifications';

/**
 * Types of the admin notification capture (AIS-84).
 *
 * `NotificationEntryDraft` is the store's own input shape, aliased so the
 * mapping functions read as "what will be emitted" instead of repeating the
 * package type in every signature.
 */
export type NotificationEntryDraft = EmitNotificationInput;

/**
 * Context of a query failure.
 *
 * The key is what makes a log line useful: the message says *what* went wrong,
 * the key says *about which resource*.
 */
export interface QueryFailureContext {
  /** Query key of the failed query (`['api-keys', 'list', …]`). */
  readonly queryKey: readonly unknown[];
}

/** Context of a mutation failure or success. */
export interface MutationContext {
  /** Mutation key, when the caller declared one (`useApiMutation`). */
  readonly mutationKey?: readonly unknown[];
}

/** Context of a successful mutation. */
export interface MutationSuccessContext extends MutationContext {
  /** The mutation's `meta` object; read defensively, never trusted. */
  readonly meta: unknown;
}

/**
 * A query/mutation key serialised for the `detail` field.
 *
 * `null` when the caller declared no key, so an absent key never produces the
 * string `undefined`.
 */
export type SerialisedKey = string | null;
