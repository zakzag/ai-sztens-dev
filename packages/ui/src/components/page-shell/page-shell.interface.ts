import type { ReactNode } from 'react';

/**
 * Props of {@link PageShell}.
 *
 * The shell owns the *frame* of a route-level page — background-free section,
 * header row, one `h1`, optional subtitle — and nothing else. Everything that
 * describes the page's content arrives through `children`; everything that
 * navigates or acts arrives through a **slot**.
 *
 * `back` and `actions` are `ReactNode`, not strings or URLs, because this
 * package must not know react-router (AIS-171 `D2`): the page injects its own
 * `Link`, the same way {@link Breadcrumb} takes a `renderLink` callback.
 */
export interface PageShellProps {
  /**
   * The page title.
   *
   * Rendered as the page's **only** `h1`; a page that puts a second `h1` into
   * `children` breaks the heading outline, which is why the caller renders
   * section headings as `h2` (`Card` already does).
   */
  readonly title: string;
  /** Optional one-line explanation under the title. */
  readonly subtitle?: string;
  /**
   * Optional slot rendered **above** the title — typically an injected
   * `<Link>` back to the list ("← Vissza az API kulcsokhoz").
   */
  readonly back?: ReactNode;
  /** Optional slot rendered at the **right** end of the header row (a primary action). */
  readonly actions?: ReactNode;
  /** Page content, rendered under the header. */
  readonly children: ReactNode;
}
