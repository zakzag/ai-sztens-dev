/**
 * Behaviour tests of the pure appearance-token logic (AIS-168).
 *
 * Every branch of the comparison has a case here: an incomplete block, an
 * invented token, an empty block, a missing default, a missing appearance, a
 * comment that quotes a selector, and an at-rule refinement that must stay
 * legal. Run with `pnpm test:quality`.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { THEME_RULES } from './theme-tokens.const.mjs';
import {
  checkThemeFiles,
  checkThemeTokens,
  collectTokenNames,
  findTopLevelBlocks,
  stripCssComments,
} from './theme-tokens.logic.mjs';

const FILE = 'packages/ui/src/styles/theme.css';

const DEFAULTS = `@theme {
  --color-primary: oklch(0.66 0.14 195);
  --color-surface-base: oklch(0.17 0.008 250);
}
`;

test('strips comments but keeps the line count', () => {
  const stripped = stripCssComments('/* note\nabout blocks */\n--color-primary: x;');

  assert.equal(stripped.split('\n').length, 3);
  assert.equal(stripped.includes('note'), false);
  assert.equal(stripped.includes('about blocks'), false);
  assert.equal(stripped.includes('--color-primary'), true);
});

test('finds only top-level blocks, so an at-rule refinement is not an appearance', () => {
  const blocks = findTopLevelBlocks(
    '@theme { --a: 1; }\n@media (prefers-contrast: more) { :root[data-theme="glass"] { --a: 2; } }\n',
  );

  assert.deepEqual(
    blocks.map((block) => block.selector),
    ['@theme', '@media (prefers-contrast: more)'],
  );
});

test('skips statements outside a block', () => {
  const blocks = findTopLevelBlocks('@import "tailwindcss";\n@theme { --a: 1; }\n');

  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].selector, '@theme');
});

test('collects declared custom property names only', () => {
  const names = collectTokenNames('--a: 1; --b: 2; color: red;');

  assert.deepEqual([...names], ['--a', '--b']);
});

test('accepts a complete appearance block', () => {
  const findings = checkThemeTokens(
    FILE,
    `${DEFAULTS}:root[data-theme='light'] {
  --color-primary: oklch(0.5 0.13 195);
  --color-surface-base: oklch(0.94 0.005 250);
}
`,
  );

  assert.deepEqual(findings, []);
});

test('accepts the appearance-state tokens on top of the default set', () => {
  const findings = checkThemeTokens(
    FILE,
    `${DEFAULTS}:root[data-theme='glass'] {
  --color-primary: oklch(0.82 0.12 200);
  --color-surface-base: oklch(0.28 0.06 265);
  --color-scheme: dark;
  --app-backdrop: none;
  --blur-glass: 18px;
}
`,
  );

  assert.deepEqual(findings, []);
});

test('reports a token the appearance forgot', () => {
  const findings = checkThemeTokens(
    FILE,
    `${DEFAULTS}:root[data-theme='light'] {
  --color-primary: oklch(0.5 0.13 195);
}
`,
  );

  assert.equal(findings.length, 1);
  assert.equal(findings[0].rule, THEME_RULES.tokenMissing);
  assert.match(findings[0].snippet, /--color-surface-base/);
});

test('reports a token the default does not declare', () => {
  const findings = checkThemeTokens(
    FILE,
    `${DEFAULTS}:root[data-theme='ambient'] {
  --color-primary: oklch(0.78 0.13 70);
  --color-surface-base: oklch(0.2 0.018 40);
  --color-accent-glow: oklch(0.9 0.1 80);
}
`,
  );

  assert.equal(findings.length, 1);
  assert.equal(findings[0].rule, THEME_RULES.tokenUnknown);
  assert.match(findings[0].snippet, /--color-accent-glow/);
});

test('reports an appearance block that declares nothing', () => {
  const findings = checkThemeTokens(FILE, `${DEFAULTS}:root[data-theme='light'] {}\n`);

  assert.equal(findings.length, 1);
  assert.equal(findings[0].rule, THEME_RULES.blockEmpty);
});

test('reports a missing default appearance', () => {
  const findings = checkThemeTokens(
    FILE,
    ":root[data-theme='light'] { --color-primary: red; }\n",
  );

  assert.equal(findings.length, 1);
  assert.equal(findings[0].rule, THEME_RULES.defaultMissing);
});

test('reports a file with no appearance block at all', () => {
  const findings = checkThemeTokens(FILE, DEFAULTS);

  assert.equal(findings.length, 1);
  assert.equal(findings[0].rule, THEME_RULES.blockMissing);
});

test('does not invent blocks from a comment that quotes a selector', () => {
  const findings = checkThemeTokens(
    FILE,
    `/**
 * The blocks are selected by :root[data-theme="light"] { … } in the CSS above.
 */
${DEFAULTS}:root[data-theme='light'] {
  --color-primary: oklch(0.5 0.13 195);
  --color-surface-base: oklch(0.94 0.005 250);
}
`,
  );

  assert.deepEqual(findings, []);
});

test('reports the line the offending block starts on', () => {
  const findings = checkThemeTokens(
    FILE,
    `${DEFAULTS}\n\n:root[data-theme='light'] {\n  --color-primary: 1;\n}\n`,
  );

  assert.equal(findings[0].line, 7);
});

test('runs every file it is given', () => {
  const findings = checkThemeFiles([
    { file: FILE, text: DEFAULTS },
    { file: 'other.css', text: DEFAULTS },
  ]);

  assert.equal(findings.length, 2);
  assert.deepEqual(
    findings.map((finding) => finding.file),
    [FILE, 'other.css'],
  );
});
