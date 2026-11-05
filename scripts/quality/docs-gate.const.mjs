/**
 * Scope and vocabulary of the documentation gate (`pnpm quality:docs`).
 *
 * The gate keeps the "new admin page" process in one place
 * ([`docs/Specs/New-Admin-Page.md`](../../docs/Specs/New-Admin-Page.md), AIS-133):
 * the checklist is the truth source, three other documents only point at it, and
 * every relative link and `§N` section reference in the Specs must resolve.
 *
 * Data only — no I/O, no logic — so the decision code in
 * [`docs-gate.logic.mjs`](./docs-gate.logic.mjs) stays pure and testable.
 *
 * @module scripts/quality/docs-gate.const
 */

/** Directories scanned for the living-document rules (R1–R3). */
export const DOC_ROOTS = Object.freeze(['docs/Specs']);

/** File types that count as documentation. */
export const DOC_EXTENSIONS = Object.freeze(['.md']);

/**
 * Never scanned: dependency output, build artefacts and the archived specs.
 *
 * `docs/Specs/outdated/` is history — its headers and links are frozen, so
 * holding it to today's rules would only produce noise.
 */
export const DOC_IGNORE = Object.freeze([
  'node_modules',
  'coverage',
  'docs/Specs/outdated',
]);

/** The single, normative checklist of the "new admin page" process (AIS-133). */
export const NEW_PAGE_CHECKLIST = 'docs/Specs/New-Admin-Page.md';

/**
 * Documents whose `§N` references are checked (rule R2).
 *
 * The rule protects the documents of the admin-page process: these are the ones
 * that cross-reference each other by section number, and the ones whose drift
 * (a `§12` that no longer exists) silently misleads a reader. Legacy operational
 * runbooks keep their own numbering scheme and are out of scope in v1.
 */
export const SECTION_CHECKED_DOCS = Object.freeze([
  'docs/Specs/New-Admin-Page.md',
  'docs/Specs/UI-Architecture.md',
  'docs/Specs/Admin-Data-Flow.md',
  'docs/Specs/Forms-and-Validation.md',
  'docs/Specs/API-Convention.md',
]);

/**
 * Documents that must link the checklist (rule R4).
 *
 * These are the places a developer actually reads before starting a page; if one
 * of them stops pointing at the checklist, the old, partially wrong recipe grows
 * back in its place.
 */
export const POINTER_SOURCES = Object.freeze([
  '.roo/rules/react.coding-standards.md',
  'docs/Specs/UI-Architecture.md',
  'docs/Specs/Admin-Data-Flow.md',
]);

/** Every `docs/Specs` document must carry this header (rule R3). */
export const LAST_UPDATED_LABEL = 'Utolsó frissítés';

/** A header date must be ISO `YYYY-MM-DD` — `2026.11.04` is not a date here. */
export const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Any date-ish token, so a wrong separator is reported instead of "missing". */
export const DATE_TOKEN_PATTERN = /\d{4}[-./]\d{1,2}[-./]\d{1,2}/;

/** Rule names, used as the `[rule]` tag of every finding. */
export const DOC_RULES = Object.freeze({
  LINK: 'link-resolves',
  SECTION: 'section-exists',
  LAST_UPDATED: 'last-updated-header',
  POINTER: 'checklist-pointer',
});

/** Patterns that are never resolved against the filesystem. */
export const EXTERNAL_LINK_PREFIXES = Object.freeze([
  'http://',
  'https://',
  'mailto:',
  'tel:',
]);

/**
 * A fence line: optional indentation, then three or more backticks or tildes.
 *
 * Group 1 is the marker (` ``` `, `~~~`, ```` ```` ````), group 2 whatever follows
 * it — an info string when it opens a block, nothing when it closes one.
 */
export const FENCE_PATTERN = /^(\s*)(`{3,}|~{3,})(.*)$/;

/** `[label](target)` with an optional title. */
export const LINK_PATTERN = /\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;

/** `§6`, `§6.4`, `§3.1–3.7` — a single section or a range. */
export const SECTION_REF_PATTERN =
  /§\s*(\d+(?:\.\d+)*)(?:\s*[–-]\s*§?\s*(\d+(?:\.\d+)*))?/g;

/** `## 6. Title` / `### 6.4 Title` / `#### 7.` — the numeric prefix of a heading. */
export const HEADING_NUMBER_PATTERN = /^#{1,6}\s+(\d+(?:\.\d+)*)\.?(?:\s|$)/;
