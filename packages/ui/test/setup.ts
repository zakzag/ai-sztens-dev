/**
 * Global test setup for the UI kit.
 *
 * - installs the jest-dom matchers (`toBeInTheDocument`, `toHaveAttribute`, …),
 * - unmounts every rendered tree after each test so a leaked component cannot
 *   make the next test pass by accident.
 *
 * Mocks and fixtures belong in `test/mocks/`, never here.
 *
 * The a11y gate does not use a custom matcher: `vitest-axe` 0.1 has no working
 * type augmentation for Vitest 3, so `test/form-a11y.test.tsx` asserts on
 * `results.violations` directly (see `expectNoViolations`).
 */

import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => {
  cleanup();
});
