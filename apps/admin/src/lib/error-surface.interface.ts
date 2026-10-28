/**
 * Types of the error-surface classifier (plan `D11`, tiers 2–3).
 *
 * The admin UI has exactly four places where a failure may become visible, and
 * each of them has one job:
 *
 * - `field`  — the input is wrong (RHF `setError`, AIS-95),
 * - `page`   — the page's own data is unavailable (`PageErrorState` + retry),
 * - `banner` — a persistent condition that outlives the page (`AppErrorBanner`),
 * - `silent` — the user cancelled the request; nothing to show.
 */

/** Where a thrown error has to be rendered. */
export type ErrorSurface = 'banner' | 'page' | 'field' | 'silent';

/**
 * The conditions the top banner can express.
 *
 * Kept separate from `ErrorSurface` because a `banner` may also come from the
 * browser (`offline`), not only from an API failure.
 */
export type BannerCondition = 'offline' | 'session-expired' | 'unavailable';

/** Visual severity of a banner. */
export type BannerVariant = 'warning' | 'danger';

/** One banner's fully resolved copy and severity. */
export interface BannerCopy {
  readonly variant: BannerVariant;
  readonly title: string;
  readonly message: string;
  /** Login CTA label, or `null` when the condition has no user action. */
  readonly actionLabel: string | null;
}

/** The banner the layout shell has to render right now. */
export interface BannerModel extends BannerCopy {
  readonly condition: BannerCondition;
  /** Accessible name of the close control. */
  readonly dismissLabel: string;
}

/** Result of `useAppErrorBanner`. */
export interface AppErrorBannerResult {
  /** `null` when there is nothing to show. */
  readonly model: BannerModel | null;
  /** Hides the current condition until it disappears and comes back. */
  readonly dismiss: () => void;
}

/**
 * Minimal structural view of an error-like object.
 *
 * Declared instead of an inline cast so `isAbortLike()` stays readable and the
 * `no inline types` rule holds.
 */
export interface NamedErrorLike {
  readonly name?: unknown;
}
