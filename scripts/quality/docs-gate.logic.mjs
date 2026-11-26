/**
 * Pure decision code of the documentation gate.
 *
 * Takes already-read markdown and returns findings — no filesystem, no process
 * access. The only outside knowledge is the injected `readText`, so every rule
 * and every edge case is provable by fixtures in
 * [`docs-gate.test.mjs`](./docs-gate.test.mjs).
 *
 * The four rules are deliberately syntactic:
 *
 * - **R1 `link-resolves`** — every relative markdown link points at a real path
 *   (file or directory) on disk;
 * - **R2 `section-exists`** — a `§N` / `§N.M` reference that sits on the same
 *   line as a document link names a heading that exists in that document (or in
 *   the current one);
 * - **R3 `last-updated-header`** — a living document carries
 *   `**Utolsó frissítés:** YYYY-MM-DD`;
 * - **R4 `checklist-pointer`** — each pointer document still links the checklist.
 *
 * Two limits are deliberate (AIS-133 v1): whether a reference points at the
 * *semantically* right section is not checked — a gate that guessed would be
 * wrong often enough to be ignored — and a bare `§N` in prose, without a link on
 * the same line, is not checked either, because its target document is ambiguous.
 *
 * @module scripts/quality/docs-gate.logic
 */

import { posix } from 'node:path';

import {
  DATE_TOKEN_PATTERN,
  DOC_RULES,
  EXTERNAL_LINK_PREFIXES,
  FENCE_PATTERN,
  HEADING_NUMBER_PATTERN,
  ISO_DATE_PATTERN,
  LAST_UPDATED_LABEL,
  LINK_PATTERN,
  NEW_PAGE_CHECKLIST,
  SECTION_REF_PATTERN,
} from './docs-gate.const.mjs';

/**
 * Represents one finding (same shape as `report.mjs` produces).
 *
 * @typedef {object} DocsViolation
 * @property {string} file - posix, repo-relative path.
 * @property {number} line - 1-based line number.
 * @property {string} rule - one of the `DOC_RULES` names.
 * @property {string} [snippet] - the offending text.
 */

/**
 * Represents one read markdown file.
 *
 * @typedef {object} DocsFile
 * @property {string} file - posix, repo-relative path.
 * @property {string} text - file contents.
 */

/**
 * Splits a markdown document into lines.
 *
 * @param {string} text - file contents.
 * @returns {Array<string>} lines without their terminators.
 */
function toLines(text) {
  return text.split(/\r?\n/);
}

/**
 * Blanks out everything inside a fenced code block, keeping the line count.
 *
 * Line numbers must stay usable in the report, so a fenced line becomes an empty
 * line instead of disappearing. Without this, an example link inside the
 * checklist would be resolved as if it were real.
 *
 * @param {string} text - file contents.
 * @returns {string} the same document with fenced lines emptied.
 */
export function stripFencedBlocks(text) {
  /** @type {{ char: string, length: number } | null} */
  let fence = null;

  return toLines(text)
    .map((line) => {
      const match = FENCE_PATTERN.exec(line);

      if (match === null) {
        return fence === null ? line : '';
      }

      const marker = match[2];

      if (fence === null) {
        fence = { char: marker[0], length: marker.length };

        return '';
      }

      // Only the matching character, at least as long, closes the block: a
      // shorter fence inside a ```` example is content, not the end.
      if (
        marker[0] === fence.char &&
        marker.length >= fence.length &&
        match[3].trim() === ''
      ) {
        fence = null;
      }

      return '';
    })
    .join('\n');
}

/**
 * Extracts `[label](target)` occurrences of one line.
 *
 * @param {string} line - one markdown line.
 * @returns {Array<string>} the raw link targets, in source order.
 */
function linkTargetsOf(line) {
  const pattern = new RegExp(LINK_PATTERN.source, 'g');
  const targets = [];

  for (const match of line.matchAll(pattern)) {
    targets.push(match[1]);
  }

  return targets;
}

/**
 * Extracts every link target of a document, with its line number.
 *
 * @param {string} text - file contents (fenced blocks already stripped).
 * @returns {Array<{ line: number, target: string }>} one entry per link.
 */
export function extractLinkTargets(text) {
  return toLines(text).flatMap((line, index) =>
    linkTargetsOf(line).map((target) => ({ line: index + 1, target })),
  );
}

/**
 * Parses a link target into the parts the gate cares about.
 *
 * @param {string} target - raw target, e.g. `../Specs/X.md:12#anchor`.
 * @returns {{ path: string, anchor: string } | null} `null` for an external link,
 *   `{ path: '' }` for a pure in-page anchor, otherwise the file part without the
 *   `:line` suffix and without the `#anchor`.
 */
export function splitLinkTarget(target) {
  if (EXTERNAL_LINK_PREFIXES.some((prefix) => target.startsWith(prefix))) {
    return null;
  }

  const [pathWithLine, anchor = ''] = target.split('#');
  const path = pathWithLine.replace(/:\d+(?:-\d+)?$/, '');

  return { path, anchor };
}

/**
 * Resolves a relative link against the linking document.
 *
 * @param {string} fromFile - posix, repo-relative path of the linking document.
 * @param {string} rawPath - the link's file part (posix or backslash separated).
 * @returns {string} posix, repo-relative path of the target.
 */
export function resolveTarget(fromFile, rawPath) {
  const normalized = rawPath.replaceAll('\\', '/');
  const base = posix.dirname(fromFile);

  // A directory link may end with `/`; the probe must not care.
  return posix.normalize(posix.join(base, normalized)).replace(/\/$/, '');
}

/**
 * Collects the numeric prefixes of every heading in a document.
 *
 * @param {string} text - file contents.
 * @returns {Set<string>} numbers such as `6`, `6.4`, `9.5.1`.
 */
export function extractHeadingNumbers(text) {
  const numbers = new Set();

  for (const line of toLines(stripFencedBlocks(text))) {
    const match = HEADING_NUMBER_PATTERN.exec(line);

    if (match !== null) {
      numbers.add(match[1]);
    }
  }

  return numbers;
}

/**
 * Extracts the `§N` / `§N.M` references of one line, ranges included.
 *
 * @param {string} line - one markdown line.
 * @returns {Array<string>} section numbers, e.g. `['3.1', '3.7']` for `§3.1–3.7`.
 */
export function extractSectionRefs(line) {
  const pattern = new RegExp(SECTION_REF_PATTERN.source, 'g');
  const numbers = [];

  for (const match of line.matchAll(pattern)) {
    numbers.push(match[1]);

    if (match[2] !== undefined) {
      numbers.push(match[2]);
    }
  }

  return numbers;
}

/**
 * Builds the memoised lookup used by the section rule.
 *
 * @param {{ readText: (file: string) => string | null }} io - injected reader.
 * @returns {{ headingsOf: (file: string) => Set<string> | null }} cached heading sets;
 *   `null` means the file could not be read (rule R1 already reported it).
 */
function createHeadingCache(io) {
  const cache = new Map();

  return {
    headingsOf(file) {
      if (!cache.has(file)) {
        const text = io.readText(file);

        cache.set(file, text === null ? null : extractHeadingNumbers(text));
      }

      return cache.get(file);
    },
  };
}

/**
 * Tells whether a section number exists in a document.
 *
 * @param {object} args - lookup inputs.
 * @param {Set<string>} args.currentHeadings - headings of the scanned document.
 * @param {string} args.currentFile - path of the scanned document.
 * @param {string} args.document - path of the document to look in.
 * @param {string} args.number - section number, e.g. `6.4`.
 * @param {{ headingsOf: (file: string) => Set<string> | null }} args.cache - heading cache.
 * @returns {boolean | null} `null` when the document is unreadable.
 */
function sectionExists({
  currentHeadings,
  currentFile,
  document,
  number,
  cache,
}) {
  if (document === currentFile) {
    return currentHeadings.has(number);
  }

  const headings = cache.headingsOf(document);

  return headings === null ? null : headings.has(number);
}

/**
 * Rule R1 — every relative link resolves to an existing path.
 *
 * A link may point at a directory (`../../infra/postgres/init/`), so the check
 * uses the injected `exists`, not the text reader.
 *
 * @param {DocsFile} args - the scanned document.
 * @param {{ exists: (file: string) => boolean }} args.io - injected path probe.
 * @returns {Array<DocsViolation>} one finding per broken link.
 */
export function checkLinks({ file, text }, io) {
  return extractLinkTargets(stripFencedBlocks(text))
    .map(({ line, target }) => ({
      line,
      target,
      parsed: splitLinkTarget(target),
    }))
    .filter(({ parsed }) => parsed !== null && parsed.path !== '')
    .filter(({ parsed }) => !io.exists(resolveTarget(file, parsed.path)))
    .map(({ line, target }) => ({
      file,
      line,
      rule: DOC_RULES.LINK,
      snippet: target,
    }));
}

/**
 * Rule R2 — a `§N` reference on a line with a document link must exist.
 *
 * The link on the line decides the scope: `[`R.md`](R.md) §6.1` must exist in
 * `R.md`, and a line with two links accepts a section of either one (plus the
 * current document, so a document may also cite its own sections). A `§N` in
 * prose without any link carries no resolvable target and is skipped in v1.
 *
 * @param {DocsFile} args - the scanned document.
 * @param {{ readText: (file: string) => string | null }} args.io - injected reader.
 * @returns {Array<DocsViolation>} at most one finding per line.
 */
export function checkSections({ file, text }, io) {
  const cache = createHeadingCache(io);
  const clean = stripFencedBlocks(text);
  const currentHeadings = extractHeadingNumbers(clean);

  /** @type {Array<DocsViolation>} */
  const violations = [];

  toLines(clean).forEach((line, index) => {
    const lineDocs = linkTargetsOf(line)
      .map(splitLinkTarget)
      .filter((parsed) => parsed !== null && parsed.path !== '')
      .map((parsed) => resolveTarget(file, parsed.path));

    const numbers = extractSectionRefs(line);

    if (lineDocs.length === 0 || numbers.length === 0) {
      return;
    }

    const candidates = [file, ...lineDocs];

    const unresolved = numbers.filter((number) => {
      const outcomes = candidates.map((document) =>
        sectionExists({
          currentHeadings,
          currentFile: file,
          document,
          number,
          cache,
        }),
      );

      if (outcomes.some((outcome) => outcome === true)) {
        return false;
      }

      // An unreadable target is rule R1's finding, not a second one here.
      return !outcomes.some((outcome) => outcome === null);
    });

    if (unresolved.length === 0) {
      return;
    }

    violations.push({
      file,
      line: index + 1,
      rule: DOC_RULES.SECTION,
      snippet: line.trim(),
    });
  });

  return violations;
}

/**
 * Rule R3 — a living document carries a valid `**Utolsó frissítés:**` date.
 *
 * @param {DocsFile} args - the scanned document.
 * @returns {DocsViolation | null} the finding, or `null` when the header is fine.
 */
export function checkLastUpdated({ file, text }) {
  const lines = toLines(stripFencedBlocks(text));
  const index = lines.findIndex((line) => line.includes(LAST_UPDATED_LABEL));

  if (index === -1) {
    return {
      file,
      line: 1,
      rule: DOC_RULES.LAST_UPDATED,
      snippet: `missing "${LAST_UPDATED_LABEL}"`,
    };
  }

  const dateToken = DATE_TOKEN_PATTERN.exec(lines[index]);

  if (dateToken === null) {
    return {
      file,
      line: index + 1,
      rule: DOC_RULES.LAST_UPDATED,
      snippet: `no date after "${LAST_UPDATED_LABEL}"`,
    };
  }

  if (!ISO_DATE_PATTERN.test(dateToken[0])) {
    return {
      file,
      line: index + 1,
      rule: DOC_RULES.LAST_UPDATED,
      snippet: lines[index].trim(),
    };
  }

  return null;
}

/**
 * Rule R4 — every pointer document links the checklist.
 *
 * @param {object} args - lookup inputs.
 * @param {ReadonlyArray<DocsFile>} args.pointerFiles - the documents that must point.
 * @param {string} [args.checklist] - the checklist path they must link.
 * @returns {Array<DocsViolation>} one finding per document without the link.
 */
export function checkPointers({
  pointerFiles,
  checklist = NEW_PAGE_CHECKLIST,
}) {
  const expected = posix.normalize(checklist);

  return pointerFiles
    .filter(({ file, text }) => {
      const targets = extractLinkTargets(stripFencedBlocks(text));

      return !targets.some(({ target }) => {
        const parsed = splitLinkTarget(target);

        return (
          parsed !== null &&
          parsed.path !== '' &&
          resolveTarget(file, parsed.path) === expected
        );
      });
    })
    .map(({ file }) => ({
      file,
      line: 1,
      rule: DOC_RULES.POINTER,
      snippet: `no link to ${expected}`,
    }));
}

/**
 * Runs all four rules over the collected documents.
 *
 * Findings are grouped per document, in the order the documents were walked, so a
 * red CI step reads top-down through the file.
 *
 * @param {object} args - lookup inputs.
 * @param {ReadonlyArray<DocsFile>} args.files - the living documents (R1–R3).
 * @param {(file: string) => string | null} args.readText - injected reader.
 * @param {(file: string) => boolean} [args.exists] - injected path probe for R1,
 *   defaults to "readable as text" so tests may omit it.
 * @param {ReadonlyArray<string> | null} [args.sectionDocs] - documents whose
 *   `§N` references are checked; `null` checks every document.
 * @param {ReadonlyArray<DocsFile>} [args.pointerFiles] - documents for rule R4.
 * @param {string} [args.checklist] - checklist path for rule R4.
 * @returns {Array<DocsViolation>} every finding.
 */
export function checkDocs({
  files,
  readText,
  exists = (file) => readText(file) !== null,
  sectionDocs = null,
  pointerFiles = [],
  checklist = NEW_PAGE_CHECKLIST,
}) {
  const io = { readText, exists };

  const documentViolations = files.flatMap((document) => {
    const lastUpdated = checkLastUpdated(document);
    const sections =
      sectionDocs === null || sectionDocs.includes(document.file)
        ? checkSections(document, io)
        : [];

    return [
      ...checkLinks(document, io),
      ...sections,
      ...(lastUpdated === null ? [] : [lastUpdated]),
    ];
  });

  return [...documentViolations, ...checkPointers({ pointerFiles, checklist })];
}
