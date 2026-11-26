/**
 * Pure decision code of the palette gate.
 *
 * Takes already-read files and returns findings — no filesystem, no process
 * access — so every rule can be proven by a fixture in
 * [`palette-gate.test.mjs`](./palette-gate.test.mjs).
 *
 * @module scripts/quality/palette-gate.logic
 */

import { EXEMPT_LITERAL_FILES, PALETTE_RULES } from './palette-gate.const.mjs';

/**
 * Represents one finding (same shape as `report.mjs` produces).
 *
 * @typedef {object} PaletteViolation
 * @property {string} file - posix, repo-relative path.
 * @property {number} line - 1-based line number.
 * @property {string} rule - `no-arbitrary-colour` | `no-palette-utility` | `no-colour-literal`.
 * @property {string} snippet - the offending line.
 */

/**
 * Returns the findings for one file's text.
 *
 * @param {string} file - posix, repo-relative path (used for the exemption check).
 * @param {string} text - file contents.
 * @param {ReadonlyArray<string>} exemptLiteralFiles - files exempt from rule (a).
 * @returns {Array<PaletteViolation>} findings, at most one per line.
 */
function checkText(file, text, exemptLiteralFiles) {
  const literalExempt = exemptLiteralFiles.includes(file);
  /** @type {Array<PaletteViolation>} */
  const violations = [];

  text.split(/\r?\n/).forEach((line, index) => {
    for (const rule of PALETTE_RULES) {
      if (rule.exemptible && literalExempt) {
        continue;
      }

      if (!rule.pattern.test(line)) {
        continue;
      }

      violations.push({
        file,
        line: index + 1,
        rule: rule.rule,
        snippet: line,
      });

      return;
    }
  });

  return violations;
}

/**
 * Runs every palette rule over the given files.
 *
 * @param {ReadonlyArray<{ file: string, text: string }>} files - collected sources.
 * @param {object} [options] - overrides, used by the tests.
 * @param {ReadonlyArray<string>} [options.exemptLiteralFiles] - colour-literal exemptions.
 * @returns {Array<PaletteViolation>} all findings, file order preserved.
 */
export function checkPalette(
  files,
  { exemptLiteralFiles = EXEMPT_LITERAL_FILES } = {},
) {
  return files.flatMap(({ file, text }) =>
    checkText(file, text, exemptLiteralFiles),
  );
}
