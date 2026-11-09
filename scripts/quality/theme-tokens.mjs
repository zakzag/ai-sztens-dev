#!/usr/bin/env node
/**
 * Appearance-token gate CLI — `pnpm quality:themes` (AIS-168).
 *
 * Fails when an appearance block in
 * `packages/ui/src/styles/theme.css` does not declare exactly the tokens the
 * default appearance declares. Reporting goes through
 * [`report.mjs`](./report.mjs), so the red CI step prints `file:line: [rule]`.
 *
 * @module scripts/quality/theme-tokens
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { exitWith } from './report.mjs';
import { THEME_TOKENS_FILE } from './theme-tokens.const.mjs';
import { checkThemeFiles } from './theme-tokens.logic.mjs';

/** Repo root, derived from this file's location so the cwd does not matter. */
export const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));

/**
 * Reads the token file and returns every appearance finding.
 *
 * @param {object} [options] - overrides, used by the tests and the fixtures.
 * @param {string} [options.base] - absolute directory the file is relative to.
 * @param {string} [options.file] - posix, base-relative path of the token file.
 * @returns {Array<import('./theme-tokens.logic.mjs').ThemeTokenViolation>} findings.
 */
export function runThemeTokensGate({ base = REPO_ROOT, file = THEME_TOKENS_FILE } = {}) {
  const text = readFileSync(resolve(base, file), 'utf8');

  return checkThemeFiles([{ file, text }]);
}

/**
 * Tells whether this module was started as a program (and not imported).
 *
 * @returns {boolean} `true` when executed through `node scripts/quality/theme-tokens.mjs`.
 */
function isEntryPoint() {
  return (
    process.argv[1] !== undefined &&
    resolve(process.argv[1]) === fileURLToPath(import.meta.url)
  );
}

if (isEntryPoint()) {
  exitWith(runThemeTokensGate(), 'quality:themes (appearance tokens)');
}
