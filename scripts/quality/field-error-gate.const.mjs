/**
 * Rules, allowlist and scope of the field-error gate
 * (`.roo/rules/react.coding-standards.md` §5 + §9, and
 * `docs/Specs/UI-Architecture.md` §4.1).
 *
 * The rule is not "never inspect an error" — it is "inspect it **once**, in a
 * pure decision function". Every entry of {@link FIELD_ERROR_ALLOWLIST} is such
 * a function; everything else must consume its result (`errorSurface`,
 * `errorMessage`, field errors) instead of branching on `status` / `code`.
 *
 * @module scripts/quality/field-error-gate.const
 */

/** Directories scanned for the field-error rules. */
export const FIELD_ERROR_ROOTS = Object.freeze([
  'apps/admin/src',
  'apps/web/src',
]);

/** File types that can branch on an error. */
export const FIELD_ERROR_EXTENSIONS = Object.freeze(['.ts', '.tsx']);

/** Never scanned: dependency output and build artefacts. */
export const FIELD_ERROR_IGNORE = Object.freeze([
  'node_modules',
  'dist',
  'coverage',
]);

/**
 * Ordered rule list. A line produces at most one finding; the first matching
 * rule wins, so a `error.code === …` line is reported once as
 * `no-error-code-comparison` instead of twice.
 *
 * @type {ReadonlyArray<{ rule: string, pattern: RegExp }>}
 */
export const FIELD_ERROR_RULES = Object.freeze([
  {
    rule: 'no-error-status-comparison',
    pattern: /\berror\.status\s*(?:===|!==)/,
  },
  { rule: 'no-error-code-comparison', pattern: /\berror\.code\s*(?:===|!==)/ },
  { rule: 'no-api-error-instanceof', pattern: /\binstanceof\s+ApiError\b/ },
  { rule: 'no-code-comparison', pattern: /\.code\s*===/ },
]);

/**
 * The files allowed to branch on an error — the pure decision functions.
 *
 * `*.logic.ts` is the general form (that is what §5 asks for); the two extra
 * entries are the pre-existing decision files that predate the `.logic.ts`
 * naming: `lib/error-surface.logic.ts` matches both, `lib/error-message.ts` is
 * a message mapper registered here explicitly.
 */
export const FIELD_ERROR_ALLOWLIST = Object.freeze([
  'apps/*/src/lib/error-surface.logic.ts',
  'apps/*/src/lib/error-message.ts',
  'apps/*/src/**/*.logic.ts',
]);

/**
 * Excluded paths — test code asserts on errors on purpose, so it is out of
 * scope of the production-code rule.
 */
export const FIELD_ERROR_EXCLUDE = Object.freeze([
  '**/*.test.ts',
  '**/*.test.tsx',
  'apps/*/src/test/**',
]);
