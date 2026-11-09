#!/usr/bin/env node
/**
 * Palette gate CLI — `pnpm quality:tokens`.
 *
 * Fails when a colour literal, a Tailwind palette utility or an arbitrary
 * colour value appears under `apps/*\/src` or `packages/ui/src`
 * (`.roo/rules/react.coding-standards.md` §7). Reporting goes through
 * [`report.mjs`](./report.mjs), so the red CI step prints `file:line: [rule]`.
 *
 * @module scripts/quality/palette-gate
 */

import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  PALETTE_EXTENSIONS,
  PALETTE_IGNORE,
  PALETTE_ROOTS,
} from './palette-gate.const.mjs';
import { checkPalette } from './palette-gate.logic.mjs';
import { exitWith } from './report.mjs';
import { walkSources } from './walk-sources.mjs';

/** Repo root, derived from this file's location so the cwd does not matter. */
export const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));

/**
 * Walks the configured roots and returns every palette finding.
 *
 * @param {object} [options] - overrides, used by the tests and the fixtures.
 * @param {string} [options.base] - absolute directory the roots are relative to.
 * @param {ReadonlyArray<string>} [options.roots] - directories to scan.
 * @param {ReadonlyArray<string>} [options.extensions] - accepted suffixes.
 * @param {ReadonlyArray<string>} [options.ignore] - ignored segments or prefixes.
 * @returns {Array<import('./palette-gate.logic.mjs').PaletteViolation>} findings.
 */
export function runPaletteGate({
  base = REPO_ROOT,
  roots = PALETTE_ROOTS,
  extensions = PALETTE_EXTENSIONS,
  ignore = PALETTE_IGNORE,
} = {}) {
  const files = walkSources({ roots, extensions, ignore, base });

  return checkPalette(files);
}

/**
 * Tells whether this module was started as a program (and not imported).
 *
 * @returns {boolean} `true` when executed through `node scripts/quality/palette-gate.mjs`.
 */
function isEntryPoint() {
  return (
    process.argv[1] !== undefined &&
    resolve(process.argv[1]) === fileURLToPath(import.meta.url)
  );
}

if (isEntryPoint()) {
  exitWith(runPaletteGate(), 'quality:tokens (palette)');
}
