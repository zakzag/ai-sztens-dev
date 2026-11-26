/**
 * Pure helpers of the Vite build wrapper (`vite-build.mjs`).
 *
 * Split out so the two decisions the wrapper makes — *which environment the
 * bundler must inherit* and *where the app's own `vite` lives* — are testable
 * without spawning a process (see `vite-build.logic.test.mjs`).
 *
 * Background: `esbuild` reads `os.tmpdir()` (i.e. `TEMP`/`TMP`/`TMPDIR`) when it
 * starts, writes the module it is about to transpile there and deletes it right
 * after. On Windows that delete intermittently fails with `Access is denied`
 * when the profile temp directory is scanned/locked, which kills
 * `vite build` after `483 modules transformed`. Pointing the whole Vite process
 * tree at a project-local directory removes the failure mode.
 */

/** Path of the Vite CLI inside an app's `node_modules`, relative to the app. */
export const VITE_BIN_RELATIVE_PATH = 'node_modules/vite/bin/vite.js';

/** Environment variables esbuild's temp-directory lookup reads. */
export const TEMP_ENV_VARS = ['TEMP', 'TMP', 'TMPDIR'];

/**
 * Copies an environment and rewrites every temp-directory variable.
 *
 * Everything else is preserved, so `PATH`, `NODE_OPTIONS`, CI secrets and the
 * `--mode`-relevant `NODE_ENV` survive unchanged; only the three temp variables
 * are forced, including ones that were previously unset.
 *
 * @param baseEnv - the environment to copy, normally `process.env`.
 * @param tempDir - absolute directory the bundler must use for its temp files.
 * @returns a new environment object; the input is never mutated.
 */
export function toBuildEnv(baseEnv, tempDir) {
  const env = { ...baseEnv };

  for (const name of TEMP_ENV_VARS) {
    env[name] = tempDir;
  }

  return env;
}

/**
 * @param appDir - absolute path of the app being built (its package directory).
 * @returns the absolute path of the app's local Vite CLI entry point.
 */
export function toViteBinPath(appDir) {
  return `${appDir}/${VITE_BIN_RELATIVE_PATH}`;
}
