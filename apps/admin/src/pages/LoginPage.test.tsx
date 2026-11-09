/**
 * Behaviour of the placeholder login page (AIS-174).
 *
 * The mock point is the **`sessionStorage` double** from
 * `src/test/mocks/web-storage.mock.ts`, not the `auth/session-token.ts` module:
 * rules forbid a mock inside a test file, and the token reaching the tab's
 * storage *is* the observable behaviour — a module spy would only prove that a
 * function was called, not that the session survives a reload.
 *
 * `renderWithProviders` already mounts `SessionProvider` → `AuthProvider`, so
 * `useAuth()` resolves without an extra wrapper.
 */

import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SESSION_TOKEN_KEY } from '../auth/session-token.js';
import { renderWithProviders } from '../test/mocks/render-with-providers.js';
import {
  installRecordingStorages,
  type WebStorageHarness,
} from '../test/mocks/web-storage.mock.js';
import {
  LOGIN_EMPTY_PASSWORD_MESSAGE,
  LOGIN_PAGE_TITLE,
  LOGIN_PASSWORD_FIELD_ID,
  LOGIN_PASSWORD_LABEL,
  LOGIN_SUBMIT_LABEL,
  LoginPage,
} from './LoginPage.js';

describe('LoginPage', () => {
  let storage: WebStorageHarness;

  beforeEach(() => {
    // A fresh pair of recording storages per test: a leftover token from an
    // earlier case could satisfy the "no write" assertion by accident.
    storage = installRecordingStorages();
  });

  afterEach(() => {
    storage.restore();
  });

  it('renders the login card', () => {
    renderWithProviders(<LoginPage />);

    expect(
      screen.getByRole('heading', { level: 1, name: LOGIN_PAGE_TITLE }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(LOGIN_PASSWORD_LABEL)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: LOGIN_SUBMIT_LABEL }),
    ).toBeInTheDocument();
  });

  it('stores the session token when a password is submitted', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />);

    await user.type(screen.getByLabelText(LOGIN_PASSWORD_LABEL), 'titok');
    await user.click(screen.getByRole('button', { name: LOGIN_SUBMIT_LABEL }));

    expect(storage.session.writtenKeys()).toContain(SESSION_TOKEN_KEY);
    expect(storage.session.getItem(SESSION_TOKEN_KEY)).toMatch(
      /^placeholder-token-\d+$/,
    );
    expect(
      screen.queryByText(LOGIN_EMPTY_PASSWORD_MESSAGE),
    ).not.toBeInTheDocument();
  });

  it('reports an empty password and stores no token', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />);

    await user.click(screen.getByRole('button', { name: LOGIN_SUBMIT_LABEL }));

    expect(screen.getByText(LOGIN_EMPTY_PASSWORD_MESSAGE)).toBeInTheDocument();
    expect(screen.getByLabelText(LOGIN_PASSWORD_LABEL)).toHaveAttribute(
      'aria-invalid',
      'true',
    );
    expect(screen.getByLabelText(LOGIN_PASSWORD_LABEL)).toHaveAttribute(
      'aria-describedby',
      `${LOGIN_PASSWORD_FIELD_ID}-error`,
    );
    expect(storage.session.isUntouched()).toBe(true);
  });

  it('treats a whitespace-only password as empty', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />);

    await user.type(screen.getByLabelText(LOGIN_PASSWORD_LABEL), '   ');
    await user.click(screen.getByRole('button', { name: LOGIN_SUBMIT_LABEL }));

    expect(screen.getByText(LOGIN_EMPTY_PASSWORD_MESSAGE)).toBeInTheDocument();
    expect(storage.session.isUntouched()).toBe(true);
  });

  it('clears the message as soon as the user types', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />);

    await user.click(screen.getByRole('button', { name: LOGIN_SUBMIT_LABEL }));
    expect(screen.getByText(LOGIN_EMPTY_PASSWORD_MESSAGE)).toBeInTheDocument();

    await user.type(screen.getByLabelText(LOGIN_PASSWORD_LABEL), 't');

    expect(
      screen.queryByText(LOGIN_EMPTY_PASSWORD_MESSAGE),
    ).not.toBeInTheDocument();
  });
});
