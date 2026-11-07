import { cva, type VariantProps } from 'class-variance-authority';
import { LOG_DRAWER_Z_INDEX } from './log-drawer.const.js';

/**
 * The single drawer handle: a narrow strip on the right edge, vertically
 * centred, present in **both** states (AIS-136 `D4`).
 *
 * A real `<button>`, so it is focusable and announced as one; the chevron and
 * the "Log" caption are decorative and rendered `aria-hidden`, the accessible
 * name comes from `aria-label` and flips with `isOpen`.
 *
 * The **position never changes** (`right-0`): only the surface flips to the
 * pressed shadow, and the panel reserves a matching right gutter
 * ({@link LOG_DRAWER_HANDLE_GUTTER}) while it is open. Moving the handle next to
 * an open panel would need a viewport-width dependent offset and could push it
 * off-screen on a narrow viewport.
 */
export const logDrawerTabVariants = cva(
  `fixed top-1/2 right-0 ${LOG_DRAWER_Z_INDEX} flex w-10 -translate-y-1/2 flex-col items-center gap-2 rounded-l-card border border-r-0 border-hairline bg-surface-overlay py-3 transition-shadow duration-fast focus-visible:border-border-focus focus-visible:shadow-focus-ring focus-visible:outline-none`,
  {
    variants: {
      isOpen: {
        true: 'text-text-primary shadow-neu-pressed',
        false: 'text-text-secondary shadow-neu-raised hover:text-text-primary',
      },
    },
    defaultVariants: { isOpen: false },
  },
);

/**
 * Panel surface: a full-height panel pinned to the right edge.
 *
 * The slide is pure CSS — the element itself is always mounted and only its
 * `translate-x` class changes, so both directions animate with no `useState` and
 * no mount flag (AIS-82 decision D5). Keeping the element mounted also keeps the
 * tab's `aria-controls` reference valid while the panel is closed. The panel is
 * **not** modal: no overlay, no focus trap, the page behind stays scrollable.
 *
 * The width is a CSS custom property, not a fixed class (AIS-150): below `md`
 * the panel is `w-full` and the property is ignored, above `md` it is the
 * resizable width. `isResizing` removes the transform transition, so a drag never
 * animates against the pointer.
 */
export const logDrawerPanelVariants = cva(
  `fixed inset-y-0 right-0 ${LOG_DRAWER_Z_INDEX} flex w-full flex-col border-l border-hairline bg-surface-overlay text-sm text-text-primary shadow-neu-raised md:w-[var(--log-drawer-width)]`,
  {
    variants: {
      isResizing: {
        true: 'transition-none',
        false: 'transition-transform duration-base ease-neu',
      },
    },
    defaultVariants: { isResizing: false },
  },
);

/**
 * The resize handle on the panel's left edge (AIS-150).
 *
 * A `role="separator"` element, so the width is adjustable without a pointer.
 * It is 12 px wide — a comfortable hit target — while the visible band inside is
 * only 6 px ({@link logDrawerResizeRailVariants}), and it exists only from `md`
 * up: below that the panel is full width, so there is nothing to resize.
 *
 * `touch-none` is required: without it a touch drag scrolls the page instead of
 * resizing.
 */
export const logDrawerResizeHandleVariants = cva(
  `group absolute inset-y-0 left-0 hidden w-3 cursor-col-resize touch-none items-center justify-center transition-shadow duration-fast focus-visible:border-border-focus focus-visible:shadow-focus-ring focus-visible:outline-none md:flex`,
);

/**
 * Visible band inside the resize handle.
 *
 * Purely decorative — the separator's `aria-label`, `aria-valuenow` and
 * `aria-valuemin`/`aria-valuemax` carry the meaning, so the band is rendered
 * `aria-hidden` by the component.
 */
export const logDrawerResizeRailVariants = cva(
  'h-full w-1.5 rounded-pill bg-border-hairline transition-colors duration-fast group-hover:bg-border-strong',
);

/**
 * Right gutter the open panel reserves for the handle, so the handle may ride
 * the panel edge without ever covering the header actions, the rows or the
 * footer button.
 */
export const LOG_DRAWER_HANDLE_GUTTER = 'pr-12';

/** Header row: title, total count, actions, then the filter chips. */
export const logDrawerHeaderVariants = cva(
  `flex flex-col gap-2 border-b border-hairline py-3 pl-4 ${LOG_DRAWER_HANDLE_GUTTER}`,
);

/** The only scroll container of the panel, so the footer stays reachable. */
export const logDrawerListVariants = cva(
  `flex-1 overflow-y-auto py-2 pl-2 ${LOG_DRAWER_HANDLE_GUTTER}`,
);

/** Footer holding the load-more control. */
export const logDrawerFooterVariants = cva(
  `border-t border-hairline py-3 pl-4 ${LOG_DRAWER_HANDLE_GUTTER}`,
);

/**
 * One filter chip.
 *
 * `selected` only styles the surface: the state itself is exposed through
 * `aria-pressed` on the `<button>`, so assistive technology does not depend on
 * the pressed shadow.
 */
export const logFilterChipVariants = cva(
  'rounded-pill border border-hairline px-2 py-1 text-xs font-medium transition-shadow duration-fast focus-visible:border-border-focus focus-visible:shadow-focus-ring focus-visible:outline-none',
  {
    variants: {
      selected: {
        true: 'bg-primary text-primary-foreground shadow-neu-pressed',
        false:
          'bg-surface-sunken text-text-secondary shadow-neu-inset hover:text-text-primary',
      },
    },
    defaultVariants: { selected: false },
  },
);

/**
 * One entry row.
 *
 * The severity is carried by the left accent border, exactly like `Toast` and
 * `Alert`; the row also renders the level as text, so colour is never the only
 * indicator.
 */
export const logEntryRowVariants = cva(
  'flex flex-col gap-1 rounded-control border border-hairline bg-surface-raised px-3 py-2',
  {
    variants: {
      level: {
        success: 'border-l-2 border-l-success',
        error: 'border-l-2 border-l-danger',
        warning: 'border-l-2 border-l-warning',
        info: 'border-l-2 border-l-info',
        system: 'border-l-2 border-l-border-strong',
      },
    },
    defaultVariants: { level: 'info' },
  },
);

/**
 * The expandable header band of one row (AIS-153).
 *
 * A full-width `<button>`, so the row is operable with `Enter`/`Space` and every
 * pointer user gets the same target. It intentionally wraps **only** the header
 * band — glyph, level, chevron and timestamp — while the message and the
 * one-line `detail` stay outside it: a long sentence inside a button makes the
 * whole row look pressable, and a nested button inside a button is invalid
 * HTML.
 *
 * The pressed/open state is not carried by colour alone: `aria-expanded` on the
 * element is the source of truth and the rotated chevron is the visual echo.
 */
export const logEntryToggleVariants = cva(
  'flex w-full items-center gap-2 rounded-control text-left transition-colors duration-fast focus-visible:border-border-focus focus-visible:shadow-focus-ring focus-visible:outline-none',
  {
    variants: {
      isOpen: {
        true: 'text-text-primary',
        false: 'text-text-secondary hover:text-text-primary',
      },
    },
    defaultVariants: { isOpen: false },
  },
);

/**
 * The chevron of the header band.
 *
 * A separate recipe only because a cva variant can style its **own** element,
 * not a child: the rotation is the visual half of `isOpen`, so it lives in a
 * variant instead of an inline conditional string. Rendered `aria-hidden` — the
 * accessible name of the header button already states the action.
 */
export const logEntryChevronVariants = cva(
  'size-3 shrink-0 transition-transform duration-fast',
  {
    variants: {
      isOpen: { true: 'rotate-180', false: 'rotate-0' },
    },
    defaultVariants: { isOpen: false },
  },
);

/**
 * The expandable detail region of one row (AIS-153).
 *
 * Separated from the header by a hairline, and **bounded**: `max-h-64` with
 * `overflow-y-auto` keeps a stack trace or a body prefix from stretching the
 * whole panel, and `whitespace-pre-wrap` + `break-words` preserve the line
 * structure of a dump without letting one long URL push the panel wider.
 */
export const logEntryDetailsVariants = cva(
  'mt-1 flex max-h-64 flex-col gap-2 overflow-y-auto border-t border-hairline pt-2 break-words whitespace-pre-wrap',
);

/**
 * One `dt`/`dd` pair of the detail region.
 *
 * `slot` decides whether the element is the term or the description, `mono`
 * switches the value to the monospaced recipe for ids, URLs and bodies. Both
 * are variants (not inline ternaries) so the two halves of a pair can never
 * drift apart.
 */
export const logDetailFieldVariants = cva('', {
  variants: {
    slot: {
      label: 'text-xs font-semibold tracking-wide text-text-muted uppercase',
      value: 'text-sm text-text-secondary',
    },
    mono: { true: 'font-mono text-xs', false: '' },
  },
  defaultVariants: { mono: false },
});

/**
 * The "expand JSON" control beside a detail value (AIS-163).
 *
 * Deliberately small and quiet — it sits inside a `dd`, next to the value it
 * expands, so it must not compete with the copy controls of the row. It is a
 * real `<button>`, so `Enter`/`Space` work and `aria-expanded` is announced.
 */
export const logDetailJsonToggleVariants = cva(
  'inline-flex items-center gap-1 rounded-control border border-hairline border-transparent bg-transparent px-1 text-xs text-text-muted transition-colors duration-fast hover:text-text-primary focus-visible:border-border-focus focus-visible:shadow-focus-ring focus-visible:outline-none',
);

/**
 * The pretty-printed JSON block of one detail value.
 *
 * Bounded (`max-h-48` + `overflow-auto`) and `whitespace-pre`, so a deep query
 * key or a long body scrolls inside the region instead of stretching the panel;
 * monospaced, because indentation is meaningless in a proportional font.
 */
export const logDetailJsonPreVariants = cva(
  'mt-1 w-full max-h-48 overflow-auto rounded-control bg-surface-sunken p-2 font-mono text-xs whitespace-pre',
);

export type LogEntryRowVariants = VariantProps<typeof logEntryRowVariants>;
export type LogFilterChipVariants = VariantProps<typeof logFilterChipVariants>;
export type LogEntryToggleVariants = VariantProps<
  typeof logEntryToggleVariants
>;
export type LogEntryChevronVariants = VariantProps<
  typeof logEntryChevronVariants
>;
export type LogDetailFieldVariants = VariantProps<
  typeof logDetailFieldVariants
>;
export type LogDetailJsonToggleVariants = VariantProps<
  typeof logDetailJsonToggleVariants
>;
export type LogDetailJsonPreVariants = VariantProps<
  typeof logDetailJsonPreVariants
>;
