import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';
import { buttonVariants } from '../button/button.variants.js';
import {
  dropdownMenuContentVariants,
  dropdownMenuItemVariants,
} from '../dropdown-menu/dropdown-menu.variants.js';
import { DROPDOWN_MENU_SIDE_OFFSET } from '../dropdown-menu/dropdown-menu.const.js';
import { ChevronDownIcon } from '../icon/icons.js';
import { cn } from '../../lib/cn.js';
import {
  SELECT_MENU_CHEVRON_CLASS,
  SELECT_MENU_ITEM_CLASS,
  SELECT_MENU_TRIGGER_CLASS,
} from './select-menu.const.js';
import { toSelectedOption, toTriggerLabel } from './select-menu.logic.js';
import type { SelectMenuProps } from './select-menu.interface.js';

/**
 * Single-choice selector: a select box without a search field (AIS-149).
 *
 * The trigger is the `Button` recipe (`secondary`, `sm`) carrying the **chosen**
 * option's icon and label plus a chevron, so a closed control occupies one slot
 * in a fixed-height header band instead of the whole option list. The panel
 * reuses the `DropdownMenu` surface and item recipes, and Radix's
 * `RadioGroup`/`RadioItem` give the options `menuitemradio` semantics with
 * `aria-checked`, arrow-key navigation and `Escape` for free.
 *
 * Nothing here holds state: `value` and `onValueChange` are the caller's, which
 * keeps a page free to own the choice in its own `useState` (AIS-140 `D3`).
 *
 * @param props - see {@link SelectMenuProps}.
 * @returns the trigger button and its portalled option panel.
 */
export function SelectMenu({
  label,
  options,
  value,
  onValueChange,
}: SelectMenuProps) {
  const selected = toSelectedOption(options, value);

  return (
    <DropdownMenuPrimitive.Root>
      <DropdownMenuPrimitive.Trigger asChild>
        <button
          type="button"
          aria-label={toTriggerLabel(label, selected)}
          className={cn(
            buttonVariants({ variant: 'secondary', size: 'sm' }),
            SELECT_MENU_TRIGGER_CLASS,
          )}
        >
          {selected?.icon}
          {selected?.label}
          <ChevronDownIcon className={SELECT_MENU_CHEVRON_CLASS} />
        </button>
      </DropdownMenuPrimitive.Trigger>
      <DropdownMenuPrimitive.Portal>
        <DropdownMenuPrimitive.Content
          align="end"
          sideOffset={DROPDOWN_MENU_SIDE_OFFSET}
          aria-label={label}
          className={dropdownMenuContentVariants()}
        >
          <DropdownMenuPrimitive.RadioGroup
            value={value}
            onValueChange={onValueChange}
          >
            {options.map((option) => (
              <DropdownMenuPrimitive.RadioItem
                key={option.value}
                value={option.value}
                disabled={option.disabled}
                className={cn(
                  dropdownMenuItemVariants(),
                  SELECT_MENU_ITEM_CLASS,
                )}
              >
                {option.icon}
                {option.label}
              </DropdownMenuPrimitive.RadioItem>
            ))}
          </DropdownMenuPrimitive.RadioGroup>
        </DropdownMenuPrimitive.Content>
      </DropdownMenuPrimitive.Portal>
    </DropdownMenuPrimitive.Root>
  );
}
