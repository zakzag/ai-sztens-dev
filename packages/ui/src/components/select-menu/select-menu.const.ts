/**
 * Geometry and motion of {@link SelectMenu}.
 *
 * Only the two values the primitive cannot borrow from an existing recipe live
 * here: the trigger needs the `group` marker so the chevron can react to
 * Radix's `data-state`, and the chevron needs the rotation itself.
 */

/**
 * Marker class of the trigger button.
 *
 * Radix sets `data-state` on the trigger, so the chevron is styled through the
 * `group-data-[state=open]` variant instead of React state.
 */
export const SELECT_MENU_TRIGGER_CLASS = 'group';

/** Chevron of the trigger: hidden from assistive tech, rotates while open. */
export const SELECT_MENU_CHEVRON_CLASS =
  'transition-transform duration-fast group-data-[state=open]:rotate-180';

/**
 * Item classes the `DropdownMenu` recipe does not provide.
 *
 * `gap-2` keeps the icon away from the label, and the checked state is the only
 * colour difference in the list: the accent marks the current choice without a
 * second glyph (WCAG: the state is not signalled by depth alone).
 */
export const SELECT_MENU_ITEM_CLASS = 'gap-2 data-[state=checked]:text-primary';
