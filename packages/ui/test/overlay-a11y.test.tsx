import { render, screen } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { describe, expect, it, vi } from 'vitest';
import {
  ConfirmDialogHarness,
  createDropdownMenuItems,
  DialogHarness,
  DrawerHarness,
  DropdownMenuHarness,
  OVERLAY_MENU_LABEL,
  OVERLAY_TITLE,
  OVERLAY_TOOLTIP_TRIGGER_LABEL,
  OVERLAY_TRIGGER_LABEL,
  TooltipHarness,
} from './mocks/overlay-harness.mock.js';
import { OVERLAY_AXE_OPTIONS } from './mocks/overlay-axe-options.mock.js';
import { createOverlayUser } from './mocks/overlay-user.mock.js';

/**
 * Runs axe-core over the whole document and fails with the violation list.
 *
 * The overlays live in a portal on `document.body`, so scanning the render
 * container would scan nothing.
 */
async function expectNoViolations(): Promise<void> {
  const results = await axe(document.body, OVERLAY_AXE_OPTIONS);

  expect(results.violations).toEqual([]);
}

/**
 * Accessibility gate for the overlay primitives.
 *
 * Each overlay is asserted in its **open** state, because that is the state the
 * ticket describes: `aria-modal`, `role="dialog"`, an accessible title.
 */
describe('overlay primitives a11y', () => {
  it('passes axe with the dialog open', async () => {
    const user = createOverlayUser();
    render(<DialogHarness />);

    await user.click(
      screen.getByRole('button', { name: OVERLAY_TRIGGER_LABEL }),
    );
    await screen.findByRole('dialog', { name: OVERLAY_TITLE });

    await expectNoViolations();
  });

  it('passes axe with the confirm dialog open', async () => {
    const user = createOverlayUser();
    render(<ConfirmDialogHarness onConfirm={vi.fn()} />);

    await user.click(
      screen.getByRole('button', { name: OVERLAY_TRIGGER_LABEL }),
    );
    await screen.findByRole('dialog', { name: OVERLAY_TITLE });

    await expectNoViolations();
  });

  it('passes axe with the drawer open', async () => {
    const user = createOverlayUser();
    render(<DrawerHarness />);

    await user.click(
      screen.getByRole('button', { name: OVERLAY_TRIGGER_LABEL }),
    );
    await screen.findByRole('dialog', { name: OVERLAY_TITLE });

    await expectNoViolations();
  });

  it('passes axe with the dropdown menu open', async () => {
    const user = createOverlayUser();
    render(
      <div>
        <DropdownMenuHarnessForA11y />
      </div>,
    );

    await user.click(
      screen.getByRole('button', { name: OVERLAY_TRIGGER_LABEL }),
    );

    const menu = await screen.findByRole('menu');

    expect(menu).toHaveAttribute('aria-label', OVERLAY_MENU_LABEL);

    await expectNoViolations();
  });

  it('passes axe with the tooltip visible', async () => {
    const user = createOverlayUser();
    render(<TooltipHarness />);

    await user.tab();
    await screen.findByRole('tooltip');

    expect(
      screen.getByRole('button', { name: OVERLAY_TOOLTIP_TRIGGER_LABEL }),
    ).toBeInTheDocument();

    await expectNoViolations();
  });
});

/**
 * Local wrapper so the dropdown fixture (with its label) is declared once for
 * this file without exporting a test-only component from the shared mocks.
 */
function DropdownMenuHarnessForA11y() {
  return (
    <DropdownMenuHarness
      items={createDropdownMenuItems(vi.fn())}
      label={OVERLAY_MENU_LABEL}
    />
  );
}
