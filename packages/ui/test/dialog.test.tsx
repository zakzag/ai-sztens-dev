import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DIALOG_CLOSE_LABEL } from '../src/components/dialog/dialog.const.js';
import {
  DialogHarness,
  OVERLAY_BODY,
  OVERLAY_FOOTER_LABEL,
  OVERLAY_TITLE,
  OVERLAY_TRIGGER_LABEL,
} from './mocks/overlay-harness.mock.js';
import { createOverlayUser } from './mocks/overlay-user.mock.js';

/**
 * Behavioural tests of `Dialog`.
 *
 * The assertions target what the ticket actually promises: a modal dialog with
 * an accessible name, `Esc` dismissal, and focus returning to whatever opened
 * it. Layout classes are only checked where the `size` variant has to prove
 * itself.
 */
describe('Dialog', () => {
  it('renders no dialog while it is closed', () => {
    render(<DialogHarness />);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens as an aria-modal dialog named by its title', async () => {
    const user = createOverlayUser();
    render(<DialogHarness />);

    await user.click(
      screen.getByRole('button', { name: OVERLAY_TRIGGER_LABEL }),
    );

    const dialog = await screen.findByRole('dialog', { name: OVERLAY_TITLE });

    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByText(OVERLAY_BODY)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: OVERLAY_FOOTER_LABEL }),
    ).toBeInTheDocument();
  });

  it('closes on Escape and reports it through onOpenChange', async () => {
    const onOpenChange = vi.fn();
    const user = createOverlayUser();
    render(<DialogHarness onOpenChange={onOpenChange} />);

    await user.click(
      screen.getByRole('button', { name: OVERLAY_TRIGGER_LABEL }),
    );
    await screen.findByRole('dialog');

    await user.keyboard('{Escape}');

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
  });

  it('closes from its own close control', async () => {
    const user = createOverlayUser();
    render(<DialogHarness />);

    await user.click(
      screen.getByRole('button', { name: OVERLAY_TRIGGER_LABEL }),
    );
    await screen.findByRole('dialog');

    await user.click(screen.getByRole('button', { name: DIALOG_CLOSE_LABEL }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('closes when the backdrop is clicked', async () => {
    const user = createOverlayUser();
    render(<DialogHarness />);

    await user.click(
      screen.getByRole('button', { name: OVERLAY_TRIGGER_LABEL }),
    );
    await screen.findByRole('dialog');

    await user.click(document.body);

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('returns focus to the trigger after closing', async () => {
    const user = createOverlayUser();
    render(<DialogHarness />);

    const trigger = screen.getByRole('button', {
      name: OVERLAY_TRIGGER_LABEL,
    });

    await user.click(trigger);
    await screen.findByRole('dialog');

    await user.keyboard('{Escape}');

    await waitFor(() => {
      expect(trigger).toHaveFocus();
    });
  });

  it('widens its surface with the size variant', async () => {
    const user = createOverlayUser();
    render(<DialogHarness size="lg" />);

    await user.click(
      screen.getByRole('button', { name: OVERLAY_TRIGGER_LABEL }),
    );

    const dialog = await screen.findByRole('dialog', { name: OVERLAY_TITLE });

    expect(dialog.className).toContain('max-w-2xl');
    expect(dialog.className).toContain('shadow-neu-raised');
  });
});
