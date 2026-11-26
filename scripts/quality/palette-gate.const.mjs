/**
 * Rules and scope of the palette gate (`.roo/rules/react.coding-standards.md`
 * §7, restated in `docs/Specs/UI-Architecture.md` §3.3).
 *
 * Data only — no I/O, no logic — so the decision code in
 * [`palette-gate.logic.mjs`](./palette-gate.logic.mjs) stays pure and testable.
 *
 * @module scripts/quality/palette-gate.const
 */

/** Directories scanned for colour rules. */
export const PALETTE_ROOTS = Object.freeze([
  'apps/admin/src',
  'apps/web/src',
  'packages/ui/src',
]);

/** File types that can carry a colour. */
export const PALETTE_EXTENSIONS = Object.freeze(['.ts', '.tsx', '.css']);

/** Never scanned: dependency output and build artefacts. */
export const PALETTE_IGNORE = Object.freeze([
  'node_modules',
  'dist',
  'coverage',
]);

/**
 * The **only** file allowed to contain colour literals: it is the token source,
 * so a literal anywhere else means a component invented a colour.
 *
 * The exemption covers rule (a) only — a Tailwind palette utility inside this
 * file still fails, because a token file has no reason to use one.
 */
export const EXEMPT_LITERAL_FILES = Object.freeze([
  'packages/ui/src/styles/theme.css',
]);

/** Utilities that can take a colour. */
const COLOUR_UTILITY_PREFIXES = Object.freeze([
  'bg',
  'text',
  'border',
  'ring',
  'outline',
  'divide',
  'from',
  'via',
  'to',
  'fill',
  'stroke',
  'shadow',
  'accent',
  'caret',
  'decoration',
  'placeholder',
]);

/** Tailwind v4 palette families (each requires a shade, e.g. `-800`). */
const PALETTE_FAMILIES = Object.freeze([
  'slate',
  'gray',
  'zinc',
  'neutral',
  'stone',
  'red',
  'orange',
  'amber',
  'yellow',
  'lime',
  'green',
  'emerald',
  'teal',
  'cyan',
  'sky',
  'blue',
  'indigo',
  'violet',
  'purple',
  'fuchsia',
  'pink',
  'rose',
]);

/** Palette keywords that carry no shade. */
const PALETTE_KEYWORDS = Object.freeze(['white', 'black']);

const UTILITY_PREFIX = `(?:${COLOUR_UTILITY_PREFIXES.join('|')})`;
const FAMILY_WITH_SHADE = `(?:${PALETTE_FAMILIES.join('|')})-\\d{2,3}`;
const KEYWORD = `(?:${PALETTE_KEYWORDS.join('|')})`;

/**
 * Rule (a) — a colour literal (`#abc`, `rgba(…)`, `oklch(…)`, …).
 *
 * `#` followed by 3–8 hex characters is the CSS form; the functional notations
 * are matched by name. `theme.css` is exempt from **this rule only**.
 */
const COLOUR_LITERAL =
  /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?|oklch|lab|lch|color)\(/;

/**
 * Rule (b) — a Tailwind palette utility, including `text-white` / `bg-black`
 * and the `/50` opacity modifier. A shade is required for the numbered families
 * (`bg-slate-800`); a bare `bg-slate` is not a real Tailwind class.
 */
const PALETTE_UTILITY = new RegExp(
  `\\b${UTILITY_PREFIX}-(?:${FAMILY_WITH_SHADE}|${KEYWORD})(?:\\/\\d{1,3})?\\b`,
);

/**
 * Rule (c) — an arbitrary colour value (`bg-[#101010]`, `text-[rgb(0_0_0)]`).
 * Arbitrary **layout** values (`grid-cols-[2fr_1fr]`) stay legal, so the check
 * looks for a colour inside the brackets, not for the brackets themselves.
 */
const ARBITRARY_COLOUR = new RegExp(
  `\\b${UTILITY_PREFIX}-\\[[^\\]\\n]*(?:#|rgba?\\(|hsla?\\(|oklch\\(|lab\\(|lch\\()[^\\]\\n]*\\]`,
);

/**
 * Ordered rule list. The order is the reporting priority: a line produces at
 * most one finding, and the most specific rule wins.
 *
 * @type {ReadonlyArray<{ rule: string, pattern: RegExp, exemptible: boolean }>}
 */
export const PALETTE_RULES = Object.freeze([
  { rule: 'no-arbitrary-colour', pattern: ARBITRARY_COLOUR, exemptible: false },
  { rule: 'no-palette-utility', pattern: PALETTE_UTILITY, exemptible: false },
  { rule: 'no-colour-literal', pattern: COLOUR_LITERAL, exemptible: true },
]);
