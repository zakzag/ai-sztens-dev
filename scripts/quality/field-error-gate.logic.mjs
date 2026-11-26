/**
 * Pure decision code of the field-error gate.
 *
 * Takes already-read files and returns findings — no filesystem, no process
 * access — so every rule, the allowlist and the test-code exclusion can be
 * proven by fixtures in
 * [`field-error-gate.test.mjs`](./field-error-gate.test.mjs).
 *
 * @module scripts/quality/field-error-gate.logic
 */

import {
  FIELD_ERROR_ALLOWLIST,
  FIELD_ERROR_EXCLUDE,
  FIELD_ERROR_RULES,
} from './field-error-gate.const.mjs';
import { matchesAnyGlob } from './glob.mjs';

/**
 * Represents one finding (same shape as `report.mjs` produces).
 *
 * @typedef {object} FieldErrorViolation
 * @property {string} file - posix, repo-relative path.
 * @property {number} line - 1-based line number.
 * @property {string} rule - one of the `FIELD_ERROR_RULES` names.
 * @property {string} snippet - the offending line.
 */

/**
 * Tells whether a file is inside the scope of the rule.
 *
 * Excluded (test) paths win over the allowlist, so a `*.logic.test.ts` file is
 * never considered allowed just because its name contains `.logic`.
 *
 * @param {string} file - posix, repo-relative path.
 * @param {ReadonlyArray<string>} allowlist - glob patterns that are allowed to branch on an error.
 * @param {ReadonlyArray<string>} exclude - glob patterns that are out of scope.
 * @returns {boolean} `true` when the file must be scanned.
 */
export function isInScope(file, allowlist, exclude) {
  if (matchesAnyGlob(file, exclude)) {
    return false;
  }

  return !matchesAnyGlob(file, allowlist);
}

/**
 * Returns the findings for one file's text.
 *
 * @param {string} file - posix, repo-relative path.
 * @param {string} text - file contents.
 * @returns {Array<FieldErrorViolation>} findings, at most one per line.
 */
function checkText(file, text) {
  /** @type {Array<FieldErrorViolation>} */
  const violations = [];

  text.split(/\r?\n/).forEach((line, index) => {
    const matched = FIELD_ERROR_RULES.find((rule) => rule.pattern.test(line));

    if (matched === undefined) {
      return;
    }

    violations.push({
      file,
      line: index + 1,
      rule: matched.rule,
      snippet: line,
    });
  });

  return violations;
}

/**
 * Runs the field-error rules over the given files.
 *
 * @param {ReadonlyArray<{ file: string, text: string }>} files - collected sources.
 * @param {object} [options] - overrides, used by the tests.
 * @param {ReadonlyArray<string>} [options.allowlist] - files allowed to branch on an error.
 * @param {ReadonlyArray<string>} [options.exclude] - paths that are out of scope.
 * @returns {Array<FieldErrorViolation>} all findings, file order preserved.
 */
export function checkFieldErrors(
  files,
  { allowlist = FIELD_ERROR_ALLOWLIST, exclude = FIELD_ERROR_EXCLUDE } = {},
) {
  return files
    .filter(({ file }) => isInScope(file, allowlist, exclude))
    .flatMap(({ file, text }) => checkText(file, text));
}
