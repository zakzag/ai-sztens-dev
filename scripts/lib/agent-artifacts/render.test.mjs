/**
 * Tests for the tool mapping and the three renderers.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { renderClaudeSubagent } from './render-claude.mjs';
import { renderCopilotChatMode } from './render-copilot.mjs';
import { renderCursorCommand, renderCursorRule } from './render-cursor.mjs';
import { toClaudeTools, toCopilotTools } from './tools.mjs';

/** @type {import('./roomodes.mjs').Roomode} */
const MODE = {
  slug: 'jira-ticket-writer',
  name: 'Jira Ticket Writer',
  description: 'Writes Jira tickets',
  roleDefinition: 'You are an expert task writer.',
  whenToUse: 'Use it when the user asks for a JIRA issue.',
  customInstructions: 'Read the docs first.',
  groups: ['read', 'command'],
};

describe('tool mapping', () => {
  it('maps read+command groups to Copilot tool ids', () => {
    assert.deepEqual(toCopilotTools(['read', 'command']), [
      'codebase',
      'search',
      'usages',
      'problems',
      'runCommands',
      'runTasks',
    ]);
  });

  it('maps read+command groups to Claude tool ids', () => {
    assert.deepEqual(toClaudeTools(['read', 'command']), [
      'Read',
      'Grep',
      'Glob',
      'Bash',
    ]);
  });

  it('prefers the explicit override and de-duplicates it', () => {
    assert.deepEqual(toCopilotTools(['read'], ['editFiles', 'editFiles']), [
      'editFiles',
    ]);
    assert.deepEqual(toClaudeTools(['read'], ['Bash']), ['Bash']);
  });
});

describe('renderCopilotChatMode', () => {
  it('renders the chatmode path and frontmatter', () => {
    const artifact = renderCopilotChatMode(MODE);
    assert.equal(
      artifact.relativePath,
      '.github/chatmodes/jira-ticket-writer.chatmode.md',
    );
    assert.match(
      artifact.content,
      /^---\ndescription: Writes Jira tickets\ntools: \['codebase', /u,
    );
    assert.match(
      artifact.content,
      /## Role\n\nYou are an expert task writer\./u,
    );
    assert.match(
      artifact.content,
      /## When to use\n\nUse it when the user asks for a JIRA issue\./u,
    );
    assert.match(artifact.content, /## Workflow\n\nRead the docs first\./u);
    assert.ok(artifact.content.endsWith('\n'));
  });

  it('omits the workflow section when there are no custom instructions', () => {
    const artifact = renderCopilotChatMode({ ...MODE, customInstructions: '' });
    assert.doesNotMatch(artifact.content, /## Workflow/u);
  });
});

describe('renderClaudeSubagent', () => {
  it('renders the subagent path, name and folded description', () => {
    const artifact = renderClaudeSubagent(MODE);
    assert.equal(artifact.relativePath, '.claude/agents/jira-ticket-writer.md');
    assert.match(artifact.content, /^---\nname: jira-ticket-writer\n/u);
    assert.match(
      artifact.content,
      /description: Writes Jira tickets\. Use when the user asks for a JIRA issue\./u,
    );
    assert.match(artifact.content, /tools: Read, Grep, Glob, Bash\n/u);
  });
});

describe('renderCursorCommand / renderCursorRule', () => {
  it('renders the command as an invocable prompt', () => {
    const artifact = renderCursorCommand(MODE);
    assert.equal(
      artifact.relativePath,
      '.cursor/commands/jira-ticket-writer.md',
    );
    assert.match(artifact.content, /Act as the "Jira Ticket Writer" mode/u);
    assert.match(artifact.content, /## Role/u);
  });

  it('renders the rule as on-demand (alwaysApply false)', () => {
    const artifact = renderCursorRule(MODE);
    assert.equal(artifact.relativePath, '.cursor/rules/jira-ticket-writer.mdc');
    assert.match(
      artifact.content,
      /^---\ndescription: Writes Jira tickets\nglobs:\nalwaysApply: false\n---\n/u,
    );
  });
});
