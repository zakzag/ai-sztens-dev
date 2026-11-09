/**
 * Controlled harnesses and label fixtures for the overlay primitives.
 *
 * Every overlay is **controlled**, so a test cannot render one without owning
 * its `open` state. These harnesses are that owner: they render a named trigger
 * button, the overlay, and a visible open/closed marker, and they forward the
 * `onOpenChange` / `onConfirm` spies the test asserts on.
 *
 * The fixtures are shared by all five overlay test files — tests never declare
 * their own labels or item lists.
 */

import { useState } from 'react';
import { Button } from '../../src/components/button/Button.js';
import { ConfirmDialog } from '../../src/components/confirm-dialog/ConfirmDialog.js';
import { Dialog } from '../../src/components/dialog/Dialog.js';
import { Drawer } from '../../src/components/drawer/Drawer.js';
import { DropdownMenu } from '../../src/components/dropdown-menu/DropdownMenu.js';
import { Tooltip } from '../../src/components/tooltip/Tooltip.js';
import type { ConfirmDialogTone } from '../../src/components/confirm-dialog/confirm-dialog.interface.js';
import type { DialogSize } from '../../src/components/dialog/dialog.variants.js';
import type { DrawerSide } from '../../src/components/drawer/drawer.variants.js';
import type { DropdownMenuItem } from '../../src/components/dropdown-menu/dropdown-menu.interface.js';

/** Accessible name of the trigger that opens the harness overlay. */
export const OVERLAY_TRIGGER_LABEL = 'Megnyitás';

/** Dialog title the harness renders (also the accessible name of the dialog). */
export const OVERLAY_TITLE = 'Felhasználó törlése';

/** Dialog description the harness renders. */
export const OVERLAY_DESCRIPTION = 'A művelet nem visszavonható.';

/** Body content slot the harness fills. */
export const OVERLAY_BODY = 'Ez a szöveg a dialógus törzsében van.';

/** Footer slot label the harness renders. */
export const OVERLAY_FOOTER_LABEL = 'Mentés';

/** Confirm button label used by the confirm harness. */
export const OVERLAY_CONFIRM_LABEL = 'Törlés';

/** Marker text shown while the harness overlay is open. */
export const OVERLAY_STATE_OPEN = 'nyitva';

/** Marker text shown while the harness overlay is closed. */
export const OVERLAY_STATE_CLOSED = 'zárva';

/** Tooltip trigger label used by the tooltip harness. */
export const OVERLAY_TOOLTIP_TRIGGER_LABEL = 'Súgó';

/** Tooltip content used by the tooltip harness. */
export const OVERLAY_TOOLTIP_CONTENT = 'Legfeljebb 100 karakter.';

/** Accessible name of the dropdown menu the harness renders. */
export const OVERLAY_MENU_LABEL = 'Műveletek';

/** Ids of the dropdown fixture items, in render order. */
export const OVERLAY_MENU_ITEM_IDS = ['rename', 'duplicate', 'delete'] as const;

/** Props of {@link DialogHarness}. */
export interface DialogHarnessProps {
  readonly onOpenChange?: (open: boolean) => void;
  readonly size?: DialogSize;
}

/**
 * Controlled `Dialog` harness: trigger + open/closed marker + the dialog itself.
 *
 * @param props - optional `onOpenChange` spy and a `size` override.
 */
export function DialogHarness({ onOpenChange, size }: DialogHarnessProps) {
  const [open, setOpen] = useState(false);

  const handleOpenChange = (next: boolean): void => {
    setOpen(next);
    onOpenChange?.(next);
  };

  return (
    <div>
      <Button onClick={() => handleOpenChange(true)}>{OVERLAY_TRIGGER_LABEL}</Button>
      <p>{open ? OVERLAY_STATE_OPEN : OVERLAY_STATE_CLOSED}</p>
      <Dialog
        open={open}
        onOpenChange={handleOpenChange}
        title={OVERLAY_TITLE}
        description={OVERLAY_DESCRIPTION}
        size={size}
        footer={<Button>{OVERLAY_FOOTER_LABEL}</Button>}
      >
        <p>{OVERLAY_BODY}</p>
      </Dialog>
    </div>
  );
}

/** Props of {@link ConfirmDialogHarness}. */
export interface ConfirmDialogHarnessProps {
  readonly onConfirm: () => void;
  readonly onOpenChange?: (open: boolean) => void;
  readonly isPending?: boolean;
  readonly tone?: ConfirmDialogTone;
}

/**
 * Controlled `ConfirmDialog` harness.
 *
 * @param props - the `onConfirm` spy plus optional `isPending` / `tone`.
 */
export function ConfirmDialogHarness({
  onConfirm,
  onOpenChange,
  isPending = false,
  tone,
}: ConfirmDialogHarnessProps) {
  const [open, setOpen] = useState(false);

  const handleOpenChange = (next: boolean): void => {
    setOpen(next);
    onOpenChange?.(next);
  };

  return (
    <div>
      <Button onClick={() => handleOpenChange(true)}>{OVERLAY_TRIGGER_LABEL}</Button>
      <p>{open ? OVERLAY_STATE_OPEN : OVERLAY_STATE_CLOSED}</p>
      <ConfirmDialog
        open={open}
        onOpenChange={handleOpenChange}
        title={OVERLAY_TITLE}
        description={OVERLAY_DESCRIPTION}
        confirmLabel={OVERLAY_CONFIRM_LABEL}
        isPending={isPending}
        tone={tone}
        onConfirm={onConfirm}
      />
    </div>
  );
}

/** Props of {@link DrawerHarness}. */
export interface DrawerHarnessProps {
  readonly onOpenChange?: (open: boolean) => void;
  readonly side?: DrawerSide;
}

/**
 * Controlled `Drawer` harness.
 *
 * @param props - optional `onOpenChange` spy and a `side` override.
 */
export function DrawerHarness({ onOpenChange, side }: DrawerHarnessProps) {
  const [open, setOpen] = useState(false);

  const handleOpenChange = (next: boolean): void => {
    setOpen(next);
    onOpenChange?.(next);
  };

  return (
    <div>
      <Button onClick={() => handleOpenChange(true)}>{OVERLAY_TRIGGER_LABEL}</Button>
      <p>{open ? OVERLAY_STATE_OPEN : OVERLAY_STATE_CLOSED}</p>
      <Drawer
        open={open}
        onOpenChange={handleOpenChange}
        title={OVERLAY_TITLE}
        side={side}
        footer={<Button>{OVERLAY_FOOTER_LABEL}</Button>}
      >
        <p>{OVERLAY_BODY}</p>
      </Drawer>
    </div>
  );
}

/** Props of {@link TooltipHarness}. */
export interface TooltipHarnessProps {
  readonly disabled?: boolean;
}

/**
 * `Tooltip` harness with a zero open delay so tests never wait on Radix timing.
 *
 * @param props - `disabled` mutes the tooltip entirely.
 */
export function TooltipHarness({ disabled = false }: TooltipHarnessProps) {
  return (
    <Tooltip
      content={OVERLAY_TOOLTIP_CONTENT}
      delayMs={0}
      disabled={disabled}
    >
      <Button>{OVERLAY_TOOLTIP_TRIGGER_LABEL}</Button>
    </Tooltip>
  );
}

/**
 * Builds the dropdown fixture items, wiring every `onSelect` to one spy.
 *
 * @param onSelect - spy that receives the selected item id.
 * @returns three items: a plain, a disabled and a danger one.
 */
export function createDropdownMenuItems(
  onSelect: (id: string) => void,
): readonly DropdownMenuItem[] {
  return [
    { id: 'rename', label: 'Átnevezés', onSelect },
    { id: 'duplicate', label: 'Duplikálás', onSelect, disabled: true },
    { id: 'delete', label: 'Törlés', onSelect, tone: 'danger' },
  ];
}

/** Empty item list for the empty-menu assertion. */
export const EMPTY_DROPDOWN_MENU_ITEMS: readonly DropdownMenuItem[] = [];

/** Props of {@link DropdownMenuHarness}. */
export interface DropdownMenuHarnessProps {
  readonly items: readonly DropdownMenuItem[];
  readonly label?: string;
}

/**
 * `DropdownMenu` harness with the shared trigger slot.
 *
 * @param props - the item fixture (and optionally the menu label).
 */
export function DropdownMenuHarness({ items, label }: DropdownMenuHarnessProps) {
  return (
    <DropdownMenu
      trigger={<Button>{OVERLAY_TRIGGER_LABEL}</Button>}
      items={items}
      label={label}
    />
  );
}
