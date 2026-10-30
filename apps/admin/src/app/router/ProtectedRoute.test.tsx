/**
 * Tests of the session guard.
 *
 * The guard makes exactly one decision — is there a session? — and the two
 * branches have to be distinguishable, because a silent "no session" would
 * hide the login page behind a blank shell.
 */

import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  createMockSession,
  renderWithRouter,
} from '../../test/mocks/app-router.mock.js';
import { ProtectedRoute } from './ProtectedRoute.js';

describe('ProtectedRoute', () => {
  it('renders the children when the user has a session', () => {
    renderWithRouter(
      <ProtectedRoute>
        <p>protected content</p>
      </ProtectedRoute>,
      { session: createMockSession({ isAuthenticated: true }) },
    );

    expect(screen.getByText('protected content')).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Bejelentkezés' }),
    ).not.toBeInTheDocument();
  });

  it('renders the login page when there is no session', () => {
    renderWithRouter(
      <ProtectedRoute>
        <p>protected content</p>
      </ProtectedRoute>,
      { session: createMockSession({ isAuthenticated: false }) },
    );

    expect(
      screen.getByRole('heading', { name: 'Bejelentkezés' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('protected content')).not.toBeInTheDocument();
  });
});
