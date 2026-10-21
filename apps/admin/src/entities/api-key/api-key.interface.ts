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
