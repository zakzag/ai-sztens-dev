/** One selectable radio entry. */
export interface RadioOption {
  /** Submitted value. */
  readonly value: string;
  /** Visible text. */
  readonly label: string;
  /** Secondary line under the label. */
  readonly description?: string;
  /** Renders the radio disabled (visible, not selectable). */
  readonly disabled?: boolean;
}

/** Layout of the option list. */
export type RadioGroupOrientation = 'vertical' | 'horizontal';

/**
 * Props of {@link RadioGroup}.
 *
 * Controlled on purpose: the selected value is the caller's state, so a form can
 * restore it after a failed submit without the primitive owning anything.
 */
export interface RadioGroupProps {
  /** Shared `name` of the radio inputs — it also seeds the option ids. */
  readonly name: string;
  /** Group heading rendered as the `<legend>`. */
  readonly legend: string;
  /** Options in display order. */
  readonly options: readonly RadioOption[];
  /** Currently selected value, `''` when nothing is selected. */
  readonly value: string;
  /** Receives the newly selected value. */
  readonly onChange: (value: string) => void;
  /** Layout of the options, defaults to `vertical`. */
  readonly orientation?: RadioGroupOrientation;
  /** Error state; sets `aria-invalid` and the danger border. */
  readonly invalid?: boolean;
  /** Id of the error/hint paragraph rendered by `FormField`. */
  readonly describedBy?: string;
  /** Disables the whole group. */
  readonly disabled?: boolean;
}
