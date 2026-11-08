/**
 * Rules and scope of the appearance-token gate (AIS-168).
 *
 * Data only — no I/O, no logic — so the decision code in
 * [`theme-tokens.logic.mjs`](./theme-tokens.logic.mjs) stays pure and testable.
 *
 * The gate exists because the token file now holds **four** appearances
 * (`.roo/rules/react.coding-standards.md` §7, `docs/Specs/UI-Architecture.md`
 * §3.2.2). A block that forgets one colour does not fail loudly at runtime — it
 * silently inherits the dark value, which reads as a design bug nobody can
 * trace. Comparing the *names* keeps the values free: a theme may tune any
 * appearance it likes, it just cannot drop a token.
 *
 * @module scripts/quality/theme-tokens.const
 */

/** The only file the appearances live in. */
export const THEME_TOKENS_FILE = 'packages/ui/src/styles/theme.css';

/** Selector of the block the default appearance (dark) is declared in. */
export const THEME_DEFAULT_SELECTOR = '@theme';

/** Prefix of an appearance block: `:root[data-theme="light"]`, … */
export const THEME_BLOCK_SELECTOR_PREFIX = ':root[data-theme=';

/**
 * Plain `:root` tokens an appearance block may also set.
 *
 * They cannot live in `@theme` (Tailwind would read `--color-scheme` as a colour
 * named "scheme"), so they are not part of the default set — but every
 * appearance is expected to be able to restate them.
 *
 * The three border widths are here because *thickness is appearance state*, not a
 * Tailwind theme value: the glass family widens the frame to 2 / 2.5 / 3px
 * while the opaque appearances keep the 1 / 1.5 / 2px ladder from `:root`.
 * Listing them makes that override legal without making it mandatory —
 * an appearance that does not restate them simply inherits the ladder.
 */
export const THEME_STATE_TOKENS = Object.freeze([
  '--color-scheme',
  '--app-backdrop',
  '--blur-glass',
  '--saturate-glass',
  '--glass-sheen',
  '--border-width-hairline',
  '--border-width-default',
  '--border-width-strong',
]);

/** Rule ids, in reporting priority order. */
export const THEME_RULES = Object.freeze({
  /** No `@theme` block at all — the default appearance is missing. */
  defaultMissing: 'theme-default-missing',
  /** No appearance block at all. */
  blockMissing: 'theme-block-missing',
  /** An appearance block declares no token. */
  blockEmpty: 'theme-block-empty',
  /** An appearance block misses a token the default declares. */
  tokenMissing: 'theme-token-missing',
  /** An appearance block declares a token the default does not. */
  tokenUnknown: 'theme-token-unknown',
});
