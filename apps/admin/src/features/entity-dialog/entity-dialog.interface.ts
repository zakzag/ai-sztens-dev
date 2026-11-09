/**
 * Types of the shared entity-overlay feature (AIS-155).
 *
 * The feature owns exactly one rule: **how an overlay closes**. Everything else
 * about a route-mounted dialog (the element, its title, its form) belongs to the
 * page that declares the route, so nothing here knows an entity.
 */

/** What a dialog route receives from {@link useEntityDialog}. */
export interface UseEntityDialogResult {
  /**
   * Navigates back to the list and drops the overlay URL from the history.
   *
   * Bound to every close path of the window — the header `X`, `Esc`, the
   * backdrop and the dismiss button — so a page cannot implement one of them
   * differently from the others.
   */
  readonly closeDialog: () => void;
}
