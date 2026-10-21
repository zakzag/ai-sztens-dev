/**
 * Global test setup for the UI kit.
 *
 * - installs the jest-dom matchers (`toBeInTheDocument`, `toHaveAttribute`, …),
 * - unmounts every rendered tree after each test so a leaked component cannot
 *   make the next test pass by accident.
 *
 * Mocks and fixtures belong in `test/mocks/`, never here.
 */

import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => {
  cleanup();
});
