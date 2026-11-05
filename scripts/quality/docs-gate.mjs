#!/usr/bin/env node
/**
 * Documentation gate CLI — `pnpm quality:docs`.
 *
 * Keeps the "new admin page" process in one place: the checklist
 * ([`docs/Specs/New-Admin-Page.md`](../../docs/Specs/New-Admin-Page.md), AIS-133)
 * is the truth source, the other documents point at it, and every relative link
 * and `§N` reference in the Specs must resolve. Reporting goes through
 * [`report.mjs`](./report.mjs), so the red CI step prints
 * `file:line: [rule]`.
 *
 * The rules themselves are pure and live in
 * [`docs-gate.logic.mjs`](./docs-gate.logic.mjs); this module only supplies the
 * filesystem.
 *
 * @module scripts/quality/docs-gate
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  DOC_EXTENSIONS,
  DOC_IGNORE,
  DOC_ROOTS,
  NEW_PAGE_CHECKLIST,
  POINTER_SOURCES,
  SECTION_CHECKED_DOCS,
} from './docs-gate.const.mjs';
import { checkDocs } from './docs-gate.logic.mjs';
import { exitWith } from './report.mjs';
import { walkSources } from './walk-sources.mjs';

/** Repo root, derived from this file's location so the cwd does not matter. */
export const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));

/**
 * Builds a memoised reader over the documents and their link targets.
 *
 * A missing or unreadable file yields `null` instead of throwing: rule R1 turns
 * that into a finding ("the link does not resolve"), which is exactly the report
 * a reader needs. Re-reading is not an error — it is Rule R1's signal — so the
 * failure is deliberately not logged here.
 *
 * @param {string} base - absolute directory the walk is relative to.
 * @returns {(file: string) => string | null} reader keyed by posix, base-relative path.
 */
function createReader(base) {
  const cache = new Map();

  return (file) => {
    if (!cache.has(file)) {
      try {
        cache.set(file, readFileSync(resolve(base, file), 'utf8'));
      } catch {
        cache.set(file, null);
      }
    }

    return cache.get(file);
  };
}

/**
 * Walks the documentation roots and returns every docs-gate finding.
 *
 * @param {object} [options] - overrides, used by the tests and the fixtures.
 * @param {string} [options.base] - absolute directory the roots are relative to.
 * @param {ReadonlyArray<string>} [options.roots] - directories to scan.
 * @param {ReadonlyArray<string>} [options.extensions] - accepted suffixes.
 * @param {ReadonlyArray<string>} [options.ignore] - ignored segments or prefixes.
 * @param {ReadonlyArray<string>} [options.pointerSources] - documents that must link the checklist.
 * @param {string} [options.checklist] - the checklist they must link.
 * @param {ReadonlyArray<string> | null} [options.sectionDocs] - documents whose
 *   `§N` references are checked; `null` checks every document.
 * @returns {Array<import('./docs-gate.logic.mjs').DocsViolation>} findings.
 */
export function runDocsGate({
  base = REPO_ROOT,
  roots = DOC_ROOTS,
  extensions = DOC_EXTENSIONS,
  ignore = DOC_IGNORE,
  pointerSources = POINTER_SOURCES,
  checklist = NEW_PAGE_CHECKLIST,
  sectionDocs = SECTION_CHECKED_DOCS,
} = {}) {
  const readText = createReader(base);
  const files = walkSources({ roots, extensions, ignore, base });

  const pointerFiles = pointerSources.map((file) => ({
    file,
    text: readText(file) ?? '',
  }));

  // A link may target a directory, so the existence probe is not the reader.
  const exists = (file) => existsSync(resolve(base, file));

  return checkDocs({
    files,
    readText,
    exists,
    sectionDocs,
    pointerFiles,
    checklist,
  });
}

/**
 * Tells whether this module was started as a program (and not imported).
 *
 * @returns {boolean} `true` when executed through `node scripts/quality/docs-gate.mjs`.
 */
function isEntryPoint() {
  return (
    process.argv[1] !== undefined &&
    resolve(process.argv[1]) === fileURLToPath(import.meta.url)
  );
}

if (isEntryPoint()) {
  exitWith(runDocsGate(), 'quality:docs');
}
