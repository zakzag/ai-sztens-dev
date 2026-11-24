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
