/**
 * The four numbers a pager needs.
 *
 * **Decision D1 (AIS-116):** this shape is declared *structurally* (`packages/ui`
 * must not depend on `@callback/shared`), so the API's `meta.pagination` is
 * assignable to it without any mapping code. The consumer's compiler enforces the
 * match — four fields are not worth coupling the UI package to the wire contract.
 */
export interface PaginationMeta {
  /** 1-based index of the page being shown. */
  readonly page: number;
  /** Page size the current page was requested with. */
  readonly limit: number;
  /** Total number of rows across every page. */
  readonly total: number;
  /** Number of pages; `0` when the result set is empty. */
  readonly totalPages: number;
}

/**
 * Props of {@link Pagination}.
 *
 * The component never owns the page: it reports intent (`onPageChange`,
 * `onLimitChange`) and re-renders from `meta`. The URL stays the source of truth
 * — see `docs/Specs/Admin-Data-Flow.md`.
 */
export interface PaginationProps {
  /** The pager block of the current response. */
  readonly meta: PaginationMeta;
  /** Requested page (1-based). */
  readonly onPageChange: (page: number) => void;
  /** Requested page size; without it the limit selector is not rendered. */
  readonly onLimitChange?: (limit: number) => void;
  /** Selectable page sizes; required for the selector to appear. */
  readonly limitOptions?: readonly number[];
  /** Accessible name of the `<nav>`; defaults to {@link PAGINATION_DEFAULT_ARIA_LABEL}. */
  readonly ariaLabel?: string;
  /** Extra classes merged onto the `<nav>`. */
  readonly className?: string;
}

/**
 * Props of the number/prev/next part of the pager.
 *
 * Extracted so `Pagination` stays composition and the button list keeps one
 * responsibility (it renders controls, it computes nothing).
 */
export interface PaginationPagesProps {
  /** Page numbers to render, ascending (already windowed by the logic). */
  readonly pages: readonly number[];
  /** The page currently shown; drives `aria-current`. */
  readonly page: number;
  /** Disables the “previous” control. */
  readonly isFirstPage: boolean;
  /** Disables the “next” control. */
  readonly isLastPage: boolean;
  /** Reported page request. */
  readonly onPageChange: (page: number) => void;
}

/** Props of the page-size selector. */
export interface PaginationLimitSelectorProps {
  /** The page size of the current response. */
  readonly limit: number;
  /** The selectable page sizes. */
  readonly options: readonly number[];
  /** Reported page-size request. */
  readonly onLimitChange: (limit: number) => void;
}
