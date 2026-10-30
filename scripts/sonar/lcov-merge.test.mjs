import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import { LcovMergeError } from './sonar.errors.mjs';
import {
  main,
  mergeLcov,
  normalizeSfPath,
  parseLcov,
  readCoverageSources,
  resolveSourcePath,
  toPosix,
} from './lcov-merge.mjs';

/** Builds an existence predicate from a list of known absolute paths. */
function knownFiles(...paths) {
  const known = new Set(paths);
  return (pathValue) => known.has(pathValue);
}

const REPO_ROOT = '/repo';

test('toPosix converts Windows separators', () => {
  assert.equal(
    toPosix('packages\\ui\\src\\Button.tsx'),
    'packages/ui/src/Button.tsx',
  );
});

test('normalizeSfPath strips ./ and duplicate separators', () => {
  assert.equal(normalizeSfPath('./src//a.ts'), 'src/a.ts');
});

test('resolveSourcePath rewrites a Vitest-style relative entry', () => {
  const result = resolveSourcePath(
    'src/Button.tsx',
    'packages/ui',
    REPO_ROOT,
    knownFiles(join(REPO_ROOT, 'packages/ui/src/Button.tsx')),
  );

  assert.deepEqual(result, {
    relativePath: 'packages/ui/src/Button.tsx',
    found: true,
  });
});

test('resolveSourcePath falls back to the package src directory (Jest rootDir=src)', () => {
  const result = resolveSourcePath(
    'main.ts',
    'apps/api',
    REPO_ROOT,
    knownFiles(join(REPO_ROOT, 'apps/api/src/main.ts')),
  );

  assert.deepEqual(result, {
    relativePath: 'apps/api/src/main.ts',
    found: true,
  });
});

test('resolveSourcePath normalises backslash paths', () => {
  const result = resolveSourcePath(
    'src\\lib\\cn.ts',
    'packages/ui',
    REPO_ROOT,
    knownFiles(join(REPO_ROOT, 'packages/ui/src/lib/cn.ts')),
  );

  assert.equal(result.relativePath, 'packages/ui/src/lib/cn.ts');
  assert.equal(result.found, true);
});

test('resolveSourcePath keeps an absolute entry inside the repo', () => {
  // `SF:` values are normalised to POSIX separators before they are resolved.
  const absolute = `${REPO_ROOT}/packages/shared/src/index.ts`;
  const result = resolveSourcePath(
    absolute,
    'packages/shared',
    REPO_ROOT,
    knownFiles(absolute),
  );

  assert.deepEqual(result, {
    relativePath: 'packages/shared/src/index.ts',
    found: true,
  });
});

test('resolveSourcePath reports a missing file but still returns a relative path', () => {
  const result = resolveSourcePath(
    'src/ghost.ts',
    'packages/ui',
    REPO_ROOT,
    knownFiles(),
  );

  assert.equal(result.found, false);
  assert.equal(result.relativePath, 'packages/ui/src/ghost.ts');
});

test('parseLcov splits records on end_of_record and drops blank lines', () => {
  const records = parseLcov(
    'SF:a.ts\nDA:1,1\nend_of_record\n\nSF:b.ts\nDA:2,1\nend_of_record\n',
  );

  assert.equal(records.length, 2);
  assert.deepEqual(records[0], ['SF:a.ts', 'DA:1,1', 'end_of_record']);
  assert.deepEqual(records[1], ['SF:b.ts', 'DA:2,1', 'end_of_record']);
});

test('parseLcov keeps a trailing record without end_of_record', () => {
  const records = parseLcov('SF:a.ts\nDA:1,1');

  assert.equal(records.length, 1);
  assert.deepEqual(records[0], ['SF:a.ts', 'DA:1,1']);
});

test('parseLcov returns no records for an empty report', () => {
  assert.deepEqual(parseLcov(''), []);
});

test('mergeLcov concatenates two packages and rewrites both SF paths', () => {
  const merged = mergeLcov(
    [
      {
        packageDir: 'packages/ui',
        lcovText: 'SF:src/Button.tsx\nDA:1,1\nend_of_record',
      },
      {
        packageDir: 'apps/api',
        lcovText: 'SF:src/main.ts\nDA:2,0\nend_of_record',
      },
    ],
    {
      repoRoot: REPO_ROOT,
      fileExists: knownFiles(
        join(REPO_ROOT, 'packages/ui/src/Button.tsx'),
        join(REPO_ROOT, 'apps/api/src/main.ts'),
      ),
    },
  );

  assert.deepEqual(merged.files, [
    'packages/ui/src/Button.tsx',
    'apps/api/src/main.ts',
  ]);
  assert.equal(
    merged.mergedText,
    'SF:packages/ui/src/Button.tsx\nDA:1,1\nend_of_record\nSF:apps/api/src/main.ts\nDA:2,0\nend_of_record\n',
  );
  assert.deepEqual(merged.missing, []);
});

test('mergeLcov skips duplicated files across packages', () => {
  const merged = mergeLcov(
    [
      {
        packageDir: 'packages/ui',
        lcovText: 'SF:src/Button.tsx\nDA:1,1\nend_of_record',
      },
      {
        packageDir: 'packages/ui',
        lcovText: 'SF:src/Button.tsx\nDA:1,0\nend_of_record',
      },
    ],
    {
      repoRoot: REPO_ROOT,
      fileExists: knownFiles(join(REPO_ROOT, 'packages/ui/src/Button.tsx')),
    },
  );

  assert.equal(merged.files.length, 1);
  assert.equal(merged.mergedText.match(/SF:/g)?.length, 1);
});

test('mergeLcov ignores records without an SF line and lists missing files', () => {
  const merged = mergeLcov(
    [
      { packageDir: 'packages/ui', lcovText: 'DA:1,1\nend_of_record' },
      {
        packageDir: 'packages/ui',
        lcovText: 'SF:src/ghost.ts\nDA:1,1\nend_of_record',
      },
    ],
    { repoRoot: REPO_ROOT, fileExists: knownFiles() },
  );

  assert.deepEqual(merged.files, ['packages/ui/src/ghost.ts']);
  assert.deepEqual(merged.missing, ['packages/ui/src/ghost.ts']);
});

test('mergeLcov returns an empty report for an empty input', () => {
  const merged = mergeLcov([], {
    repoRoot: REPO_ROOT,
    fileExists: knownFiles(),
  });

  assert.deepEqual(merged, { mergedText: '', files: [], missing: [] });
});

test('readCoverageSources skips packages without an LCOV report', () => {
  const sources = readCoverageSources(
    {
      repoRoot: REPO_ROOT,
      fileExists: (pathValue) =>
        pathValue === join(REPO_ROOT, 'coverage/ui/lcov.info'),
      readFile: () => 'SF:src/Button.tsx\nDA:1,1\nend_of_record',
    },
    [
      { packageDir: 'packages/ui', lcovPath: 'coverage/ui/lcov.info' },
      { packageDir: 'apps/api', lcovPath: 'coverage/api/lcov.info' },
    ],
  );

  assert.equal(sources.length, 1);
  assert.equal(sources[0].packageDir, 'packages/ui');
});

test('main rejects when no package produced an LCOV report', async () => {
  const repoRoot = mkdtempSync(join(tmpdir(), 'lcov-merge-'));
  try {
    await assert.rejects(
      () => main({ repoRoot, log: { log: () => {}, warn: () => {} } }),
      (error) =>
        error instanceof LcovMergeError && /sonar:coverage/.test(error.message),
    );
  } finally {
    rmSync(repoRoot, { recursive: true, force: true });
  }
});

test('main merges a real temporary report end to end', async () => {
  const repoRoot = mkdtempSync(join(tmpdir(), 'lcov-merge-'));
  try {
    const { mkdirSync, writeFileSync } = await import('node:fs');
    mkdirSync(join(repoRoot, 'coverage', 'ui'), { recursive: true });
    mkdirSync(join(repoRoot, 'packages', 'ui', 'src'), { recursive: true });
    writeFileSync(
      join(repoRoot, 'packages', 'ui', 'src', 'Button.tsx'),
      'export const Button = 1;\n',
    );
    writeFileSync(
      join(repoRoot, 'coverage', 'ui', 'lcov.info'),
      'SF:src/Button.tsx\nDA:1,1\nend_of_record\n',
      'utf8',
    );

    await main({ repoRoot, log: { log: () => {}, warn: () => {} } });

    const merged = readFileSync(
      join(repoRoot, 'coverage', 'lcov.info'),
      'utf8',
    );
    assert.match(merged, /SF:packages\/ui\/src\/Button\.tsx/);
  } finally {
    rmSync(repoRoot, { recursive: true, force: true });
  }
});
