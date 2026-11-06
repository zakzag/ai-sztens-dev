import { forwardRef, useMemo, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { inputVariants } from '../input/input.variants.js';
import {
  clampActiveIndex,
  filterOptions,
  nextActiveIndex,
  toComboboxOptionId,
} from './combobox.logic.js';
import type { ComboboxDirection } from './combobox.logic.js';
import {
  COMBOBOX_DEFAULT_EMPTY_MESSAGE,
  COMBOBOX_LISTBOX_ID_SUFFIX,
} from './combobox.const.js';
import { cn } from '../../lib/cn.js';
import type { ComboboxOption, ComboboxProps } from './combobox.interface.js';

const ARROW_DIRECTIONS: Readonly<Record<string, ComboboxDirection>> = {
  ArrowDown: 1,
  ArrowUp: -1,
};

/**
 * Searchable single-value selector.
 *
 * Implements the WAI-ARIA combobox pattern: the input owns the focus,
 * `aria-activedescendant` points at the highlighted option, and the listbox is
 * only rendered while open. All filtering and index arithmetic happens in
 * {@link filterOptions}, {@link nextActiveIndex} and {@link clampActiveIndex};
 * the component itself keeps no domain state (decision **D5**).
 *
 * @param props - see {@link ComboboxProps}.
 */
export const Combobox = forwardRef<HTMLInputElement, ComboboxProps>(
  function Combobox(
    {
      id,
      options,
      value,
      inputValue,
      onSelect,
      onInputValueChange,
      onOpen,
      onClose,
      placeholder,
      emptyMessage = COMBOBOX_DEFAULT_EMPTY_MESSAGE,
      invalid = false,
      describedBy,
      disabled = false,
      className,
    },
    ref,
  ) {
    const [isOpen, setIsOpen] = useState(false);
    const [activeIndex, setActiveIndex] = useState(-1);

    const listboxId = `${id}${COMBOBOX_LISTBOX_ID_SUFFIX}`;
    const filtered = useMemo(
      () => filterOptions(options, inputValue),
      [options, inputValue],
    );
    const active = clampActiveIndex(activeIndex, filtered.length);
    const activeOption = active >= 0 ? filtered[active] : undefined;

    /**
     * Expands the listbox and reports the transition **once**.
     *
     * `onOpen` fires only when the listbox was actually closed, so the caller
     * clears its filter text once, not on every keystroke that re-expands it.
     */
    function open(): void {
      if (isOpen) {
        return;
      }

      setIsOpen(true);
      onOpen?.();
    }

    /**
     * Collapses the listbox and reports the transition **once**.
     *
     * `onClose` fires only when the listbox was actually open, so a blur of an
     * already-closed field cannot reset the caller's text a second time.
     */
    function close(): void {
      setActiveIndex(-1);

      if (!isOpen) {
        return;
      }

      setIsOpen(false);
      onClose?.();
    }

    function select(option: ComboboxOption): void {
      if (option.disabled) {
        return;
      }

      onSelect(option.value);
      onInputValueChange(option.label);
      close();
    }

    function handleKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
      const direction = ARROW_DIRECTIONS[event.key];

      if (direction) {
        event.preventDefault();
        open();
        setActiveIndex(
          nextActiveIndex(activeIndex, direction, filtered.length),
        );
        return;
      }

      if (event.key === 'Enter') {
        if (isOpen && activeOption) {
          event.preventDefault();
          select(activeOption);
        }
        return;
      }

      if (event.key === 'Escape') {
        close();
      }
    }

    return (
      <div className={cn('relative', className)}>
        <input
          ref={ref}
          id={id}
          type="text"
          role="combobox"
          autoComplete="off"
          value={inputValue}
          disabled={disabled}
          placeholder={placeholder}
          aria-expanded={isOpen}
          aria-controls={isOpen ? listboxId : undefined}
          aria-autocomplete="list"
          aria-activedescendant={
            isOpen && activeOption
              ? toComboboxOptionId(listboxId, active)
              : undefined
          }
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          className={cn(inputVariants({ invalid }))}
          onChange={(event) => {
            onInputValueChange(event.target.value);
            open();
            setActiveIndex(-1);
          }}
          onFocus={open}
          onClick={open}
          onBlur={close}
          onKeyDown={handleKeyDown}
        />
        {isOpen ? (
          <ul
            id={listboxId}
            role="listbox"
            className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-control border border-border-hairline bg-surface-overlay p-1 shadow-neu-raised"
          >
            {filtered.length === 0 ? (
              <li
                role="presentation"
                className="px-3 py-2 text-sm text-text-muted"
              >
                {emptyMessage}
              </li>
            ) : (
              filtered.map((option, index) => (
                <li
                  key={option.value}
                  id={toComboboxOptionId(listboxId, index)}
                  role="option"
                  aria-selected={value === option.value}
                  aria-disabled={option.disabled || undefined}
                  className={cn(
                    'cursor-pointer rounded-control px-3 py-2 text-sm text-text-primary',
                    index === active && 'bg-surface-sunken',
                    option.disabled && 'cursor-not-allowed opacity-60',
                  )}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    select(option);
                  }}
                >
                  {option.label}
                </li>
              ))
            )}
          </ul>
        ) : null}
      </div>
    );
  },
);
