/**
 * Pure decision code of the appearance-token gate (AIS-168).
 *
 * Takes already-read CSS text and returns findings — no filesystem, no process
 * access — so every branch can be proven by a small string in
 * [`theme-tokens.logic.test.mjs`](./theme-tokens.logic.test.mjs).
 *
 * @module scripts/quality/theme-tokens.logic
 */

import {
  THEME_BLOCK_SELECTOR_PREFIX,
  THEME_DEFAULT_SELECTOR,
  THEME_RULES,
  THEME_STATE_TOKENS,
} from './theme-tokens.const.mjs';

/**
 * Represents one finding (same shape as `report.mjs` produces).
 *
 * @typedef {object} ThemeTokenViolation
 * @property {string} file - posix, repo-relative path.
 * @property {number} line - 1-based line of the offending block.
 * @property {string} rule - one of {@link THEME_RULES}.
 * @property {string} snippet - the selector (or token) that caused it.
 */

/**
 * Represents one top-level CSS block.
 *
 * @typedef {object} CssBlock
 * @property {string} selector - text before the opening brace, trimmed.
 * @property {string} body - text between the braces.
 * @property {number} line - 1-based line the block starts on.
 */

/**
 * Blanks out CSS comments while keeping every newline.
 *
 * The token file documents itself with comments that *quote* selectors
 * (`:root[data-theme="…"]`), so parsing the raw text would invent blocks that do
 * not exist. Newlines are preserved so reported line numbers stay true.
 *
 * @param {string} css - raw stylesheet text.
 * @returns {string} the same text with comment bodies replaced by spaces.
 */
export function stripCssComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, (comment) =>
    comment.replace(/[^\n]/g, ' '),
  );
}

/**
 * Collects the **top-level** blocks of a stylesheet.
 *
 * Only depth-0 blocks are returned, which is exactly what the gate needs: an
 * appearance block nested in an at-rule (the readability fallbacks) is a
 * refinement of an appearance, not an appearance of its own, so it must not be
 * compared against the default set.
 *
 * Statements that end in `;` outside a block (`@import`, `@source`) are skipped.
 *
 * @param {string} css - stylesheet text, comments already stripped.
 * @returns {Array<CssBlock>} the top-level blocks in source order.
 */
export function findTopLevelBlocks(css) {
  /** @type {Array<CssBlock>} */
  const blocks = [];
  let depth = 0;
  let line = 1;
  let selectorStart = 0;
  /** @type {{ selector: string, bodyStart: number, line: number } | null} */
  let open = null;

  for (let index = 0; index < css.length; index += 1) {
    const character = css[index];

    if (character === '\n') {
      line += 1;
      continue;
    }

    if (character === '{') {
      if (depth === 0) {
        open = {
          selector: css.slice(selectorStart, index).trim(),
          bodyStart: index + 1,
          line,
        };
      }

      depth += 1;
      continue;
    }

    if (character === '}') {
      depth -= 1;

      if (depth === 0 && open !== null) {
        blocks.push({
          selector: open.selector,
          body: css.slice(open.bodyStart, index),
          line: open.line,
        });
        open = null;
        selectorStart = index + 1;
      }

      continue;
    }

    if (character === ';' && depth === 0) {
      selectorStart = index + 1;
    }
  }

  return blocks;
}

/**
 * Reads the custom properties a block declares.
 *
 * @param {string} body - block body.
 * @returns {Set<string>} the declared names, e.g. `--color-primary`.
 */
export function collectTokenNames(body) {
  const names = new Set();

  for (const match of body.matchAll(/(--[a-z0-9-]+)\s*:/g)) {
    names.add(match[1]);
  }

  return names;
}

/**
 * Compares every appearance block against the default (`@theme`) token set.
 *
 * @param {string} file - posix, repo-relative path, echoed on every finding.
 * @param {string} text - the token file's contents.
 * @returns {Array<ThemeTokenViolation>} findings, in source order.
 */
export function checkThemeTokens(file, text) {
  const blocks = findTopLevelBlocks(stripCssComments(text));

  /** @type {Array<ThemeTokenViolation>} */
  const violations = [];
  const defaults = blocks.find(
    (block) => block.selector === THEME_DEFAULT_SELECTOR,
  );

  if (defaults === undefined) {
    violations.push({
      file,
      line: 1,
      rule: THEME_RULES.defaultMissing,
      snippet: THEME_DEFAULT_SELECTOR,
    });

    return violations;
  }

  const defaultTokens = collectTokenNames(defaults.body);
  const appearances = blocks.filter((block) =>
    block.selector.startsWith(THEME_BLOCK_SELECTOR_PREFIX),
  );

  if (appearances.length === 0) {
    violations.push({
      file,
      line: defaults.line,
      rule: THEME_RULES.blockMissing,
      snippet: THEME_BLOCK_SELECTOR_PREFIX,
    });
  }

  for (const appearance of appearances) {
    const tokens = collectTokenNames(appearance.body);

    if (tokens.size === 0) {
      violations.push({
        file,
        line: appearance.line,
        rule: THEME_RULES.blockEmpty,
        snippet: appearance.selector,
      });

      continue;
    }

    for (const missing of defaultTokens) {
      if (!tokens.has(missing)) {
        violations.push({
          file,
          line: appearance.line,
          rule: THEME_RULES.tokenMissing,
          snippet: `${appearance.selector} ${missing}`,
        });
      }
    }

    for (const declared of tokens) {
      if (!defaultTokens.has(declared) && !THEME_STATE_TOKENS.includes(declared)) {
        violations.push({
          file,
          line: appearance.line,
          rule: THEME_RULES.tokenUnknown,
          snippet: `${appearance.selector} ${declared}`,
        });
      }
    }
  }

  return violations;
}

/**
 * Runs the gate over already-read files.
 *
 * @param {ReadonlyArray<{ file: string, text: string }>} files - collected sources.
 * @returns {Array<ThemeTokenViolation>} all findings, file order preserved.
 */
export function checkThemeFiles(files) {
  return files.flatMap(({ file, text }) => checkThemeTokens(file, text));
}
