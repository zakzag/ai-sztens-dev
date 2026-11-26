/**
 * Behaviour tests of the layer gate.
 *
 * The gate itself is `dependency-cruiser`; what is proven here is that the
 * **rules** behave as the ticket demands (decision D2):
 *
 * - `fixtures/layers/negative` → exit code ≠ 0 and the output names the broken
 *   rules (`no-page-to-page`, `no-feature-to-feature`, `no-lib-to-higher-layer`);
 * - `fixtures/layers/positive` → exit code 0 (guards against a blanket-fail gate);
 * - the real tree (`apps/admin/src`) → exit code 0, i.e. the gate is green on
 *   the branch as merged.
 *
 * Run with `pnpm test:quality`.
 */

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

/** Repo root, derived from this file's location. */
const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));

/**
 * The dependency-cruiser CLI entry point.
 *
 * The package exports neither `./package.json` nor its `bin` folder, and a
 * CommonJS `require.resolve` fails too (the package has no `require`
 * condition), so the path is derived from the **ESM** entry that
 * `import.meta.resolve` returns (`…/dependency-cruiser/src/main/index.mjs`).
 */
const DEPCRUISE_BIN = fileURLToPath(
  new URL(
    '../../bin/dependency-cruise.mjs',
    import.meta.resolve('dependency-cruiser'),
  ),
);

/** Fixture trees. */
const NEGATIVE_TREE = 'scripts/quality/fixtures/layers/negative';
const POSITIVE_TREE = 'scripts/quality/fixtures/layers/positive';

/**
 * Runs depcruise over one target and returns the result.
 *
 * @param {string} target - repo-relative directory to cruise.
 * @param {string} config - repo-relative dependency-cruiser config.
 * @returns {{ status: number | null, output: string }} exit status and combined output.
 */
function runDepcruise(target, config) {
  const result = spawnSync(
    process.execPath,
    [DEPCRUISE_BIN, target, '--config', config, '--output-type', 'err'],
    { cwd: REPO_ROOT, encoding: 'utf8' },
  );

  return {
    status: result.status,
    output: `${result.stdout ?? ''}${result.stderr ?? ''}`,
  };
}

test('is red on the negative fixture tree and names the broken rules', () => {
  const { status, output } = runDepcruise(
    NEGATIVE_TREE,
    '.dependency-cruiser.fixtures.cjs',
  );

  assert.notEqual(status, 0);
  assert.match(output, /no-page-to-page/);
  assert.match(output, /no-feature-to-feature/);
  assert.match(output, /no-lib-to-higher-layer/);
});

test('is green on the positive fixture tree (legal edges must resolve and pass)', () => {
  const { status, output } = runDepcruise(
    POSITIVE_TREE,
    '.dependency-cruiser.fixtures.cjs',
  );

  assert.equal(status, 0, output);
});

test('is green on apps/admin/src', () => {
  const { status, output } = runDepcruise(
    'apps/admin/src',
    '.dependency-cruiser.cjs',
  );

  assert.equal(status, 0, output);
});
