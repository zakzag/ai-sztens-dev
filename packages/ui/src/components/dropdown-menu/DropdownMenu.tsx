import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';
import {
  DROPDOWN_MENU_EMPTY_LABEL,
  DROPDOWN_MENU_SIDE_OFFSET,
} from './dropdown-menu.const.js';
import {
  dropdownMenuContentVariants,
  dropdownMenuItemVariants,
} from './dropdown-menu.variants.js';
import type { DropdownMenuProps } from './dropdown-menu.interface.js';

/**
 * Row-action menu: a transient panel anchored to a trigger.
 *
 * AIS-117 D8: the items are data. The caller passes `items` and gets
 * `onSelect(id)` back; it never assembles menu markup itself, so a new action is
 * a new array entry and an empty (permission-filtered) list still renders the
 * `emptyLabel` row instead of an empty floating box.
 *
 * Keyboard navigation, roving focus and `Esc` are Radix's; the surface is the
 * token recipe.
 *
 * @param props - see {@link DropdownMenuProps}.
 */
export function DropdownMenu({
  trigger,
  items,
  label,
  align = 'end',
  emptyLabel = DROPDOWN_MENU_EMPTY_LABEL,
}: DropdownMenuProps) {
  return (
    <DropdownMenuPrimitive.Root>
      <DropdownMenuPrimitive.Trigger asChild>
        {trigger}
      </DropdownMenuPrimitive.Trigger>
      <DropdownMenuPrimitive.Portal>
        <DropdownMenuPrimitive.Content
          align={align}
          sideOffset={DROPDOWN_MENU_SIDE_OFFSET}
          aria-label={label}
          className={dropdownMenuContentVariants()}
        >
          {items.length === 0 ? (
            <DropdownMenuPrimitive.Item
              disabled
              className={dropdownMenuItemVariants()}
            >
              {emptyLabel}
            </DropdownMenuPrimitive.Item>
          ) : (
            items.map((item) => (
              <DropdownMenuPrimitive.Item
                key={item.id}
                disabled={item.disabled}
                className={dropdownMenuItemVariants({ tone: item.tone })}
                onSelect={() => item.onSelect(item.id)}
              >
                {item.label}
              </DropdownMenuPrimitive.Item>
            ))
          )}
        </DropdownMenuPrimitive.Content>
      </DropdownMenuPrimitive.Portal>
    </DropdownMenuPrimitive.Root>
  );
}
