/**
 * Merges the per-package LCOV reports into one repo-root relative report.
 *
 * Why this exists: SonarQube resolves the `SF:` paths of an LCOV file relative
 * to the analysed project root. Every package here emits paths relative to its
 * own directory (`SF:src/foo.ts`), which SonarQube would fail to match. This
 * module rewrites each entry to a repo-root relative path such as
 * `packages/ui/src/foo.ts` and concatenates the records into a single file.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  COVERAGE_TARGETS,
  MERGED_LCOV_PATH,
  SOURCE_PATH_PREFIXES,
} from './sonar.const.mjs';
import { LcovMergeError } from './sonar.errors.mjs';

/** Absolute path of the repository root (two levels above this file). */
export const REPO_ROOT = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
);

/**
 * Converts Windows separators to POSIX ones.
 *
 * @param {string} pathValue
 * @returns {string}
 */
export function toPosix(pathValue) {
  return pathValue.replace(/\\/g, '/');
}

/**
 * Removes a leading `./` and duplicated separators from an `SF:` value.
 *
 * @param {string} sfPath raw `SF:` value
 * @returns {string}
 */
export function normalizeSfPath(sfPath) {
  return toPosix(sfPath.trim())
    .replace(/^\.\/+/, '')
    .replace(/\/{2,}/g, '/');
}

/**
 * Resolves one `SF:` entry to a repo-root relative path.
 *
 * Candidates are tried in order: the absolute path as-is, then the value
 * relative to the package directory (Vitest style), the package `src`
 * directory (Jest with `rootDir: src`) and finally the repo root.
 *
 * @param {string} sfPath raw `SF:` value
 * @param {string} packageDir repo-root relative package directory
 * @param {string} repoRoot absolute repo root
 * @param {(path: string) => boolean} fileExists injected existence check
 * @returns {{ relativePath: string, found: boolean }}
 */
export function resolveSourcePath(sfPath, packageDir, repoRoot, fileExists) {
  const normalized = normalizeSfPath(sfPath);
  const candidates = isAbsolute(normalized)
    ? [normalized]
    : buildCandidates(normalized, packageDir, repoRoot);
  const existing = candidates.find((candidate) => fileExists(candidate));

  return {
    relativePath: toPosix(relative(repoRoot, existing ?? candidates[0])),
    found: existing !== undefined,
  };
}

/**
 * Splits an LCOV file into records, each terminated by `end_of_record`.
 *
 * @param {string} lcovText
 * @returns {string[][]} one array of lines per record
 */
export function parseLcov(lcovText) {
  /** @type {string[][]} */
  const records = [];
  /** @type {string[]} */
  let current = [];

  for (const rawLine of lcovText.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === '') {
      continue;
    }

    current.push(line);
    if (line === 'end_of_record') {
      records.push(current);
      current = [];
    }
  }

  if (current.length > 0) {
    records.push(current);
  }

  return records;
}

/**
 * Merges several LCOV sources into one report.
 *
 * @param {ReadonlyArray<{ packageDir: string, lcovText: string }>} sources
 * @param {{ repoRoot: string, fileExists: (path: string) => boolean }} context
 * @returns {{ mergedText: string, files: string[], missing: string[] }}
 */
export function mergeLcov(sources, context) {
  /** @type {string[]} */
  const files = [];
  const seen = new Set();
  /** @type {string[]} */
  const blocks = [];

  for (const source of sources) {
    for (const record of parseLcov(source.lcovText)) {
      const resolved = resolveRecord(record, source.packageDir, context);
      if (resolved === null || seen.has(resolved.relativePath)) {
        continue;
      }

      seen.add(resolved.relativePath);
      files.push(resolved.relativePath);
      blocks.push(resolved.block);
    }
  }

  return {
    mergedText: blocks.length === 0 ? '' : `${blocks.join('\n')}\n`,
    files,
    missing: files.filter(
      (file) => !context.fileExists(join(context.repoRoot, file)),
    ),
  };
}

/**
 * Reads the LCOV report of every package that has one.
 *
 * @param {{ repoRoot: string, fileExists: (path: string) => boolean, readFile: (path: string) => string }} io
 * @param {ReadonlyArray<{ packageDir: string, lcovPath: string }>} targets
 * @returns {Array<{ packageDir: string, lcovText: string }>}
 */
export function readCoverageSources(io, targets = COVERAGE_TARGETS) {
  /** @type {Array<{ packageDir: string, lcovText: string }>} */
  const sources = [];

  for (const target of targets) {
    const absolutePath = join(io.repoRoot, target.lcovPath);
    if (!io.fileExists(absolutePath)) {
      continue;
    }

    sources.push({
      packageDir: target.packageDir,
      lcovText: io.readFile(absolutePath),
    });
  }

  return sources;
}

/**
 * CLI entry point: merges the reports and writes `coverage/lcov.info`.
 *
 * @param {{ repoRoot?: string, log?: Console }} [options]
 * @returns {Promise<void>}
 * @throws {LcovMergeError} when no package produced an LCOV report
 */
export async function main({ repoRoot = REPO_ROOT, log = console } = {}) {
  const io = {
    repoRoot,
    fileExists: (path) => existsSync(path),
    readFile: (path) => readFileSync(path, 'utf8'),
  };

  const sources = readCoverageSources(io);
  if (sources.length === 0) {
    throw new LcovMergeError(
      'Nem található egyetlen LCOV riport sem. Futtasd előbb: pnpm sonar:coverage ' +
        '(vagy a package-ek test:cov scriptjét).',
    );
  }

  const merged = mergeLcov(sources, { repoRoot, fileExists: io.fileExists });
  const outputPath = join(repoRoot, MERGED_LCOV_PATH);
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, merged.mergedText, 'utf8');

  log.log(
    `LCOV merge: ${sources.length} package, ${merged.files.length} fájl → ${MERGED_LCOV_PATH}`,
  );
  for (const missing of merged.missing) {
    log.warn(
      `LCOV: a(z) "${missing}" útvonal nem létezik a repóban (a Sonar nem fogja párosítani).`,
    );
  }
}

/**
 * Rewrites a single record so its `SF:` line points at the repo-root relative path.
 *
 * @param {string[]} record
 * @param {string} packageDir
 * @param {{ repoRoot: string, fileExists: (path: string) => boolean }} context
 * @returns {{ relativePath: string, block: string } | null} `null` for records without `SF:`
 */
function resolveRecord(record, packageDir, context) {
  const sfLine = record.find((line) => line.startsWith('SF:'));
  if (sfLine === undefined) {
    return null;
  }

  const { relativePath } = resolveSourcePath(
    sfLine.slice('SF:'.length),
    packageDir,
    context.repoRoot,
    context.fileExists,
  );
  const lines = [
    `SF:${relativePath}`,
    ...record.slice(record.indexOf(sfLine) + 1),
  ];

  return { relativePath, block: lines.join('\n') };
}

/**
 * Builds the candidate absolute paths for a relative `SF:` value.
 *
 * @param {string} normalized
 * @param {string} packageDir
 * @param {string} repoRoot
 * @returns {string[]}
 */
function buildCandidates(normalized, packageDir, repoRoot) {
  const absolutePackageDir = join(repoRoot, packageDir);
  const candidates = SOURCE_PATH_PREFIXES.map((prefix) =>
    prefix === ''
      ? join(absolutePackageDir, normalized)
      : join(absolutePackageDir, prefix, normalized),
  );

  candidates.push(join(repoRoot, normalized));
  return candidates;
}

const invokedPath =
  process.argv[1] === undefined ? '' : resolve(process.argv[1]);
if (invokedPath === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
