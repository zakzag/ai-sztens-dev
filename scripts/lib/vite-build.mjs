#!/usr/bin/env node
/**
 * Runs a workspace app's local `vite` CLI with a project-local temp directory.
 *
 * ## Why this exists
 *
 * Vite's `esbuild-transpile` step writes the module it is about to lower into a
 * temp file, hands the file to the `esbuild` service and **deletes** it right
 * after. On Windows that delete intermittently fails with
 *
 * ```text
 * [vite:esbuild-transpile] remove C:\Users\<user>\AppData\Local\Temp\esbuild-<hash>:
 * Access is denied.
 * ```
 *
 * because a scanner (or any other handle holder) still owns the file in the
 * profile temp directory. The build then dies *after* `483 modules transformed`,
 * i.e. the code is fine and the environment is not. `esbuild` resolves its temp
 * directory from `os.tmpdir()` — which reads `TEMP`/`TMP`/`TMPDIR` **at process
 * start** — so the only reliable fix is to set those variables *before* Vite
 * starts. A `vite.config.ts` cannot do it: it is itself transpiled by esbuild
 * before any of its code runs.
 *
 * Hence `<repo>/.tmp/esbuild` (git-ignored) becomes the temp directory of the
 * whole Vite process tree — same volume as the project, short path, untouched by
 * profile-level tooling.
 *
 * ## Usage
 *
 * ```jsonc
 * // apps/<app>/package.json
 * "build": "tsc --noEmit -p tsconfig.json && node ../../scripts/lib/vite-build.mjs build"
 * ```
 *
 * Every argument is forwarded to Vite, so `build --mode prod` works unchanged.
 * The child's exit code (or signal) is propagated, so `pnpm -r build` fails
 * exactly when `vite` fails.
 */

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { toBuildEnv, toViteBinPath } from './vite-build.logic.mjs';

/** Repository root, derived from this file (`<repo>/scripts/lib/vite-build.mjs`). */
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Directory handed to esbuild as `TEMP`/`TMP`/`TMPDIR`. */
const BUILD_TEMP_DIR = join(REPO_ROOT, '.tmp', 'esbuild');

/**
 * @param appDir - the package directory whose `vite` must be used.
 * @returns the app's local Vite CLI entry point.
 * @throws {Error} when it is missing, i.e. dependencies were never installed.
 */
function requireViteBin(appDir) {
  const bin = toViteBinPath(appDir);

  if (!existsSync(bin)) {
    throw new Error(
      `vite-build: no local vite at ${bin} — run \`pnpm install\` in the repository root first.`,
    );
  }

  return bin;
}

/**
 * Spawns `vite <forwarded args>` and mirrors its outcome onto this process.
 */
function main() {
  mkdirSync(BUILD_TEMP_DIR, { recursive: true });

  const appDir = process.cwd();
  const child = spawn(
    process.execPath,
    [requireViteBin(appDir), ...process.argv.slice(2)],
    { cwd: appDir, env: toBuildEnv(process.env, BUILD_TEMP_DIR), stdio: 'inherit' },
  );

  child.on('error', (error) => {
    console.error(`vite-build: failed to start vite: ${error.message}`);
    process.exit(1);
  });

  child.on('exit', (code, signal) => {
    if (signal !== null) {
      // Re-raise the same signal, so a CI interrupt is not reported as a plain exit.
      process.kill(process.pid, signal);
      return;
    }

    process.exit(code ?? 1);
  });
}

main();
