import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ToastStack } from '../src/components/toast/ToastStack.js';
import {
  TOAST_DISMISS_LABEL,
  TOAST_MAX_VISIBLE,
  TOAST_STACK_ARIA_LABEL,
} from '../src/components/toast/toast.const.js';
import { buildToastItems } from './mocks/toast-items.mock.js';

describe('ToastStack', () => {
  it('renders nothing when there is no toast', () => {
    const { container } = render(
      <ToastStack toasts={[]} onDismiss={vi.fn()} />,
    );

    expect(container.firstChild).toBeNull();
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
  });

  it('keeps the newest toasts and drops the overflow', () => {
    render(<ToastStack toasts={buildToastItems(4)} onDismiss={vi.fn()} />);

    expect(screen.getAllByRole('status')).toHaveLength(TOAST_MAX_VISIBLE);
    expect(screen.getByText('Üzenet 1')).toBeInTheDocument();
    expect(screen.queryByText('Üzenet 4')).not.toBeInTheDocument();
  });

  it('renders the newest-first input in the same DOM order', () => {
    render(<ToastStack toasts={buildToastItems(3)} onDismiss={vi.fn()} />);

    const cards = screen.getAllByRole('status');

    expect(cards[0]).toHaveTextContent('Üzenet 1');
    expect(cards[1]).toHaveTextContent('Üzenet 2');
    expect(cards[2]).toHaveTextContent('Üzenet 3');
  });

  it('assigns the depth of the position to each card', () => {
    render(<ToastStack toasts={buildToastItems(3)} onDismiss={vi.fn()} />);

    const cards = screen.getAllByRole('status');

    expect(cards[0].className).toContain('scale-100');
    expect(cards[1].className).toContain('scale-[0.97]');
    expect(cards[2].className).toContain('scale-[0.94]');
  });

  it('reports the id of the card whose close control was used', async () => {
    const onDismiss = vi.fn();

    render(<ToastStack toasts={buildToastItems(3)} onDismiss={onDismiss} />);

    const buttons = screen.getAllByRole('button', {
      name: TOAST_DISMISS_LABEL,
    });
    await userEvent.click(buttons[1]);

    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onDismiss).toHaveBeenCalledWith('toast-2');
  });

  it('is a labelled polite live region', () => {
    render(<ToastStack toasts={buildToastItems(1)} onDismiss={vi.fn()} />);

    const region = screen.getByRole('region', {
      name: TOAST_STACK_ARIA_LABEL,
    });

    expect(region).toHaveAttribute('aria-live', 'polite');
    expect(region).toHaveAttribute('aria-atomic', 'false');
  });

  it('forwards pointer pause and resume with the card id', () => {
    const onPause = vi.fn();
    const onResume = vi.fn();

    render(
      <ToastStack
        toasts={buildToastItems(2)}
        onDismiss={vi.fn()}
        onPause={onPause}
        onResume={onResume}
      />,
    );

    const cards = screen.getAllByRole('status');
    fireEvent.pointerEnter(cards[0]);
    fireEvent.pointerLeave(cards[0]);

    expect(onPause).toHaveBeenCalledWith('toast-1');
    expect(onResume).toHaveBeenCalledWith('toast-1');
  });
});
