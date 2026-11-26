import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CONFIRM_DIALOG_CANCEL_LABEL } from '../src/components/confirm-dialog/confirm-dialog.const.js';
import {
  ConfirmDialogHarness,
  OVERLAY_CONFIRM_LABEL,
  OVERLAY_STATE_CLOSED,
  OVERLAY_TITLE,
  OVERLAY_TRIGGER_LABEL,
} from './mocks/overlay-harness.mock.js';
import { createOverlayUser } from './mocks/overlay-user.mock.js';

/**
 * Tests of `ConfirmDialog`.
 *
 * The critical contract (AIS-117 D4) is that the component reports the decision
 * and nothing else: confirm must not dismiss the dialog, and every dismissal
 * path must go through `onOpenChange(false)`.
 */
describe('ConfirmDialog', () => {
  it('calls onConfirm on confirm and leaves the dialog open', async () => {
    const onConfirm = vi.fn();
    const onOpenChange = vi.fn();
    const user = createOverlayUser();
    render(
      <ConfirmDialogHarness
        onConfirm={onConfirm}
        onOpenChange={onOpenChange}
      />,
    );

    await user.click(
      screen.getByRole('button', { name: OVERLAY_TRIGGER_LABEL }),
    );
    await screen.findByRole('dialog');

    await user.click(
      screen.getByRole('button', { name: OVERLAY_CONFIRM_LABEL }),
    );

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(screen.getByRole('dialog', { name: OVERLAY_TITLE })).toBeInTheDocument();
  });

  it('dismisses itself through onOpenChange when cancelled', async () => {
    const onConfirm = vi.fn();
    const onOpenChange = vi.fn();
    const user = createOverlayUser();
    render(
      <ConfirmDialogHarness
        onConfirm={onConfirm}
        onOpenChange={onOpenChange}
      />,
    );

    await user.click(
      screen.getByRole('button', { name: OVERLAY_TRIGGER_LABEL }),
    );
    await screen.findByRole('dialog');

    await user.click(
      screen.getByRole('button', { name: CONFIRM_DIALOG_CANCEL_LABEL }),
    );

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
  });

  it('treats Escape as a cancel', async () => {
    const onConfirm = vi.fn();
    const onOpenChange = vi.fn();
    const user = createOverlayUser();
    render(
      <ConfirmDialogHarness
        onConfirm={onConfirm}
        onOpenChange={onOpenChange}
      />,
    );

    await user.click(
      screen.getByRole('button', { name: OVERLAY_TRIGGER_LABEL }),
    );
    await screen.findByRole('dialog');

    await user.keyboard('{Escape}');

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByText(OVERLAY_STATE_CLOSED)).toBeInTheDocument();
  });

  it('disables both actions and blocks dismissal while pending', async () => {
    const onConfirm = vi.fn();
    const onOpenChange = vi.fn();
    const user = createOverlayUser();
    render(
      <ConfirmDialogHarness
        onConfirm={onConfirm}
        onOpenChange={onOpenChange}
        isPending
      />,
    );

    await user.click(
      screen.getByRole('button', { name: OVERLAY_TRIGGER_LABEL }),
    );
    await screen.findByRole('dialog');

    const confirm = screen.getByRole('button', { name: OVERLAY_CONFIRM_LABEL });
    const cancel = screen.getByRole('button', {
      name: CONFIRM_DIALOG_CANCEL_LABEL,
    });

    expect(confirm).toBeDisabled();
    expect(confirm).toHaveAttribute('aria-busy', 'true');
    expect(cancel).toBeDisabled();

    await user.keyboard('{Escape}');

    expect(screen.getByRole('dialog', { name: OVERLAY_TITLE })).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it('paints the confirm action with the primary token when asked to', async () => {
    const user = createOverlayUser();
    render(<ConfirmDialogHarness onConfirm={vi.fn()} tone="primary" />);

    await user.click(
      screen.getByRole('button', { name: OVERLAY_TRIGGER_LABEL }),
    );
    await screen.findByRole('dialog');

    expect(
      screen.getByRole('button', { name: OVERLAY_CONFIRM_LABEL }).className,
    ).toContain('bg-primary');
  });

  it('paints the default confirm action with the danger token', async () => {
    const user = createOverlayUser();
    render(<ConfirmDialogHarness onConfirm={vi.fn()} />);

    await user.click(
      screen.getByRole('button', { name: OVERLAY_TRIGGER_LABEL }),
    );
    await screen.findByRole('dialog');

    expect(
      screen.getByRole('button', { name: OVERLAY_CONFIRM_LABEL }).className,
    ).toContain('bg-danger');
  });
});
