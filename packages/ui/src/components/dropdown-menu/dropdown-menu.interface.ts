import type { ReactNode } from 'react';

/** Visual tone of a menu item; `danger` marks a destructive action. */
export type DropdownMenuItemTone = 'default' | 'danger';

/**
 * One selectable entry of a {@link DropdownMenu}.
 *
 * The list is data, not JSX (AIS-117 D8): a page describes its row actions as
 * values and the menu renders them, so the markup exists once.
 */
export interface DropdownMenuItem {
  readonly id: string;
  readonly label: string;
  /** Called with {@link DropdownMenuItem.id} when the item is chosen. */
  readonly onSelect: (id: string) => void;
  /** Defaults to `default`. */
  readonly tone?: DropdownMenuItemTone;
  readonly disabled?: boolean;
}

/** Horizontal alignment of the panel against its trigger. */
export type DropdownMenuAlign = 'start' | 'end';

/**
 * Props of {@link DropdownMenu}.
 *
 * The menu is transient (Radix owns its open state), so it takes only a trigger
 * slot and the item fixture. Choosing an item calls its `onSelect` and closes
 * the menu — no navigation, no side effect beyond the callback.
 */
export interface DropdownMenuProps {
  readonly trigger: ReactNode;
  readonly items: readonly DropdownMenuItem[];
  /** Accessible name of the menu (`aria-label`). */
  readonly label?: string;
  /** Defaults to `end`, the usual choice for a row-action column. */
  readonly align?: DropdownMenuAlign;
  /** Defaults to `DROPDOWN_MENU_EMPTY_LABEL`. */
  readonly emptyLabel?: string;
}
