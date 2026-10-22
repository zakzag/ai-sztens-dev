/**
 * `.roomodes` reader.
 *
 * The repository root `.roomodes` file is the single source of truth for the
 * project-level Zoo Code custom modes. It is authored in the Zoo Code UI (or by
 * hand) and is NEVER written by this tool - the generator only reads it and
 * derives the per-agent artefacts from it.
 */

import { readFile } from 'node:fs/promises';

import { parseYamlSubset } from './yaml-lite.mjs';

/** Fields Zoo Code needs for a usable mode. */
export const REQUIRED_MODE_FIELDS = Object.freeze([
  'slug',
  'name',
  'description',
  'roleDefinition',
  'whenToUse',
]);

/** Tool groups understood by Zoo Code. */
export const KNOWN_GROUPS = Object.freeze(['read', 'edit', 'browser', 'command', 'mcp']);

const DEFAULT_GROUPS = Object.freeze(['read']);

/**
 * @typedef {object} Roomode
 * @property {string} slug stable identifier, used in every generated file name
 * @property {string} name display name
 * @property {string} description one-line summary
 * @property {string} roleDefinition persona / expectations
 * @property {string} whenToUse routing hint
 * @property {string} customInstructions workflow instructions (may be empty)
 * @property {string[]} groups Zoo Code tool groups
 */

/**
 * Read and validate the `.roomodes` file.
 *
 * @param {string} filePath absolute or repo-relative path of the `.roomodes` file
 * @returns {Promise<Roomode[]>} validated modes, in file order
 * @throws {Error} when the file is missing, unparsable or invalid
 */
export async function loadRoomodes(filePath) {
  let source;
  try {
    source = await readFile(filePath, 'utf8');
  } catch (error) {
    throw new Error(`Cannot read ${filePath}: ${error.message}`);
  }

  let document;
  try {
    document = parseYamlSubset(source);
  } catch (error) {
    throw new Error(`Cannot parse ${filePath}: ${error.message}`);
  }

  const rawModes = document?.customModes;
  if (!Array.isArray(rawModes) || rawModes.length === 0) {
    throw new Error(`${filePath}: no customModes entries found`);
  }

  const modes = rawModes.map((entry, index) => normalizeMode(entry, index, filePath));
  assertUniqueSlugs(modes, filePath);
  return modes;
}

/**
 * @param {unknown} entry raw parsed entry
 * @param {number} index position in the array, for error messages
 * @param {string} filePath for error messages
 * @returns {Roomode}
 */
function normalizeMode(entry, index, filePath) {
  if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) {
    throw new Error(`${filePath}: customModes[${index}] is not a mapping`);
  }

  /** @type {Roomode} */
  const mode = {
    slug: '',
    name: '',
    description: '',
    roleDefinition: '',
    whenToUse: '',
    customInstructions: '',
    groups: [...DEFAULT_GROUPS],
  };

  for (const field of REQUIRED_MODE_FIELDS) {
    const value = entry[field];
    if (typeof value !== 'string' || value.trim() === '') {
      throw new Error(`${filePath}: customModes[${index}] is missing required field "${field}"`);
    }
    mode[field] = value;
  }

  const instructions = entry.customInstructions;
  if (typeof instructions === 'string') {
    mode.customInstructions = instructions;
  }

  if (entry.groups !== undefined) {
    mode.groups = normalizeGroups(entry.groups, index, filePath);
  }

  return mode;
}

/**
 * @param {unknown} groups raw groups value
 * @param {number} index position in the array, for error messages
 * @param {string} filePath for error messages
 * @returns {string[]}
 */
function normalizeGroups(groups, index, filePath) {
  const list = Array.isArray(groups) ? groups : [groups];
  /** @type {string[]} */
  const result = [];
  for (const group of list) {
    const name = String(group).trim();
    if (name === '') {
      continue;
    }
    if (!KNOWN_GROUPS.includes(name)) {
      throw new Error(
        `${filePath}: customModes[${index}] has unknown group "${name}" (known: ${KNOWN_GROUPS.join(', ')})`,
      );
    }
    result.push(name);
  }
  return result.length > 0 ? result : [...DEFAULT_GROUPS];
}

/**
 * @param {Roomode[]} modes
 * @param {string} filePath for error messages
 * @returns {void}
 */
function assertUniqueSlugs(modes, filePath) {
  const seen = new Set();
  for (const mode of modes) {
    if (seen.has(mode.slug)) {
      throw new Error(`${filePath}: duplicate mode slug "${mode.slug}"`);
    }
    seen.add(mode.slug);
  }
}
