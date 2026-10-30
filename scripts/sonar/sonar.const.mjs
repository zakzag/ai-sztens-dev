/**
 * Shared constants for the local SonarQube tooling.
 *
 * Everything here is deliberately data-only so the pure helpers in
 * `scan-config.mjs` and `lcov-merge.mjs` stay trivially testable.
 */

/** Default SonarQube server URL, overridable through `SONAR_HOST_URL`. */
export const DEFAULT_SERVER_URL = 'http://localhost:9000';

/** Local, git-ignored file that may carry `SONAR_TOKEN` / `SONAR_HOST_URL`. */
export const ENV_FILE_NAME = 'sonar.env';

/** Repo-root relative path of the merged LCOV report consumed by SonarQube. */
export const MERGED_LCOV_PATH = 'coverage/lcov.info';

/** Scanner property that makes the analysis fail on a red quality gate. */
export const QUALITYGATE_WAIT_PROPERTY = 'sonar.qualitygate.wait';

/**
 * Packages that emit an LCOV report, with the path of that report relative to
 * the repo root. Keep in sync with the `test:cov` scripts of each package.
 *
 * @type {ReadonlyArray<{ packageDir: string, lcovPath: string }>}
 */
export const COVERAGE_TARGETS = Object.freeze([
  { packageDir: 'packages/shared', lcovPath: 'coverage/shared/lcov.info' },
  {
    packageDir: 'packages/api-client',
    lcovPath: 'coverage/api-client/lcov.info',
  },
  { packageDir: 'packages/ui', lcovPath: 'coverage/ui/lcov.info' },
  { packageDir: 'apps/admin', lcovPath: 'coverage/admin/lcov.info' },
  { packageDir: 'apps/api', lcovPath: 'coverage/api/lcov.info' },
]);

/**
 * Directories that LCOV `SF:` entries may be relative to. Jest writes paths
 * relative to its `rootDir` (for `apps/api` that is `src`), Vitest writes them
 * relative to the package root, so a merge has to try both.
 *
 * @type {ReadonlyArray<string>}
 */
export const SOURCE_PATH_PREFIXES = Object.freeze(['', 'src']);
