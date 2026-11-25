/**
 * Errors of the customers wizard store (AIS-19).
 *
 * A store read outside its provider is a wiring mistake, not user input, so it
 * throws a named error instead of falling back to a fresh store: a silent
 * fallback would give the page a draft that no longer belongs to anyone.
 */

/** Thrown when `useCustomersWizardStore` is called outside its provider. */
export class MissingCustomersWizardStoreError extends Error {
  /**
   * @param providerName - the provider the caller forgot to mount.
   */
  constructor(providerName: string) {
    super(
      `The ${providerName} is missing: wrap the customers wizard in it before reading the store.`,
    );
    this.name = 'MissingCustomersWizardStoreError';
  }
}

/**
 * Thrown when the draft is too incomplete to build a create body (AIS-182).
 *
 * Unreachable through the UI — the review step renders its submit only when
 * every step's inputs are valid — and deliberately loud if it happens anyway: a
 * half-filled body would be rejected by the server with a `422` the form could
 * not address, instead of pointing at the step that owns the missing value.
 */
export class CustomersWizardIncompleteError extends Error {
  /** The fields that are missing or invalid. */
  readonly fieldNames: readonly string[];

  /**
   * @param fieldNames - the fields that are missing or invalid.
   */
  constructor(fieldNames: readonly string[]) {
    super(
      `The create wizard draft is incomplete: ${fieldNames.join(', ') || 'unknown field'}`,
    );
    this.name = 'CustomersWizardIncompleteError';
    this.fieldNames = fieldNames;
  }
}
