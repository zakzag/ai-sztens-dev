/**
 * Build metadata helpers — SHARED by the `web` and `admin` SPAs.
 *
 * `VITE_DEPLOY_DATE` and `VITE_COMMIT_HASH` are baked into each JS bundle at
 * image build time by [`.github/workflows/images.yml`](../../../../.github/workflows/images.yml)
 * (build args → [`infra/web/Dockerfile`](../../../../infra/web/Dockerfile) and
 * [`infra/admin/Dockerfile`](../../../../infra/admin/Dockerfile)). Local runs
 * (`vite`, `scripts/dev-stack.sh up`) do not pass them, so every helper here
 * must degrade gracefully instead of throwing or rendering `undefined` /
 * `Invalid Date`.
 *
 * This module is framework-free (no React import) and has no `import.meta.env`
 * reference: each SPA reads its own Vite env and passes plain strings in, which
 * keeps the logic pure and unit-testable from Node.
 */

/** Placeholder rendered when a build variable was not injected. */
export const UNKNOWN_BUILD_VALUE = '—';

/**
 * Normalises an injected build variable.
 *
 * Vite substitutes an unset build arg with an empty string (not `undefined`),
 * which would otherwise render as a blank gap in the UI — so empty/whitespace
 * values collapse to `null`.
 */
export function normalizeBuildValue(
  value: string | null | undefined,
): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/**
 * Humanises the injected ISO 8601 UTC build timestamp.
 *
 * Returns [`UNKNOWN_BUILD_VALUE`](packages/shared/src/lib/build-info.ts:21) when
 * the value is missing or unparseable, and falls back to the raw string when
 * the date is valid but cannot be formatted by the current locale.
 *
 * @param value - normalised build timestamp (`null` when not injected)
 * @param locale - BCP 47 locale tag; defaults to the product locale (`hu-HU`)
 */
export function formatDeployDate(
  value: string | null,
  locale = 'hu-HU',
): string {
  if (value === null) {
    return UNKNOWN_BUILD_VALUE;
  }

  const epochMs = Date.parse(value);
  if (Number.isNaN(epochMs)) {
    return value;
  }

  try {
    return new Date(epochMs).toLocaleString(locale);
  } catch {
    // Defensive: a broken Intl environment must not blank the whole page.
    return value;
  }
}

/** Renders the full commit SHA, or the placeholder when it was not injected. */
export function formatCommitHash(value: string | null): string {
  return value ?? UNKNOWN_BUILD_VALUE;
}
