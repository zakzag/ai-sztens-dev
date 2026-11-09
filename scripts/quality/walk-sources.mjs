/**
 * Source walker shared by every file-based quality gate.
 *
 * Reads the files once and returns `{ file, text }` pairs with **posix**,
 * repo-relative paths. Every gate prints `file:line`, so the path form must be
 * identical on a Windows dev box and on the Linux CI runner — that is the whole
 * reason this module exists instead of a one-off `readdirSync` in each gate.
 *
 * @module scripts/quality/walk-sources
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

/**
 * Represents one scanned source file.
 *
 * @typedef {object} SourceFile
 * @property {string} file - posix, repo-relative (from the walk `base`) path.
 * @property {string} text - the file contents decoded as UTF-8.
 */

/**
 * Normalises any path to posix separators.
 *
 * @param {string} path - path using either `\` or `/`.
 * @returns {string} the same path with `/` separators only.
 */
export function toPosixPath(path) {
  return path.replaceAll('\\', '/');
}

/**
 * Tells whether a path is excluded by the walker's ignore list.
 *
 * An ignore entry matches a **path segment** (`node_modules`, `dist`) or a
 * path prefix (`scripts/quality/fixtures`), so the same list can express both
 * "skip generated output anywhere" and "skip this subtree".
 *
 * @param {string} relativePath - posix, base-relative path.
 * @param {ReadonlyArray<string>} ignore - ignored segments or prefixes.
 * @returns {boolean} `true` when the path must be skipped.
 */
export function isIgnored(relativePath, ignore) {
  if (ignore.length === 0) {
    return false;
  }

  const segments = relativePath.split('/');

  return ignore.some(
    (entry) =>
      segments.includes(entry) ||
      relativePath === entry ||
      relativePath.startsWith(`${entry}/`),
  );
}

/**
 * Recursively collects the files of one directory.
 *
 * @param {object} options - walk options.
 * @param {string} options.directory - absolute directory to read.
 * @param {string} options.base - absolute base the returned paths are relative to.
 * @param {ReadonlyArray<string>} options.extensions - accepted suffixes (`.ts`).
 * @param {ReadonlyArray<string>} options.ignore - ignored segments or prefixes.
 * @param {Array<SourceFile>} options.collected - accumulator.
 * @returns {void}
 * @throws {Error} when a directory cannot be read (broken root or permissions).
 */
function collectDirectory({ directory, base, extensions, ignore, collected }) {
  let entries;

  try {
    entries = readdirSync(directory, { withFileTypes: true });
  } catch (error) {
    const shownPath = toPosixPath(relative(base, directory)) || directory;

    throw new Error(`Cannot read directory "${shownPath}": ${error.message}`);
  }

  for (const entry of entries) {
    const absolutePath = join(directory, entry.name);
    const relativePath = toPosixPath(relative(base, absolutePath));

    if (isIgnored(relativePath, ignore)) {
      continue;
    }

    if (entry.isDirectory()) {
      collectDirectory({
        directory: absolutePath,
        base,
        extensions,
        ignore,
        collected,
      });
      continue;
    }

    if (
      !entry.isFile() ||
      !extensions.some((extension) => entry.name.endsWith(extension))
    ) {
      continue;
    }

    collected.push({
      file: relativePath,
      text: readFileSync(absolutePath, 'utf8'),
    });
  }
}

/**
 * Walks every configured root and returns its source files, sorted by path.
 *
 * @param {object} options - walk options.
 * @param {ReadonlyArray<string>} options.roots - base-relative directories to scan.
 * @param {ReadonlyArray<string>} options.extensions - accepted suffixes.
 * @param {ReadonlyArray<string>} [options.ignore] - ignored segments or prefixes.
 * @param {string} [options.base] - absolute directory the roots are relative to.
 * @returns {Array<SourceFile>} the collected files, sorted for stable output.
 * @throws {Error} when a root does not exist or cannot be read.
 */
export function walkSources({
  roots,
  extensions,
  ignore = [],
  base = process.cwd(),
}) {
  /** @type {Array<SourceFile>} */
  const collected = [];

  for (const root of roots) {
    collectDirectory({
      directory: resolve(base, root),
      base,
      extensions,
      ignore,
      collected,
    });
  }

  return collected.sort((left, right) => left.file.localeCompare(right.file));
}
