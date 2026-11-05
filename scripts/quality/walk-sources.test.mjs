/**
 * Behaviour tests of the shared source walker: posix path normalisation,
 * extension filtering, the ignore list and the explicit error on a broken root.
 *
 * Run with `pnpm test:quality`.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { isIgnored, toPosixPath, walkSources } from './walk-sources.mjs';

const FIXTURE_TREE = fileURLToPath(
  new URL('./fixtures/palette/negative/', import.meta.url),
);

/** Roots and extensions of the palette gate, used against the fixture tree. */
const EXTENSIONS = ['.ts', '.tsx', '.css'];

test('normalises Windows separators to posix', () => {
  assert.equal(toPosixPath('apps\\web\\src\\App.tsx'), 'apps/web/src/App.tsx');
  assert.equal(toPosixPath('apps/web/src/App.tsx'), 'apps/web/src/App.tsx');
});

test('ignores a path segment wherever it appears', () => {
  assert.equal(
    isIgnored('apps/web/node_modules/react/index.js', ['node_modules']),
    true,
  );
  assert.equal(isIgnored('apps/web/src/App.tsx', ['node_modules']), false);
});

test('ignores a path prefix', () => {
  assert.equal(
    isIgnored('scripts/quality/fixtures/a.ts', ['scripts/quality/fixtures']),
    true,
  );
  assert.equal(
    isIgnored('scripts/quality/report.mjs', ['scripts/quality/fixtures']),
    false,
  );
});

test('matches nothing when the ignore list is empty', () => {
  assert.equal(isIgnored('apps/web/src/App.tsx', []), false);
});

test('returns files sorted by path with posix separators', () => {
  const files = walkSources({
    base: FIXTURE_TREE,
    roots: ['apps/admin/src', 'apps/web/src'],
    extensions: EXTENSIONS,
  });

  assert.deepEqual(
    files.map((entry) => entry.file),
    ['apps/admin/src/panel.css', 'apps/web/src/Inline.tsx'],
  );
});

test('reads the file contents into the entry', () => {
  const [file] = walkSources({
    base: FIXTURE_TREE,
    roots: ['apps/admin/src'],
    extensions: EXTENSIONS,
  });

  assert.equal(file.text.includes('.legacy-applied'), true);
});

test('filters by extension', () => {
  const files = walkSources({
    base: FIXTURE_TREE,
    roots: ['apps/admin/src'],
    extensions: ['.css'],
  });

  assert.deepEqual(
    files.map((entry) => entry.file),
    ['apps/admin/src/panel.css'],
  );
});

test('skips ignored roots', () => {
  const files = walkSources({
    base: FIXTURE_TREE,
    roots: ['apps'],
    extensions: EXTENSIONS,
    ignore: ['apps/web'],
  });

  assert.deepEqual(
    files.map((entry) => entry.file),
    ['apps/admin/src/panel.css'],
  );
});

test('throws an explicit error for a missing root', () => {
  assert.throws(
    () =>
      walkSources({
        base: FIXTURE_TREE,
        roots: ['apps/does-not-exist/src'],
        extensions: EXTENSIONS,
      }),
    /Cannot read directory "apps\/does-not-exist\/src"/,
  );
});
