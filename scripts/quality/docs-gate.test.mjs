/**
 * Behaviour tests of the documentation gate.
 *
 * One fixture tree per rule proves the rule can go red; the positive tree proves
 * a correct pair of documents (plus the archived `docs/Specs/outdated`) stays
 * green. The unit tests pin the parsing edges the real Specs rely on: a `:line`
 * suffix, an `#anchor`, a fenced code block, a `§3.1–3.7` range and the
 * `**Utolsó frissítés:**` header variants.
 *
 * Run with `pnpm test:quality`.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { DOC_RULES } from './docs-gate.const.mjs';
import {
  checkDocs,
  checkLastUpdated,
  checkLinks,
  checkPointers,
  checkSections,
  extractHeadingNumbers,
  extractLinkTargets,
  extractSectionRefs,
  resolveTarget,
  splitLinkTarget,
  stripFencedBlocks,
} from './docs-gate.logic.mjs';
import { runDocsGate } from './docs-gate.mjs';
import { exitWith } from './report.mjs';
import { toPosixPath } from './walk-sources.mjs';

/**
 * Builds the absolute path of one fixture tree.
 *
 * @param {string} name - tree directory, e.g. `negative/section`.
 * @returns {string} absolute fixture directory.
 */
function fixtureTree(name) {
  return fileURLToPath(
    new URL(`${name}/`, new URL('./fixtures/docs/', import.meta.url)),
  );
}

/**
 * Builds a fake reader over an in-memory map.
 *
 * @param {Record<string, string>} files - posix path → contents.
 * @returns {(file: string) => string | null} reader returning `null` for unknown paths.
 */
function readerOf(files) {
  return (file) => (Object.hasOwn(files, file) ? files[file] : null);
}

/**
 * Builds a fake report sink so `exitWith` never terminates the test runner.
 *
 * @returns {{ io: object, lines: { log: string[], error: string[] }, codes: number[] }} sink plus capture.
 */
function captureIo() {
  const lines = { log: [], error: [] };
  const codes = [];

  return {
    lines,
    codes,
    io: {
      log: (message) => lines.log.push(message),
      error: (message) => lines.error.push(message),
      exit: (code) => codes.push(code),
    },
  };
}

test('the positive fixture tree is clean, including docs/Specs/outdated', () => {
  const violations = runDocsGate({
    base: fixtureTree('positive'),
    pointerSources: ['.roo/rules/react.coding-standards.md'],
    sectionDocs: ['docs/Specs/New-Admin-Page.md', 'docs/Specs/Other.md'],
  });

  assert.deepEqual(violations, []);
});

test('rule R1 reports a link whose target file does not exist', () => {
  const violations = runDocsGate({
    base: fixtureTree('negative/link'),
    pointerSources: [],
  });

  assert.equal(violations.length, 2);
  assert.deepEqual(
    violations.map((violation) => violation.rule),
    [DOC_RULES.LINK, DOC_RULES.LINK],
  );
  assert.equal(violations[0].file, 'docs/Specs/Broken.md');
  assert.equal(violations[0].line, 5);
});

test('rule R2 reports only the section reference that does not exist', () => {
  const violations = runDocsGate({
    base: fixtureTree('negative/section'),
    pointerSources: [],
    sectionDocs: ['docs/Specs/Sections.md'],
  });

  assert.equal(violations.length, 1);
  assert.equal(violations[0].rule, DOC_RULES.SECTION);
  assert.equal(violations[0].line, 11);
});

test('rule R3 reports a missing header and a non-ISO date', () => {
  const violations = runDocsGate({
    base: fixtureTree('negative/last-updated'),
    pointerSources: [],
  });

  const files = new Set(violations.map((violation) => violation.file));

  assert.equal(violations.length, 2);
  assert.equal(
    violations.every((violation) => violation.rule === DOC_RULES.LAST_UPDATED),
    true,
  );
  assert.equal(files.has('docs/Specs/NoHeader.md'), true);
  assert.equal(files.has('docs/Specs/BadDate.md'), true);
});

test('rule R4 reports a pointer document without the checklist link', () => {
  const violations = runDocsGate({
    base: fixtureTree('negative/pointer'),
    pointerSources: ['.roo/rules/react.coding-standards.md'],
  });

  assert.equal(violations.length, 1);
  assert.equal(violations[0].rule, DOC_RULES.POINTER);
  assert.equal(violations[0].file, '.roo/rules/react.coding-standards.md');
});

test('stripFencedBlocks empties fenced lines but keeps the line count', () => {
  const text = ['before', '```ts', 'const x = 1;', '```', 'after'].join('\n');

  const stripped = stripFencedBlocks(text);

  assert.equal(stripped.split('\n').length, text.split('\n').length);
  assert.equal(stripped.includes('const x = 1;'), false);
  assert.equal(stripped.includes('before'), true);
  assert.equal(stripped.includes('after'), true);
});

test('stripFencedBlocks keeps a shorter fence inside a longer block as content', () => {
  const text = ['````md', '```ts', 'const x = 1;', '```', '````', 'after'].join(
    '\n',
  );

  const stripped = stripFencedBlocks(text).split('\n');

  assert.equal(stripped.length, 6);
  assert.equal(stripped[5], 'after');
  assert.equal(stripped.includes('const x = 1;'), false);
});

test('stripFencedBlocks does not let a tilde line close a backtick block', () => {
  const text = ['```text', '~~~', 'still fenced', '```', 'after'].join('\n');

  const stripped = stripFencedBlocks(text).split('\n');

  assert.equal(stripped[2], '');
  assert.equal(stripped[4], 'after');
});

test('splitLinkTarget drops :line and #anchor and ignores external links', () => {
  assert.deepEqual(splitLinkTarget('./X.md:12'), {
    path: './X.md',
    anchor: '',
  });
  assert.deepEqual(splitLinkTarget('./X.md:12-14#top'), {
    path: './X.md',
    anchor: 'top',
  });
  assert.deepEqual(splitLinkTarget('#anchor'), { path: '', anchor: 'anchor' });
  assert.equal(splitLinkTarget('https://example.com/x.md'), null);
  assert.equal(splitLinkTarget('mailto:dev@example.com'), null);
});

test('resolveTarget normalises a relative link into a repo-relative path', () => {
  assert.equal(
    resolveTarget('docs/Specs/A.md', '../../apps/admin/src/x.ts'),
    'apps/admin/src/x.ts',
  );
  assert.equal(resolveTarget('docs/Specs/A.md', './B.md'), 'docs/Specs/B.md');
});

test('extractLinkTargets sees links in text but not in fenced blocks', () => {
  const text = ['See [`a`](./A.md).', '```', 'See [`b`](./B.md).', '```'].join(
    '\n',
  );

  const targets = extractLinkTargets(stripFencedBlocks(text));

  assert.deepEqual(
    targets.map((entry) => entry.target),
    ['./A.md'],
  );
});

test('extractSectionRefs keeps both ends of a range', () => {
  assert.deepEqual(extractSectionRefs('lásd §3.1–3.7'), ['3.1', '3.7']);
  assert.deepEqual(extractSectionRefs('§6'), ['6']);
  assert.deepEqual(extractSectionRefs('§6.4 and §6'), ['6.4', '6']);
  assert.deepEqual(extractSectionRefs('no reference here'), []);
});

test('extractHeadingNumbers reads the numeric prefix of every heading', () => {
  const numbers = extractHeadingNumbers(
    [
      '# Title',
      '## 6. New page recipe',
      '### 6.4 Store',
      '#### 9.5.1 Checks',
    ].join('\n'),
  );

  assert.deepEqual([...numbers].sort(), ['6', '6.4', '9.5.1']);
});

test('checkLastUpdated accepts both header spellings used in the Specs', () => {
  assert.equal(
    checkLastUpdated({
      file: 'docs/Specs/A.md',
      text: '**Utolsó frissítés:** 2026-11-05',
    }),
    null,
  );

  assert.equal(
    checkLastUpdated({
      file: 'docs/Specs/A.md',
      text: '**Utolsó frissítés: 2026-11-05 — AIS-133.**',
    }),
    null,
  );
});

test('checkLastUpdated rejects a missing header and a dot-separated date', () => {
  const missing = checkLastUpdated({ file: 'A.md', text: '# Title' });

  assert.equal(missing.rule, DOC_RULES.LAST_UPDATED);
  assert.equal(missing.line, 1);

  const badDate = checkLastUpdated({
    file: 'A.md',
    text: '**Utolsó frissítés:** 2026.11.04',
  });

  assert.equal(badDate.rule, DOC_RULES.LAST_UPDATED);
  assert.equal(badDate.line, 1);
});

test('checkSections does not let §6.4 satisfy §6', () => {
  const text = ['### 6.4 Only a subsection', 'Cites [`R.md`](R.md) §6.'].join(
    '\n',
  );

  const violations = checkSections(
    { file: 'docs/Specs/A.md', text },
    { readText: readerOf({ 'docs/Specs/R.md': '## 6.4 Subsection' }) },
  );

  assert.equal(violations.length, 1);
  assert.equal(violations[0].line, 2);
});

test('checkSections accepts a range whose ends both exist in the linked document', () => {
  const text = 'Range [`R.md`](R.md) §6.1–6.4 of the same file.';

  const violations = checkSections(
    { file: 'docs/Specs/A.md', text },
    {
      readText: readerOf({
        'docs/Specs/R.md': '## 6.1 Decision test\n## 6.4 Store',
      }),
    },
  );

  assert.deepEqual(violations, []);
});

test('checkSections skips a bare §N in prose without a link (v1 scope)', () => {
  const violations = checkSections(
    { file: 'docs/Specs/A.md', text: 'See §99 for the details.' },
    { readText: readerOf({}) },
  );

  assert.deepEqual(violations, []);
});

test('checkSections stays quiet when the linked document cannot be read', () => {
  const violations = checkSections(
    { file: 'docs/Specs/A.md', text: 'See [`gone`](Gone.md) §1.' },
    { readText: readerOf({}) },
  );

  assert.deepEqual(violations, []);
});

test('checkLinks strips :line before probing and accepts a directory target', () => {
  const files = { 'docs/Specs/X.md': '# X' };
  const io = {
    exists: (file) =>
      Object.hasOwn(files, file) || file === 'infra/postgres/init',
  };

  const violations = checkLinks(
    {
      file: 'docs/Specs/A.md',
      text: '[`a`](./X.md) [`b`](./X.md:3) [`dir`](../../infra/postgres/init/)',
    },
    io,
  );

  assert.deepEqual(violations, []);
});

test('checkPointers flags a source without the link and accepts a normalised one', () => {
  const violations = checkPointers({
    pointerFiles: [
      { file: '.roo/rules/r.md', text: 'no link here' },
      {
        file: 'docs/Specs/UI.md',
        text: 'Checklist: [`New-Admin-Page.md`](../Specs/New-Admin-Page.md)'.replace(
          '../Specs/',
          './',
        ),
      },
    ],
  });

  assert.equal(violations.length, 1);
  assert.equal(violations[0].file, '.roo/rules/r.md');
});

test('checkDocs runs the three document rules without pointer sources', () => {
  const violations = checkDocs({
    files: [
      {
        file: 'docs/Specs/A.md',
        text: [
          '**Utolsó frissítés:** 2026-11-05',
          'See [`gone`](./Gone.md) §1.',
        ].join('\n'),
      },
    ],
    readText: readerOf({}),
  });

  assert.deepEqual(
    violations.map((violation) => violation.rule),
    [DOC_RULES.LINK],
  );
});

test('exitWith uses exit code 0 when clean and 1 with findings', () => {
  const clean = captureIo();

  assert.equal(exitWith([], 'quality:docs', clean.io), 0);
  assert.deepEqual(clean.codes, []);
  assert.equal(clean.lines.log[0], 'OK quality:docs: 0 violations');

  const dirty = captureIo();

  const code = exitWith(
    [
      {
        file: 'docs/Specs/A.md',
        line: 1,
        rule: DOC_RULES.LINK,
        snippet: './X.md',
      },
    ],
    'quality:docs',
    dirty.io,
  );

  assert.equal(code, 1);
  assert.deepEqual(dirty.codes, [1]);
  assert.equal(
    dirty.lines.error[0],
    'docs/Specs/A.md:1: [link-resolves] ./X.md',
  );
});

test('every fixture tree is resolvable from the test file', () => {
  for (const name of [
    'positive',
    'negative/link',
    'negative/section',
    'negative/last-updated',
    'negative/pointer',
  ]) {
    assert.equal(
      toPosixPath(fixtureTree(name)).includes(`fixtures/docs/${name}/`),
      true,
    );
  }
});
