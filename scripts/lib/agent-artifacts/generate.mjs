#!/usr/bin/env node
/**
 * Agent artefact generator.
 *
 * Single implementation behind `scripts/init.ps1` and `scripts/init.sh`:
 *   1. renders the concatenated agent instruction file from `.roo/rules/*.md`,
 *   2. renders one artefact per configured agent for every mode in `.roomodes`,
 *   3. writes them idempotently (UTF-8 no BOM, LF, one trailing newline, `.bak`),
 *   4. registers every generated file (and its `.bak`) in `.gitignore`.
 *
 * Usage:
 *   node scripts/lib/agent-artifacts/generate.mjs --agent copilot
 *   node scripts/lib/agent-artifacts/generate.mjs --agent cursor --check
 *   node scripts/lib/agent-artifacts/generate.mjs --agent claude --root <dir> --dry-run
 *
 * Exit codes: 0 = success, 1 = error, 2 = stale artefacts (`--check` only).
 */

import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { DEFAULT_EMIT, loadOverrides } from './overrides.mjs';
import { renderClaudeSubagent } from './render-claude.mjs';
import { renderCopilotChatMode } from './render-copilot.mjs';
import { renderCursorCommand, renderCursorRule } from './render-cursor.mjs';
import { AGENT_SPECS, discoverRuleSources, renderInstructionFile } from './rules.mjs';
import { loadRoomodes } from './roomodes.mjs';
import { syncGitignore, writeArtifact } from './writer.mjs';

const ROOMODES_FILE = '.roomodes';
const OVERRIDES_PATH = join('scripts', 'lib', 'agent-artifacts', 'mode-overrides.json');

/**
 * @typedef {object} Options
 * @property {string} agent
 * @property {string} root
 * @property {boolean} dryRun
 * @property {boolean} check
 */

/**
 * @param {string[]} argv
 * @returns {Options}
 */
export function parseArgs(argv) {
  /** @type {Options} */
  const options = { agent: '', root: process.cwd(), dryRun: false, check: false };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--agent') {
      options.agent = argv[index + 1] ?? '';
      index += 1;
      continue;
    }
    if (arg === '--root') {
      options.root = argv[index + 1] ?? '';
      index += 1;
      continue;
    }
    if (arg === '--dry-run') {
      options.dryRun = true;
      continue;
    }
    if (arg === '--check') {
      options.check = true;
      continue;
    }
    throw new Error(`Unknown argument "${arg}"`);
  }

  if (!Object.prototype.hasOwnProperty.call(AGENT_SPECS, options.agent)) {
    throw new Error(`--agent is required and must be one of: ${Object.keys(AGENT_SPECS).join(', ')}`);
  }
  if (options.root === '') {
    throw new Error('--root must not be empty');
  }
  return options;
}

/**
 * Render every artefact of an agent.
 *
 * @param {Options} options
 * @returns {Promise<import('./rules.mjs').Artifact[]>}
 */
export async function buildArtifacts(options) {
  const { sources, missingPrimary } = await discoverRuleSources(options.root);
  for (const source of sources) {
    console.log(`[i] Forrás: ${source}`);
  }
  if (missingPrimary) {
    console.warn('[!] Hiányzó elsődleges forrás (kihagyva): .roo/rules/instructions.md');
  }

  /** @type {import('./rules.mjs').Artifact[]} */
  const artifacts = [await renderInstructionFile(options.agent, options.root, sources)];
  artifacts.push(...(await buildModeArtifacts(options)));
  return artifacts;
}

/**
 * @param {Options} options
 * @returns {Promise<import('./rules.mjs').Artifact[]>}
 */
async function buildModeArtifacts(options) {
  const roomodesPath = join(options.root, ROOMODES_FILE);
  if (!existsSync(roomodesPath)) {
    console.warn(`[!] ${ROOMODES_FILE} nem található - mode artefakt kihagyva.`);
    return [];
  }

  const modes = await loadRoomodes(roomodesPath);
  const overrides = await loadOverrides(join(options.root, OVERRIDES_PATH));

  /** @type {import('./rules.mjs').Artifact[]} */
  const artifacts = [];
  for (const mode of modes) {
    const override = overrides[mode.slug] ?? {};
    const emit = override.emit ?? DEFAULT_EMIT;
    console.log(`[i] Mode: ${mode.slug} (${mode.groups.join(', ')}) -> ${emit.join(', ')}`);

    if (options.agent === 'copilot' && emit.includes('copilot-chatmode')) {
      artifacts.push(renderCopilotChatMode(mode, override));
    }
    if (options.agent === 'claude' && emit.includes('claude-agent')) {
      artifacts.push(renderClaudeSubagent(mode, override));
    }
    if (options.agent === 'cursor') {
      if (emit.includes('cursor-command')) {
        artifacts.push(renderCursorCommand(mode));
      }
      if (emit.includes('cursor-rule')) {
        artifacts.push(renderCursorRule(mode));
      }
    }
  }
  return artifacts;
}

/**
 * @returns {Promise<number>} exit code
 */
async function main() {
  const options = parseArgs(process.argv.slice(2));
  const root = resolve(options.root);

  const artifacts = await buildArtifacts({ ...options, root });
  const statuses = [];
  for (const artifact of artifacts) {
    const status = await writeArtifact({
      repoRoot: root,
      relativePath: artifact.relativePath,
      content: artifact.content,
      dryRun: options.dryRun || options.check,
    });
    statuses.push({ path: artifact.relativePath, status });
  }

  if (options.check) {
    const stale = statuses.filter((entry) => entry.status === 'planned');
    for (const entry of stale) {
      console.warn(`[!] Elavult: ${entry.path}`);
    }
    return stale.length > 0 ? 2 : 0;
  }

  const gitignore = await syncGitignore({
    repoRoot: root,
    relativePaths: artifacts.map((artifact) => artifact.relativePath),
    dryRun: options.dryRun,
  });
  if (gitignore.warning !== null) {
    console.warn(`[!] ${gitignore.warning}`);
  }
  for (const entry of gitignore.added) {
    const label = options.dryRun ? '[i] .gitignore bejegyzés hozzáadandó' : '[+] .gitignore frissítve';
    console.log(`${label}: ${entry}`);
  }

  for (const entry of statuses) {
    if (entry.status === 'written') {
      console.log(`[+] Célfájl írva: ${entry.path}`);
    } else if (entry.status === 'unchanged') {
      console.log(`[+] A célfájl már naprakész: ${entry.path}`);
    } else {
      console.log(`[i] Írandó (dry-run): ${entry.path}`);
    }
  }
  return 0;
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error) => {
    console.error(`[x] ${error.message}`);
    process.exitCode = 1;
  });
