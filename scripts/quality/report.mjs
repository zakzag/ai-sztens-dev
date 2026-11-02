/**
 * Violation formatting and the process exit contract shared by every gate.
 *
 * A gate is only useful if the red CI step names the file, the line and the
 * rule — that is what `formatViolation` produces. The exit behaviour lives here
 * too, so all four gates fail in exactly the same way.
 *
 * @module scripts/quality/report
 */

/** Longest snippet printed per violation; the rest is truncated with `…`→`...`. */
export const SNIPPET_MAX_LENGTH = 160;

/**
 * Represents one gate finding.
 *
 * @typedef {object} Violation
 * @property {string} file - posix, repo-relative path.
 * @property {number} line - 1-based line number.
 * @property {string} rule - the rule that produced the finding.
 * @property {string} [snippet] - offending line (or matched text), trimmed.
 */

/**
 * Collapses a snippet onto one printable line of bounded length.
 *
 * @param {string} [snippet] - raw snippet.
 * @returns {string} single-line snippet, at most {@link SNIPPET_MAX_LENGTH} characters.
 */
export function normalizeSnippet(snippet) {
  const singleLine = (snippet ?? '').replace(/\s+/g, ' ').trim();

  return singleLine.length > SNIPPET_MAX_LENGTH
    ? `${singleLine.slice(0, SNIPPET_MAX_LENGTH - 3)}...`
    : singleLine;
}

/**
 * Formats one finding as `file:line: [rule] snippet`.
 *
 * @param {Violation} violation - the finding to format.
 * @returns {string} printable line.
 */
export function formatViolation({ file, line, rule, snippet }) {
  const suffix =
    snippet === undefined || snippet.trim() === ''
      ? ''
      : ` ${normalizeSnippet(snippet)}`;

  return `${file}:${line}: [${rule}]${suffix}`;
}

/**
 * Formats every finding, preserving the order it was found in.
 *
 * @param {ReadonlyArray<Violation>} violations - findings to format.
 * @returns {Array<string>} printable lines.
 */
export function formatViolations(violations) {
  return violations.map(formatViolation);
}

/**
 * Sink used by {@link exitWith}; injectable so tests never terminate the runner.
 *
 * @typedef {object} ReportIo
 * @property {(message: string) => void} log - stdout writer (progress / summary).
 * @property {(message: string) => void} error - stderr writer (the findings).
 * @property {(code: number) => void} exit - process terminator.
 */

/**
 * Builds the default sink around the real process.
 *
 * @returns {ReportIo} sink writing to `process.stdout` / `process.stderr`.
 */
export function createProcessIo() {
  return {
    log: (message) => process.stdout.write(`${message}\n`),
    error: (message) => process.stderr.write(`${message}\n`),
    exit: (code) => process.exit(code),
  };
}

/**
 * Prints the findings and terminates with exit code 1 when there is any.
 *
 * @param {ReadonlyArray<Violation>} violations - findings of this gate.
 * @param {string} label - gate name shown in the summary line.
 * @param {ReportIo} [io] - sink, defaults to the real process.
 * @returns {number} the exit code (`0` when clean) — returned for tests only.
 */
export function exitWith(violations, label, io = createProcessIo()) {
  if (violations.length === 0) {
    io.log(`OK ${label}: 0 violations`);

    return 0;
  }

  io.log(`FAIL ${label}: ${violations.length} violation(s)`);

  for (const line of formatViolations(violations)) {
    io.error(line);
  }

  io.exit(1);

  return 1;
}
