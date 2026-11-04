import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { describe, expect, it, vi } from 'vitest';
import { Toast } from '../src/components/toast/Toast.js';
import {
  TOAST_DISMISS_LABEL,
  TOAST_LEVEL_GLYPHS,
} from '../src/components/toast/toast.const.js';
import type { ToastProps } from '../src/components/toast/toast.interface.js';
import { AXE_JSDOM_OPTIONS } from './mocks/axe-options.mock.js';

/**
 * Renders a toast with a no-op dismiss handler, so each test only states what it
 * actually cares about.
 *
 * @param overrides - props to replace on the default info toast.
 * @returns the render result plus the card element.
 */
function renderToast(overrides: Partial<ToastProps> = {}) {
  const { level = 'info', message = 'Mentve', onDismiss = vi.fn(), ...rest } =
    overrides;

  const result = render(
    <Toast level={level} message={message} onDismiss={onDismiss} {...rest} />,
  );

  const card = result.container.firstElementChild;
  if (!(card instanceof HTMLElement)) {
    throw new Error('Toast did not render a root element');
  }

  return { ...result, card };
}

describe('Toast', () => {
  it.each([
    ['success', 'border-success'],
    ['error', 'border-danger'],
    ['warning', 'border-warning'],
    ['info', 'border-info'],
    ['system', 'border-border-strong'],
  ] as const)('maps the %s level to its accent token', (level, expectedClass) => {
    const { card } = renderToast({ level });

    expect(card.className).toContain(expectedClass);
    expect(card).toHaveAttribute('data-level', level);
  });

  it('announces the error level assertively and everything else politely', () => {
    const { unmount } = render(
      <Toast level="error" message="Hiba" onDismiss={vi.fn()} />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Hiba');
    unmount();

    render(<Toast level="warning" message="Figyelem" onDismiss={vi.fn()} />);

    expect(screen.getByRole('status')).toHaveTextContent('Figyelem');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('renders the level glyph as decoration only', () => {
    renderToast({ level: 'warning' });

    const glyph = screen.getByText(TOAST_LEVEL_GLYPHS.warning);

    expect(glyph).toHaveAttribute('aria-hidden', 'true');
  });

  it('renders a labelled close control that reports the dismiss once', async () => {
    const onDismiss = vi.fn();

    renderToast({ onDismiss });

    const close = screen.getByRole('button', { name: TOAST_DISMISS_LABEL });
    await userEvent.click(close);

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('forwards pointer enter and leave to the pause and resume callbacks', () => {
    const onPause = vi.fn();
    const onResume = vi.fn();

    const { card } = renderToast({ onPause, onResume });

    fireEvent.pointerEnter(card);
    fireEvent.pointerLeave(card);

    expect(onPause).toHaveBeenCalledTimes(1);
    expect(onResume).toHaveBeenCalledTimes(1);
  });

  it('omits the pointer handlers when the host passes no callbacks', () => {
    const { card } = renderToast();

    fireEvent.pointerEnter(card);

    expect(card).not.toHaveAttribute('onpointerenter');
  });

  it('shows the repeat counter only when a toast repeats', () => {
    const { unmount } = renderToast({ repeatCount: 3 });

    expect(screen.getByText('×3')).toBeInTheDocument();
    unmount();

    const { unmount: unmountSingle } = renderToast({ repeatCount: 1 });
    expect(screen.queryByText('×1')).not.toBeInTheDocument();
    unmountSingle();

    renderToast();
    expect(screen.queryByText(/^×/)).not.toBeInTheDocument();
  });

  it('renders the detail truncated and titled, and nothing when absent', () => {
    const detail = 'POST /api/v1/api-keys → 422 SEMANTIC_VALIDATION_FAILED';

    const { container, unmount } = renderToast({ detail });

    const paragraph = screen.getByText(detail);
    expect(paragraph).toHaveAttribute('title', detail);
    expect(paragraph.className).toContain('line-clamp-2');
    unmount();

    renderToast();
    expect(container.querySelector('[title]')).toBeNull();
  });

  it.each([
    [0, 'scale-100'],
    [1, 'scale-[0.97]'],
    [2, 'scale-[0.94]'],
  ] as const)('applies the depth %i recipe', (depth, expectedClass) => {
    const { card } = renderToast({ depth });

    expect(card.className).toContain(expectedClass);
  });

  it('merges caller class names', () => {
    const { card } = renderToast({ className: 'mb-4' });

    expect(card.className).toContain('mb-4');
  });

  it('passes axe for the success and the error level', async () => {
    const { container, unmount } = renderToast({ level: 'success' });
    const success = await axe(container, AXE_JSDOM_OPTIONS);
    expect(success.violations).toEqual([]);
    unmount();

    const errorResult = render(
      <Toast level="error" message="Hiba" onDismiss={vi.fn()} />,
    );
    const error = await axe(errorResult.container, AXE_JSDOM_OPTIONS);
    expect(error.violations).toEqual([]);
  });
});
