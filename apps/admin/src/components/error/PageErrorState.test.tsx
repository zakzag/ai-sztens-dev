/**
 * Tests of the page-level error state.
 *
 * The component is props-driven: the retry callback is a spy, so “the retry
 * button refetches” is asserted without a query client.
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  PAGE_ERROR_RETRY_LABEL,
  PAGE_ERROR_RETRY_PENDING_LABEL,
} from '../../lib/error-surface.const.js';
import { PageErrorState } from './PageErrorState.js';

describe('PageErrorState', () => {
  it('renders the caller-owned title and message', () => {
    render(
      <PageErrorState
        title="Az API kulcsok betöltése nem sikerült."
        message="A szerver hibát jelzett."
        onRetry={vi.fn()}
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Az API kulcsok betöltése nem sikerült.');
    expect(screen.getByText('A szerver hibát jelzett.')).toBeInTheDocument();
  });

  it('calls the retry callback once per click', async () => {
    const onRetry = vi.fn();

    render(<PageErrorState title="Hiba" message="Nem elérhető." onRetry={onRetry} />);

    await userEvent.click(screen.getByRole('button', { name: PAGE_ERROR_RETRY_LABEL }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('disables the button and shows the pending label while retrying', () => {
    render(
      <PageErrorState title="Hiba" message="Nem elérhető." onRetry={vi.fn()} isRetrying />,
    );

    const button = screen.getByRole('button', { name: PAGE_ERROR_RETRY_PENDING_LABEL });

    expect(button).toBeDisabled();
  });

  it('accepts caller-provided labels', () => {
    render(
      <PageErrorState
        title="Hiba"
        message="Nem elérhető."
        onRetry={vi.fn()}
        retryLabel="Próbáld újra"
        retryingLabel="Folyamatban"
        isRetrying
      />,
    );

    expect(screen.getByRole('button', { name: 'Folyamatban' })).toBeInTheDocument();
  });
});
