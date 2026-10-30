/**
 * Per-mode overrides.
 *
 * The `.roomodes` file belongs to Zoo Code (the UI rewrites it and may drop
 * unknown keys), so anything this generator needs beyond the Zoo Code schema
 * lives in `mode-overrides.json` next to this module.
 *
 * Shape:
 *   {
 *     "<slug>": {
 *       "emit": ["copilot-chatmode", "claude-agent", "cursor-command", "cursor-rule"],
 *       "copilotTools": ["codebase", "editFiles"],
 *       "claudeTools": ["Read", "Edit"]
 *     }
 *   }
 */

import { readFile } from 'node:fs/promises';

/** Artefacts a mode can emit. */
export const EMITTABLE = Object.freeze([
  'copilot-chatmode',
  'claude-agent',
  'cursor-command',
  'cursor-rule',
]);

/** Emitted when a mode has no explicit `emit` list. */
export const DEFAULT_EMIT = EMITTABLE;

/**
 * @typedef {object} ModeOverride
 * @property {string[]} [emit] artefacts to generate for this mode
 * @property {string[]} [copilotTools] explicit Copilot tool identifiers
 * @property {string[]} [claudeTools] explicit Claude tool identifiers
 */

/**
 * Load `mode-overrides.json`.
 *
 * @param {string} filePath path of the overrides file
 * @returns {Promise<Record<string, ModeOverride>>} overrides by slug (empty when the file is absent)
 * @throws {Error} when the file exists but is invalid
 */
export async function loadOverrides(filePath) {
  let source;
  try {
    source = await readFile(filePath, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') {
      return {};
    }
    throw new Error(`Cannot read ${filePath}: ${error.message}`);
  }

  let parsed;
  try {
    parsed = JSON.parse(source);
  } catch (error) {
    throw new Error(`Cannot parse ${filePath}: ${error.message}`);
  }

  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`${filePath}: expected an object keyed by mode slug`);
  }

  /** @type {Record<string, ModeOverride>} */
  const result = {};
  for (const [slug, value] of Object.entries(parsed)) {
    result[slug] = normalizeOverride(slug, value, filePath);
  }
  return result;
}

/**
 * @param {string} slug
 * @param {unknown} value
 * @param {string} filePath for error messages
 * @returns {ModeOverride}
 */
function normalizeOverride(slug, value, filePath) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${filePath}: override for "${slug}" must be an object`);
  }

  /** @type {ModeOverride} */
  const override = {};

  if (value.emit !== undefined) {
    const emit = toStringArray(value.emit, `${filePath}: "${slug}".emit`);
    for (const item of emit) {
      if (!EMITTABLE.includes(item)) {
        throw new Error(
          `${filePath}: "${slug}".emit contains unknown artefact "${item}" (known: ${EMITTABLE.join(', ')})`,
        );
      }
    }
    override.emit = emit;
  }
  if (value.copilotTools !== undefined) {
    override.copilotTools = toStringArray(
      value.copilotTools,
      `${filePath}: "${slug}".copilotTools`,
    );
  }
  if (value.claudeTools !== undefined) {
    override.claudeTools = toStringArray(
      value.claudeTools,
      `${filePath}: "${slug}".claudeTools`,
    );
  }

  return override;
}

/**
 * @param {unknown} value
 * @param {string} label for error messages
 * @returns {string[]}
 */
function toStringArray(value, label) {
  const list = Array.isArray(value) ? value : [value];
  const result = list
    .map((item) => String(item).trim())
    .filter((item) => item !== '');
  if (result.length === 0) {
    throw new Error(`${label} must not be empty`);
  }
  return result;
}
