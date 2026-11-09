import type { ToastItem } from '../../src/components/toast/toast.interface.js';

/**
 * Builds one `ToastItem` for the toast suites.
 *
 * Kept here (and not inside the test files) because the repo rule puts every
 * fixture under `test/mocks`.
 *
 * @param overrides - fields to replace on the default success toast.
 * @returns a complete `ToastItem`; the default id is `toast-1`.
 */
export function buildToastItem(overrides: Partial<ToastItem> = {}): ToastItem {
  return {
    id: 'toast-1',
    level: 'success',
    message: 'Sikeres mentés',
    ...overrides,
  };
}

/**
 * Builds a **newest-first** list of `count` toasts, `toast-1` being the newest.
 *
 * @param count - how many items the list should contain.
 * @returns the items with distinct ids and messages, so order is assertable.
 */
export function buildToastItems(count: number): readonly ToastItem[] {
  return Array.from({ length: count }, (_unused, index) =>
    buildToastItem({
      id: `toast-${index + 1}`,
      message: `Üzenet ${index + 1}`,
    }),
  );
}
