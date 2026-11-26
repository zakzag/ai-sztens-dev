/**
 * Shared axe-core options for the jsdom test environment.
 *
 * `color-contrast` is disabled because jsdom has no layout engine and no canvas
 * implementation, so the rule cannot compute real colours and only produces
 * noise. Every structural and ARIA rule stays enabled.
 */
export const AXE_JSDOM_OPTIONS = {
  rules: {
    'color-contrast': { enabled: false },
  },
} as const;
