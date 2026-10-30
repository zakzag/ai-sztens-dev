/**
 * Runs a SonarQube analysis of the whole monorepo against a local server.
 *
 * Flow: read the optional `sonar.env` → validate configuration → verify that the
 * server is up (`/api/system/status`) → delegate to the `@sonar/scan` scanner.
 *
 * The scanner package ships its own JRE provisioning, so no separate scanner
 * CLI or Java installation is needed. The token is never logged.
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ENV_FILE_NAME, QUALITYGATE_WAIT_PROPERTY } from './sonar.const.mjs';
import { SonarConfigError, SonarServerError } from './sonar.errors.mjs';
import { mergeEnv, readEnvFile, resolveConfig } from './scan-config.mjs';

/** Absolute path of the repository root (two levels above this file). */
export const REPO_ROOT = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
);

/** Health states SonarQube reports while it is still starting up. */
const NOT_READY_STATUSES = new Set([
  'STARTING',
  'MIGRATION_REQUIRED',
  'DB_MIGRATION_NEEDED',
  'DOWN',
]);

/**
 * Asks SonarQube for its system status and fails fast when it is not usable.
 *
 * @param {string} serverUrl normalised server URL
 * @param {typeof fetch} [fetchImpl] injectable fetch (tests)
 * @returns {Promise<{ status: string, version?: string }>}
 * @throws {SonarServerError} when the server is unreachable, answers with an error or is not `UP`
 */
export async function checkServerStatus(serverUrl, fetchImpl = fetch) {
  const statusUrl = `${serverUrl}/api/system/status`;

  let response;
  try {
    response = await fetchImpl(statusUrl);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new SonarServerError(
      `A SonarQube nem érhető el a(z) ${serverUrl} címen (${reason}). ` +
        'Indítsd el a szolgáltatást, vagy állítsd be a megfelelő SONAR_HOST_URL-t.',
    );
  }

  if (!response.ok) {
    throw new SonarServerError(
      `A SonarQube a(z) ${statusUrl} hívásra ${response.status} státusszal válaszolt. ` +
        'Ellenőrizd, hogy a SonarQube (és nem egy proxy) fut ezen a címen.',
    );
  }

  const payload = await response.json();
  const status = String(payload.status ?? 'UNKNOWN');
  if (NOT_READY_STATUSES.has(status) || status !== 'UP') {
    throw new SonarServerError(
      `A SonarQube státusza "${status}", tehát még nem tud elemzést fogadni. ` +
        'Várd meg a teljes indulást (http://localhost:9000), majd futtasd újra.',
    );
  }

  return payload;
}

/**
 * Builds the option object the scanner expects.
 *
 * @param {{ serverUrl: string, token: string, waitForQualityGate: boolean }} config
 * @returns {{ serverUrl: string, token: string, options?: Record<string, string> }}
 */
export function buildScanOptions(config) {
  /** @type {{ serverUrl: string, token: string, options?: Record<string, string> }} */
  const scanOptions = { serverUrl: config.serverUrl, token: config.token };

  if (config.waitForQualityGate) {
    scanOptions.options = { [QUALITYGATE_WAIT_PROPERTY]: 'true' };
  }

  return scanOptions;
}

/**
 * Orchestrates the whole scan.
 *
 * @param {{
 *   env?: Record<string, string | undefined>,
 *   repoRoot?: string,
 *   log?: Pick<Console, 'log' | 'warn'>,
 *   fetchImpl?: typeof fetch,
 *   scanImpl?: (options: object) => Promise<unknown>,
 * }} [dependencies] injectable dependencies (tests)
 * @returns {Promise<void>}
 * @throws {SonarConfigError | SonarServerError} on configuration or connectivity problems
 */
export async function main({
  env = process.env,
  repoRoot = REPO_ROOT,
  log = console,
  fetchImpl = fetch,
  scanImpl,
} = {}) {
  const fileEnv = readEnvFile(join(repoRoot, ENV_FILE_NAME), {
    fileExists: (path) => existsSync(path),
    readFile: (path) => readFileSync(path, 'utf8'),
  });

  const config = resolveConfig(mergeEnv(env, fileEnv));
  const status = await checkServerStatus(config.serverUrl, fetchImpl);
  log.log(`SonarQube elérhető: ${config.serverUrl} (status: ${status.status})`);

  const scanner = scanImpl ?? (await loadScanner());
  await scanner(buildScanOptions(config));
  log.log('SonarQube elemzés elküldve, a riport a szerveren érhető el.');
}

/**
 * Loads the `scan` function of `@sonar/scan` (CJS module, named export).
 *
 * @returns {Promise<(options: object) => Promise<unknown>>}
 * @throws {SonarConfigError} when the scanner package is not installed
 */
async function loadScanner() {
  try {
    const scannerModule = await import('@sonar/scan');
    const scan = scannerModule.scan ?? scannerModule.default;
    return scan;
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new SonarConfigError(
      `A @sonar/scan scanner nem tölthető be (${reason}). Futtasd: pnpm install`,
    );
  }
}

const invokedPath =
  process.argv[1] === undefined ? '' : resolve(process.argv[1]);
if (invokedPath === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
