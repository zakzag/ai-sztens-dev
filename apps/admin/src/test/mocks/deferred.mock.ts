/**
 * A promise the test resolves by hand.
 *
 * Needed wherever a UI state is defined by a request that is **still in flight**
 * (`isSubmitting`, the pending label, `aria-busy`). A resolved-on-the-spot mock
 * cannot show that state, and fake timers would make the assertion depend on tick
 * order instead of on the state machine.
 */

/** A promise plus the two functions that settle it. */
export interface Deferred<T> {
  /** Never resolves until {@link Deferred.resolve} is called. */
  readonly promise: Promise<T>;
  /** Settles {@link Deferred.promise} successfully. */
  readonly resolve: (value: T) => void;
  /** Rejects {@link Deferred.promise} with the given reason. */
  readonly reject: (reason: unknown) => void;
}

/**
 * @returns a {@link Deferred} that the caller settles when the test wants to.
 */
export function createDeferred<T>(): Deferred<T> {
  let resolveWith: (value: T) => void = () => undefined;
  let rejectWith: (reason: unknown) => void = () => undefined;

  const promise = new Promise<T>((resolve, reject) => {
    resolveWith = resolve;
    rejectWith = reject;
  });

  return { promise, resolve: resolveWith, reject: rejectWith };
}
