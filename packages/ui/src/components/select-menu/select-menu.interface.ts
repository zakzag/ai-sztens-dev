import type { ReactNode } from 'react';

/**
 * One selectable entry of a {@link SelectMenu}.
 *
 * The icon is a **decorative** node rendered before the label. It is data, not
 * markup, so the caller can put any icon component in it and the accessible
 * name of the option stays the label text alone.
 */
export interface SelectMenuOption {
  /** Submitted value. */
  readonly value: string;
  /** Visible text of the option and of the trigger while it is chosen. */
  readonly label: string;
  /** Optional leading icon, rendered `aria-hidden` by the icon set itself. */
  readonly icon?: ReactNode;
  /** Renders the option disabled (visible, not selectable). */
  readonly disabled?: boolean;
}

/**
 * Props of {@link SelectMenu}.
 *
 * A **single-choice, non-searchable** selector (AIS-149): the trigger shows the
 * chosen option only, and the panel lists the rest. There is no free-text input,
 * no filtering and no open/close state to mirror — the primitive is fully
 * controlled and the popup belongs to Radix.
 */
export interface SelectMenuProps {
  /**
   * Accessible name of the panel, and the base of the trigger's name.
   *
   * The trigger is named `"<label>: <chosen label>"`, so its visible text stays
   * part of the accessible name (WCAG "label in name") while a screen reader
   * still learns *what* the value belongs to.
   */
  readonly label: string;
  /** All selectable entries in display order. */
  readonly options: readonly SelectMenuOption[];
  /** Value of the chosen option; the trigger renders that option. */
  readonly value: string;
  /** Called with the value of the chosen option. */
  readonly onValueChange: (value: string) => void;
}
