/**
 * Behaviour tests of the palette gate: every rule has a **negative** case (a
 * fixture that must be reported) and a **positive** case (a fixture that must
 * not be), which is the ticket's own proof requirement (D2).
 *
 * Run with `pnpm test:quality`.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { checkPalette } from './palette-gate.logic.mjs';
import { runPaletteGate } from './palette-gate.mjs';

const NEGATIVE_TREE = fileURLToPath(
  new URL('./fixtures/palette/negative/', import.meta.url),
);
const POSITIVE_TREE = fileURLToPath(
  new URL('./fixtures/palette/positive/', import.meta.url),
);

test('reports all three rules in the negative fixture tree', () => {
  const violations = runPaletteGate({ base: NEGATIVE_TREE });

  const reportedRules = [
    ...new Set(violations.map((violation) => violation.rule)),
  ].sort();

  assert.deepEqual(reportedRules, [
    'no-arbitrary-colour',
    'no-colour-literal',
    'no-palette-utility',
  ]);
});

test('prints repo-relative posix paths for the negative fixtures', () => {
  const violations = runPaletteGate({ base: NEGATIVE_TREE });

  const files = new Set(violations.map((violation) => violation.file));

  assert.equal(files.has('apps/web/src/Inline.tsx'), true);
  assert.equal(files.has('apps/admin/src/panel.css'), true);
});

test('finds no violation in the positive fixture tree', () => {
  const violations = runPaletteGate({ base: POSITIVE_TREE });

  assert.deepEqual(violations, []);
});

test('flags a Tailwind palette utility with an opacity modifier', () => {
  const violations = checkPalette([
    {
      file: 'apps/web/src/App.tsx',
      text: '<a className="hover:text-white/80">',
    },
  ]);

  assert.deepEqual(violations, [
    {
      file: 'apps/web/src/App.tsx',
      line: 1,
      rule: 'no-palette-utility',
      snippet: '<a className="hover:text-white/80">',
    },
  ]);
});

test('flags an arbitrary colour value but not an arbitrary layout value', () => {
  const violations = checkPalette([
    {
      file: 'apps/web/src/App.tsx',
      text: '<div className="bg-[#101010] grid-cols-[2fr_1fr]">',
    },
    {
      file: 'apps/web/src/Card.tsx',
      text: '<div className="grid-cols-[2fr_1fr]">',
    },
  ]);

  assert.equal(violations.length, 1);
  assert.equal(violations[0].rule, 'no-arbitrary-colour');
  assert.equal(violations[0].file, 'apps/web/src/App.tsx');
});

test('reports the 1-based line number of the offending line', () => {
  const violations = checkPalette([
    {
      file: 'apps/web/src/App.tsx',
      text: 'const a = 1;\nconst b = 2;\nconst c = "#abcdef";',
    },
  ]);

  assert.equal(violations.length, 1);
  assert.equal(violations[0].line, 3);
});

test('reports at most one finding per line, the most specific rule winning', () => {
  const violations = checkPalette([
    {
      file: 'apps/web/src/App.tsx',
      text: '<div className="bg-[#101010] text-slate-400">',
    },
  ]);

  assert.equal(violations.length, 1);
  assert.equal(violations[0].rule, 'no-arbitrary-colour');
});

test('exempts the token file from the colour-literal rule only', () => {
  const tokenFile = 'packages/ui/src/styles/theme.css';

  const literalOnly = checkPalette([
    { file: tokenFile, text: '--color-primary: oklch(0.66 0.14 195);' },
  ]);

  assert.deepEqual(literalOnly, []);

  const paletteUtility = checkPalette([
    { file: tokenFile, text: '@apply bg-slate-800;' },
  ]);

  assert.equal(paletteUtility.length, 1);
  assert.equal(paletteUtility[0].rule, 'no-palette-utility');
});

test('does not treat a hash followed by non-hex characters as a colour', () => {
  const violations = checkPalette([
    {
      file: 'apps/web/src/router.ts',
      text: "export const links = ['#main', '#/legal'];",
    },
  ]);

  assert.deepEqual(violations, []);
});

test('accepts an empty file list', () => {
  assert.deepEqual(checkPalette([]), []);
});
