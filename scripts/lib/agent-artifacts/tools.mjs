/**
 * Zoo Code tool-group -> per-agent tool identifier mapping.
 *
 * Zoo Code restricts a mode through `groups` (read / edit / browser / command /
 * mcp). Copilot chat modes and Claude Code subagents both accept a `tools` list
 * in their frontmatter, but the identifiers differ per product and per version.
 * The defaults below are the documented names at the time of writing; a mode can
 * override them in `mode-overrides.json` without touching this table.
 *
 * NOTE: verify these identifiers against the target product's documentation
 * whenever the agent integration is upgraded.
 */

/** @typedef {'read' | 'edit' | 'browser' | 'command' | 'mcp'} ToolGroup */

/** @type {Record<ToolGroup, string[]>} */
export const COPILOT_TOOLS_BY_GROUP = Object.freeze({
  read: ['codebase', 'search', 'usages', 'problems'],
  edit: ['editFiles'],
  command: ['runCommands', 'runTasks'],
  browser: ['fetch'],
  mcp: ['mcpServers'],
});

/** @type {Record<ToolGroup, string[]>} */
export const CLAUDE_TOOLS_BY_GROUP = Object.freeze({
  read: ['Read', 'Grep', 'Glob'],
  edit: ['Edit', 'Write'],
  command: ['Bash'],
  browser: ['WebFetch', 'WebSearch'],
  mcp: ['mcp__*'],
});

/**
 * Map Zoo Code groups to Copilot chat-mode tool identifiers.
 *
 * @param {string[]} groups Zoo Code groups of the mode
 * @param {string[] | undefined} override explicit tool list from the overrides file
 * @returns {string[]} de-duplicated tool identifiers
 */
export function toCopilotTools(groups, override) {
  return dedupe(override ?? groups.flatMap((group) => COPILOT_TOOLS_BY_GROUP[group] ?? []));
}

/**
 * Map Zoo Code groups to Claude Code subagent tool identifiers.
 *
 * @param {string[]} groups Zoo Code groups of the mode
 * @param {string[] | undefined} override explicit tool list from the overrides file
 * @returns {string[]} de-duplicated tool identifiers
 */
export function toClaudeTools(groups, override) {
  return dedupe(override ?? groups.flatMap((group) => CLAUDE_TOOLS_BY_GROUP[group] ?? []));
}

/**
 * @param {string[]} values
 * @returns {string[]}
 */
function dedupe(values) {
  return [...new Set(values.filter((value) => typeof value === 'string' && value.trim() !== ''))];
}
