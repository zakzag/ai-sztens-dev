import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DRAWER_BODY_CLASS } from '../src/components/drawer/drawer.const.js';
import {
  DrawerHarness,
  OVERLAY_BODY,
  OVERLAY_FOOTER_LABEL,
  OVERLAY_TITLE,
  OVERLAY_TRIGGER_LABEL,
} from './mocks/overlay-harness.mock.js';
import { createOverlayUser } from './mocks/overlay-user.mock.js';

/**
 * Tests of `Drawer`.
 *
 * The drawer is a modal panel built on the dialog shell (AIS-117 D3), so the
 * suite proves the modal contract plus the one thing that is genuinely its own:
 * which edge the panel is attached to.
 */
describe('Drawer', () => {
  it('opens pinned to the right edge by default', async () => {
    const user = createOverlayUser();
    render(<DrawerHarness />);

    await user.click(
      screen.getByRole('button', { name: OVERLAY_TRIGGER_LABEL }),
    );

    const drawer = await screen.findByRole('dialog', { name: OVERLAY_TITLE });

    expect(drawer).toHaveAttribute('aria-modal', 'true');
    expect(drawer.className).toContain('right-0');
    expect(drawer.className).not.toContain('left-0');
    expect(screen.getByText(OVERLAY_BODY)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: OVERLAY_FOOTER_LABEL }),
    ).toBeInTheDocument();
  });

  it('pins the panel to the left edge when asked to', async () => {
    const user = createOverlayUser();
    render(<DrawerHarness side="left" />);

    await user.click(
      screen.getByRole('button', { name: OVERLAY_TRIGGER_LABEL }),
    );

    const drawer = await screen.findByRole('dialog', { name: OVERLAY_TITLE });

    expect(drawer.className).toContain('left-0');
    expect(drawer.className).not.toContain('right-0');
  });

  it('scrolls its own body so the footer stays reachable', async () => {
    const user = createOverlayUser();
    render(<DrawerHarness />);

    await user.click(
      screen.getByRole('button', { name: OVERLAY_TRIGGER_LABEL }),
    );
    await screen.findByRole('dialog');

    expect(
      screen.getByText(OVERLAY_BODY).parentElement?.className,
    ).toContain(DRAWER_BODY_CLASS);
  });

  it('closes on Escape and returns focus to the trigger', async () => {
    const onOpenChange = vi.fn();
    const user = createOverlayUser();
    render(<DrawerHarness onOpenChange={onOpenChange} />);

    const trigger = screen.getByRole('button', {
      name: OVERLAY_TRIGGER_LABEL,
    });

    await user.click(trigger);
    await screen.findByRole('dialog');

    await user.keyboard('{Escape}');

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
    await waitFor(() => {
      expect(trigger).toHaveFocus();
    });
  });
});
