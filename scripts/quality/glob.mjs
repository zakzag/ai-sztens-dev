/**
 * Minimal glob → `RegExp` translation used by the quality gates.
 *
 * The gates deliberately avoid a glob dependency: the only patterns they need
 * are the ones written in `*.const.mjs` files, and a 30-line pure translation is
 * cheaper to review than a dependency tree. Supported syntax:
 *
 * - `**` — any number of path segments (`**​/` also matches zero segments)
 * - `*` — any characters except `/`
 * - `?` — exactly one character except `/`
 *
 * All paths handed to these helpers are **posix** (`/` separated, repo
 * relative), because [`walk-sources.mjs`](./walk-sources.mjs) normalises them —
 * that is what keeps Windows and Linux output identical.
 *
 * @module scripts/quality/glob
 */

/** Characters that must be escaped to be literal inside a regular expression. */
const REGEX_SPECIALS = '.+^$()[]{}|\\';

/**
 * Translates a glob pattern into an anchored `RegExp`.
 *
 * @param {string} pattern - glob pattern, e.g. `apps/*‍/src/**‍/*.logic.ts`.
 * @returns {RegExp} anchored regular expression matching that pattern.
 */
export function globToRegExp(pattern) {
  let source = '';

  for (let index = 0; index < pattern.length; index += 1) {
    const char = pattern[index];

    if (char === '*') {
      const isDoubleStar = pattern[index + 1] === '*';

      if (isDoubleStar && pattern[index + 2] === '/') {
        // `**/` also matches "no directory at all".
        source += '(?:.*/)?';
        index += 2;
        continue;
      }

      if (isDoubleStar) {
        source += '.*';
        index += 1;
        continue;
      }

      source += '[^/]*';
      continue;
    }

    if (char === '?') {
      source += '[^/]';
      continue;
    }

    source += REGEX_SPECIALS.includes(char) ? `\\${char}` : char;
  }

  return new RegExp(`^${source}$`);
}

/** Compiled-pattern cache, so a long file list does not rebuild regexes. */
const compiledGlobs = new Map();

/**
 * Tests one posix path against one glob pattern.
 *
 * @param {string} file - posix, repo-relative path.
 * @param {string} pattern - glob pattern.
 * @returns {boolean} `true` when the path matches.
 */
export function matchesGlob(file, pattern) {
  let compiled = compiledGlobs.get(pattern);

  if (compiled === undefined) {
    compiled = globToRegExp(pattern);
    compiledGlobs.set(pattern, compiled);
  }

  return compiled.test(file);
}

/**
 * Tests one posix path against a list of glob patterns.
 *
 * @param {string} file - posix, repo-relative path.
 * @param {ReadonlyArray<string>} patterns - glob patterns; an empty list never matches.
 * @returns {boolean} `true` when at least one pattern matches.
 */
export function matchesAnyGlob(file, patterns) {
  return patterns.some((pattern) => matchesGlob(file, pattern));
}
