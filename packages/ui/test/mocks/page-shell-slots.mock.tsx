/**
 * Slot fixtures of the {@link PageShell} tests.
 *
 * The two slots are `ReactNode`, so a page normally injects a router `Link`
 * here. The package must stay router-free, so the tests inject plain elements
 * with the same shape — a real `<a href>` and a real `<button>` — which keeps
 * the assertions about *placement* intact without pulling `react-router` into
 * `packages/ui`.
 */

/** Accessible name of the back slot's link. */
export const PAGE_SHELL_BACK_LABEL = 'Vissza a listához';

/** Accessible name of the actions slot's button. */
export const PAGE_SHELL_ACTION_LABEL = 'Új elem';

/** Test id of the back slot's root element. */
export const PAGE_SHELL_BACK_TEST_ID = 'page-shell-back';

/** Test id of the actions slot's root element. */
export const PAGE_SHELL_ACTION_TEST_ID = 'page-shell-action';

/**
 * Stand-in for the `Link` a page passes in `back`.
 *
 * @returns the back link markup.
 */
export function PageShellBackSlot() {
  return (
    <a
      href="/items"
      data-testid={PAGE_SHELL_BACK_TEST_ID}
      className="text-sm text-text-secondary hover:text-text-primary"
    >
      {PAGE_SHELL_BACK_LABEL}
    </a>
  );
}

/**
 * Stand-in for the primary action a page passes in `actions`.
 *
 * @returns the action button markup.
 */
export function PageShellActionsSlot() {
  return (
    <button type="button" data-testid={PAGE_SHELL_ACTION_TEST_ID}>
      {PAGE_SHELL_ACTION_LABEL}
    </button>
  );
}
