/**
 * Tests of the component-level error boundary.
 *
 * The boundary's whole purpose is that a render error does not blank the page:
 * it shows the page-level error state instead. These tests pin that.
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  APP_ERROR_BOUNDARY_MESSAGE,
  APP_ERROR_BOUNDARY_RELOAD_LABEL,
  APP_ERROR_BOUNDARY_TITLE,
} from '../app.const.js';
import { AppErrorBoundary } from './AppErrorBoundary.js';

/** A component that always throws while rendering. */
function ThrowingComponent(): never {
  throw new Error('render failure');
}

describe('AppErrorBoundary', () => {
  it('renders the children when nothing throws', () => {
    render(
      <AppErrorBoundary>
        <p>healthy content</p>
      </AppErrorBoundary>,
    );

    expect(screen.getByText('healthy content')).toBeInTheDocument();
  });

  it('renders the page error state instead of a blank page when a child throws', () => {
    // The error is logged by the boundary; the spy keeps the test output clean
    // and proves the error was actually caught.
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    render(
      <AppErrorBoundary>
        <ThrowingComponent />
      </AppErrorBoundary>,
    );

    expect(screen.getByRole('alert')).toHaveTextContent(
      APP_ERROR_BOUNDARY_TITLE,
    );
    expect(screen.getByText(APP_ERROR_BOUNDARY_MESSAGE)).toBeInTheDocument();
    expect(consoleError).toHaveBeenCalled();
  });

  it('offers a reload action', () => {
    // The boundary logs the caught error; the spy keeps the test output clean.
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    render(
      <AppErrorBoundary>
        <ThrowingComponent />
      </AppErrorBoundary>,
    );

    expect(
      screen.getByRole('button', { name: APP_ERROR_BOUNDARY_RELOAD_LABEL }),
    ).toBeInTheDocument();
  });

  it('accepts caller-provided wording', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    render(
      <AppErrorBoundary
        title="Saját cím"
        message="Saját üzenet"
        reloadLabel="Újra"
      >
        <ThrowingComponent />
      </AppErrorBoundary>,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Saját cím');
    expect(screen.getByText('Saját üzenet')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Újra' })).toBeInTheDocument();
  });
});
