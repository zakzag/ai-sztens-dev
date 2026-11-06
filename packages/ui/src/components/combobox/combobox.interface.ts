/** One selectable entry of a {@link Combobox}. */
export interface ComboboxOption {
  /** Submitted value. */
  readonly value: string;
  /** Visible text, also what the filter matches against. */
  readonly label: string;
  /** Renders the option disabled (visible, not selectable). */
  readonly disabled?: boolean;
}

/**
 * Props of {@link Combobox}.
 *
 * Fully controlled (decision **D5**): the caller owns both the selected value and
 * the typed text, because the two differ while the user is filtering — a
 * component that owned them would have to invent an "intermediate" state the
 * form layer then has to fight.
 *
 * Local options only; async search and multi-select are out of scope.
 */
export interface ComboboxProps {
  /** Field id — the input id and the listbox/option ids derive from it. */
  readonly id: string;
  /** All selectable entries in display order. */
  readonly options: readonly ComboboxOption[];
  /** Currently selected value, `null` when nothing is selected. */
  readonly value: string | null;
  /** Text currently in the input (the filter query). */
  readonly inputValue: string;
  /** Called with the value of the chosen option. */
  readonly onSelect: (value: string) => void;
  /** Called with every typed character; the caller mirrors it into `inputValue`. */
  readonly onInputValueChange: (inputValue: string) => void;
  /**
   * Called exactly once when a closed listbox opens — focus, a pointer press or
   * the first arrow key — and never while it is already open.
   *
   * It is the caller's chance to drop a pre-filled value before filtering: an
   * input that still held the current selection would filter the list down to
   * that single entry (AIS-148).
   */
  readonly onOpen?: () => void;
  /**
   * Called exactly once whenever an open listbox closes — select, `Escape` or
   * blur — and never while it is already closed.
   *
   * It is the caller's chance to restore the committed value after the
   * intermediate filter text is gone: a closed combobox that still showed the
   * query would claim a value the user never picked (AIS-148).
   */
  readonly onClose?: () => void;
  /** Placeholder of the input. */
  readonly placeholder?: string;
  /** Text shown when the filter matches nothing, defaults to the Hungarian label. */
  readonly emptyMessage?: string;
  /** Error state; sets `aria-invalid` and the danger border. */
  readonly invalid?: boolean;
  /** Id of the error/hint paragraph rendered by `FormField`. */
  readonly describedBy?: string;
  /** Disables the input. */
  readonly disabled?: boolean;
  /** Extra classes for the positioning wrapper (the input keeps its own recipe). */
  readonly className?: string;
}
