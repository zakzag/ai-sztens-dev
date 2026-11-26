/**
 * Presentation constants of the `api-key` entity.
 *
 * They live here (not in the mapper) so the placeholders are greppable and can
 * be changed without touching the pure mapping logic.
 */

/**
 * Rendered instead of an absent optional value.
 *
 * An em dash rather than an empty cell: “no description” and “the cell failed
 * to render” must not look the same in a table.
 */
export const EMPTY_VALUE_LABEL = '—';

/** Expiry verdict texts of the detail page's `StatusBadge` (AIS-131). */
export const EXPIRY_ACTIVE_LABEL = 'érvényes';
export const EXPIRY_EXPIRED_LABEL = 'lejárt';
export const EXPIRY_NONE_LABEL = 'nincs lejárat';
