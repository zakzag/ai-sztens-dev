/**
 * Fixture-driven tests of the appearance-token gate (AIS-168).
 *
 * The positive tree must be clean, the negative tree must report both failure
 * modes, and the **real** token file must be clean — the last one is the point:
 * it proves the four shipped appearances still declare the same set.
 *
 * Run with `pnpm test:quality`.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { THEME_RULES } from './theme-tokens.const.mjs';
import { runThemeTokensGate } from './theme-tokens.mjs';

const FIXTURE_FILE = 'theme.css';
const NEGATIVE_TREE = fileURLToPath(new URL('./fixtures/theme/negative/', import.meta.url));
const POSITIVE_TREE = fileURLToPath(new URL('./fixtures/theme/positive/', import.meta.url));

test('finds no violation in the positive fixture', () => {
  const findings = runThemeTokensGate({ base: POSITIVE_TREE, file: FIXTURE_FILE });

  assert.deepEqual(findings, []);
});

test('reports both failure modes in the negative fixture', () => {
  const findings = runThemeTokensGate({ base: NEGATIVE_TREE, file: FIXTURE_FILE });

  const rules = [...new Set(findings.map((finding) => finding.rule))].sort();

  assert.deepEqual(rules, [THEME_RULES.tokenMissing, THEME_RULES.tokenUnknown]);
});

test('keeps the real token file consistent across every appearance', () => {
  // The gate protects the shipped file, not a hypothetical one: four appearances
  // in `theme.css` must declare exactly the default set.
  const findings = runThemeTokensGate();

  assert.deepEqual(findings, []);
});
