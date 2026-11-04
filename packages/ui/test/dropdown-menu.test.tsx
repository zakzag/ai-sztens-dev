import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DROPDOWN_MENU_EMPTY_LABEL } from '../src/components/dropdown-menu/dropdown-menu.const.js';
import {
  createDropdownMenuItems,
  DropdownMenuHarness,
  EMPTY_DROPDOWN_MENU_ITEMS,
  OVERLAY_MENU_LABEL,
  OVERLAY_TRIGGER_LABEL,
} from './mocks/overlay-harness.mock.js';
import { createOverlayUser } from './mocks/overlay-user.mock.js';

/**
 * Tests of `DropdownMenu`.
 *
 * The menu is data-driven (AIS-117 D8), so the suite checks that the fixture is
 * rendered faithfully — including the disabled and the danger item — and that a
 * selection comes back as an id.
 */
describe('DropdownMenu', () => {
  it('renders no menu while closed', () => {
    render(
      <DropdownMenuHarness
        items={createDropdownMenuItems(vi.fn())}
        label={OVERLAY_MENU_LABEL}
      />,
    );

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('opens as a named menu with one item per fixture entry', async () => {
    const user = createOverlayUser();
    render(
      <DropdownMenuHarness
        items={createDropdownMenuItems(vi.fn())}
        label={OVERLAY_MENU_LABEL}
      />,
    );

    await user.click(
      screen.getByRole('button', { name: OVERLAY_TRIGGER_LABEL }),
    );

    const menu = await screen.findByRole('menu');

    expect(menu).toHaveAttribute('aria-label', OVERLAY_MENU_LABEL);
    expect(screen.getAllByRole('menuitem')).toHaveLength(3);
  });

  it('reports the selected item id and closes itself', async () => {
    const onSelect = vi.fn();
    const user = createOverlayUser();
    render(<DropdownMenuHarness items={createDropdownMenuItems(onSelect)} />);

    await user.click(
      screen.getByRole('button', { name: OVERLAY_TRIGGER_LABEL }),
    );
    await screen.findByRole('menu');

    await user.click(screen.getByRole('menuitem', { name: 'Átnevezés' }));

    expect(onSelect).toHaveBeenCalledWith('rename');
    await waitFor(() => {
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });
  });

  it('selects with the keyboard, skipping the disabled item', async () => {
    const onSelect = vi.fn();
    const user = createOverlayUser();
    render(<DropdownMenuHarness items={createDropdownMenuItems(onSelect)} />);

    const trigger = screen.getByRole('button', {
      name: OVERLAY_TRIGGER_LABEL,
    });

    trigger.focus();
    await user.keyboard('{Enter}');
    await screen.findByRole('menu');

    await user.keyboard('{ArrowDown}{Enter}');

    expect(onSelect).toHaveBeenCalledWith('delete');
  });

  it('never fires the callback of a disabled item', async () => {
    const onSelect = vi.fn();
    const user = createOverlayUser();
    render(<DropdownMenuHarness items={createDropdownMenuItems(onSelect)} />);

    await user.click(
      screen.getByRole('button', { name: OVERLAY_TRIGGER_LABEL }),
    );
    await screen.findByRole('menu');

    const disabledItem = screen.getByRole('menuitem', { name: 'Duplikálás' });

    expect(disabledItem).toHaveAttribute('data-disabled');

    await user.click(disabledItem);

    expect(onSelect).not.toHaveBeenCalled();
  });

  it('paints a danger item with the danger token', async () => {
    const user = createOverlayUser();
    render(<DropdownMenuHarness items={createDropdownMenuItems(vi.fn())} />);

    await user.click(
      screen.getByRole('button', { name: OVERLAY_TRIGGER_LABEL }),
    );
    await screen.findByRole('menu');

    expect(
      screen.getByRole('menuitem', { name: 'Törlés' }).className,
    ).toContain('text-danger');
    expect(
      screen.getByRole('menuitem', { name: 'Átnevezés' }).className,
    ).toContain('text-text-primary');
  });

  it('renders the empty label instead of an empty panel', async () => {
    const user = createOverlayUser();
    render(<DropdownMenuHarness items={EMPTY_DROPDOWN_MENU_ITEMS} />);

    await user.click(
      screen.getByRole('button', { name: OVERLAY_TRIGGER_LABEL }),
    );
    await screen.findByRole('menu');

    const emptyItem = screen.getByRole('menuitem', {
      name: DROPDOWN_MENU_EMPTY_LABEL,
    });

    expect(emptyItem).toHaveAttribute('data-disabled');
  });
});
