/**
 * View model of one stored API key — what the table is allowed to render.
 *
 * It deliberately does **not** carry the `apiKey` token: the wire response
 * contains it, but nothing in the UI needs it, so it must not survive the
 * mapper (plan decision D33). Fields that need formatting are already strings,
 * so no component has to know the wire shape.
 */
export interface ApiKeyViewModel {
  /** DB-generated uuid — the React list key. */
  readonly id: string;
  /** Human readable name. */
  readonly name: string;
  /** Unique, URL-safe identifier. */
  readonly identifier: string;
  /** Description, or {@link EMPTY_VALUE_LABEL} when the key has none. */
  readonly description: string;
  /** Local calendar day of the expiry, or the “no expiry” label. */
  readonly expiresAtLabel: string;
}

/** View models of a whole list, newest first (the API order is preserved). */
export type ApiKeyViewModels = readonly ApiKeyViewModel[];

/**
 * The three expiry verdicts the detail page can show.
 *
 * Derived from `expiresAt` and the current clock — **not** a server field. The
 * backend stores a timestamp and nothing else, so inventing a `status` field
 * here would create a second source of truth.
 */
export type ApiKeyExpiryStatus = 'active' | 'expired' | 'none' | 'unknown';

/**
 * A ready-to-render `StatusBadge` model.
 *
 * `variant` is the subset of the `Badge` vocabulary the expiry verdict uses;
 * declaring it locally keeps the pure mapper free of a `@callback/ui` import
 * (the rules allow entities to describe, not to render).
 */
export interface ApiKeyExpiryBadge {
  /** Machine-readable verdict, rendered as `data-status`. */
  readonly status: ApiKeyExpiryStatus;
  /** Visible, already localised text. */
  readonly label: string;
  /** Visual verdict. */
  readonly variant: 'success' | 'warning' | 'neutral';
}

/**
 * View model of one key on the **detail** page (AIS-131).
 *
 * Extends the list view model's rules: the `apiKey` token is still dropped, and
 * every timestamp is already formatted. `expiry` is the badge model, so the page
 * renders a component instead of deciding a colour.
 */
export interface ApiKeyDetailViewModel {
  /** Human readable name. */
  readonly name: string;
  /** Unique, URL-safe identifier (read-only: it is the URL of the resource). */
  readonly identifier: string;
  /** Description, or {@link EMPTY_VALUE_LABEL} when the key has none. */
  readonly description: string;
  /** Local calendar day of the expiry, or the “no expiry” label. */
  readonly expiresAtLabel: string;
  /** Local timestamp of creation. */
  readonly createdAtLabel: string;
  /** Local timestamp of the last write — the value the next PATCH sends back. */
  readonly updatedAtLabel: string;
  /** The expiry verdict the `StatusBadge` shows. */
  readonly expiry: ApiKeyExpiryBadge;
}
