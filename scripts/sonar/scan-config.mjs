/**
 * Pure configuration helpers for the SonarQube scan script.
 *
 * No I/O happens here: file reading and `fetch` are injected by the caller so
 * every branch is unit-testable without touching the file system or network.
 */

import { DEFAULT_SERVER_URL } from './sonar.const.mjs';
import { SonarConfigError } from './sonar.errors.mjs';

/**
 * Parses a dotenv-style file (`KEY=VALUE` lines, `#` comments, optional quotes).
 *
 * @param {string} content raw file content
 * @returns {Record<string, string>} parsed key/value pairs (empty on no match)
 */
export function parseEnvFile(content) {
  /** @type {Record<string, string>} */
  const parsed = {};

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === '' || line.startsWith('#')) {
      continue;
    }

    const separatorIndex = line.indexOf('=');
    if (separatorIndex <= 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = stripQuotes(line.slice(separatorIndex + 1).trim());
    if (key !== '') {
      parsed[key] = value;
    }
  }

  return parsed;
}

/**
 * Reads the optional local env file.
 *
 * @param {string} envPath absolute path of the env file
 * @param {{ fileExists: (path: string) => boolean, readFile: (path: string) => string }} io injected I/O
 * @returns {Record<string, string>} `{}` when the file is absent
 */
export function readEnvFile(envPath, io) {
  if (!io.fileExists(envPath)) {
    return {};
  }

  return parseEnvFile(io.readFile(envPath));
}

/**
 * Merges the optional env file with the real process environment.
 * The real environment wins, so CI secrets override a stale local file.
 *
 * @param {Record<string, string | undefined>} processEnv
 * @param {Record<string, string>} fileEnv
 * @returns {Record<string, string | undefined>}
 */
export function mergeEnv(processEnv, fileEnv) {
  return { ...fileEnv, ...processEnv };
}

/**
 * Resolves the scanner configuration from an environment.
 *
 * @param {Record<string, string | undefined>} env
 * @returns {{ serverUrl: string, token: string, waitForQualityGate: boolean }}
 * @throws {SonarConfigError} when the token is missing or the URL is invalid
 */
export function resolveConfig(env) {
  const token = (env.SONAR_TOKEN ?? '').trim();
  if (token === '') {
    throw new SonarConfigError(
      'Hiányzó SONAR_TOKEN. Generálj tokent a SonarQube felületén ' +
        '(My Account → Security), majd tedd a sonar.env fájlba vagy exportáld ' +
        'SONAR_TOKEN néven. Minta: sonar.env.example',
    );
  }

  const serverUrl = normalizeServerUrl(env.SONAR_HOST_URL);
  const waitForQualityGate = isTruthy(env.SONAR_QUALITYGATE_WAIT);

  return { serverUrl, token, waitForQualityGate };
}

/**
 * Normalises the server URL: trims, drops a trailing slash, validates the scheme.
 *
 * @param {string | undefined} rawUrl
 * @returns {string}
 * @throws {SonarConfigError} when the URL is not http(s)
 */
export function normalizeServerUrl(rawUrl) {
  const candidate = (rawUrl ?? '').trim();
  const serverUrl = (candidate === '' ? DEFAULT_SERVER_URL : candidate).replace(
    /\/+$/,
    '',
  );

  if (!/^https?:\/\//i.test(serverUrl)) {
    throw new SonarConfigError(
      `Érvénytelen SONAR_HOST_URL: "${serverUrl}". http:// vagy https:// címet adj meg, ` +
        `például ${DEFAULT_SERVER_URL}.`,
    );
  }

  return serverUrl;
}

/**
 * Interprets the common boolean spellings used in env files.
 *
 * @param {string | undefined} value
 * @returns {boolean}
 */
export function isTruthy(value) {
  return /^(1|true|yes|on)$/i.test((value ?? '').trim());
}

/**
 * Removes a single layer of matching single or double quotes.
 *
 * @param {string} value
 * @returns {string}
 */
function stripQuotes(value) {
  const isQuoted =
    value.length >= 2 &&
    ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'")));

  return isQuoted ? value.slice(1, -1) : value;
}
