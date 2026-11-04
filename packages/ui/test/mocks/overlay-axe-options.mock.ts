/**
 * axe-core options for the overlay a11y gate.
 *
 * Overlays are rendered into `document.body` through a portal, outside any
 * landmark, so the `region` best-practice rule would fire on every case and say
 * nothing about the primitives. The gate therefore runs the WCAG A/AA rule sets
 * only, which is exactly what the ticket's DoD asks for: `aria-modal`,
 * `role="dialog"`, an accessible title.
 *
 * `color-contrast` stays disabled for the same reason as in
 * `axe-options.mock.ts`: jsdom has no layout engine and no canvas.
 */
export const OVERLAY_AXE_OPTIONS = {
  rules: {
    'color-contrast': { enabled: false },
  },
  runOnly: {
    type: 'tag' as const,
    values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'],
  },
};
