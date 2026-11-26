#!/usr/bin/env node
/**
 * Field-error gate CLI — `pnpm quality:field-errors`.
 *
 * Fails when a component, hook or page branches on `error.status` /
 * `error.code` / `instanceof ApiError` outside an allowlisted pure decision
 * function (`.roo/rules/react.coding-standards.md` §5, §9). Reporting goes
 * through [`report.mjs`](./report.mjs), so the red CI step prints
 * `file:line: [rule]`.
 *
 * @module scripts/quality/field-error-gate
 */

import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  FIELD_ERROR_EXTENSIONS,
  FIELD_ERROR_IGNORE,
  FIELD_ERROR_ROOTS,
} from './field-error-gate.const.mjs';
import { checkFieldErrors } from './field-error-gate.logic.mjs';
import { exitWith } from './report.mjs';
import { walkSources } from './walk-sources.mjs';

/** Repo root, derived from this file's location so the cwd does not matter. */
export const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));

/**
 * Walks the configured roots and returns every field-error finding.
 *
 * @param {object} [options] - overrides, used by the tests and the fixtures.
 * @param {string} [options.base] - absolute directory the roots are relative to.
 * @param {ReadonlyArray<string>} [options.roots] - directories to scan.
 * @param {ReadonlyArray<string>} [options.extensions] - accepted suffixes.
 * @param {ReadonlyArray<string>} [options.ignore] - ignored segments or prefixes.
 * @returns {Array<import('./field-error-gate.logic.mjs').FieldErrorViolation>} findings.
 */
export function runFieldErrorGate({
  base = REPO_ROOT,
  roots = FIELD_ERROR_ROOTS,
  extensions = FIELD_ERROR_EXTENSIONS,
  ignore = FIELD_ERROR_IGNORE,
} = {}) {
  const files = walkSources({ roots, extensions, ignore, base });

  return checkFieldErrors(files);
}

/**
 * Tells whether this module was started as a program (and not imported).
 *
 * @returns {boolean} `true` when executed through `node scripts/quality/field-error-gate.mjs`.
 */
function isEntryPoint() {
  return (
    process.argv[1] !== undefined &&
    resolve(process.argv[1]) === fileURLToPath(import.meta.url)
  );
}

if (isEntryPoint()) {
  exitWith(runFieldErrorGate(), 'quality:field-errors');
}
