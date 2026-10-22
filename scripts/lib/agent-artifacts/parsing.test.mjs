/**
 * Tests for the YAML subset parser and the `.roomodes` reader/validator.
 */

import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';

import { loadRoomodes } from './roomodes.mjs';
import { parseYamlSubset } from './yaml-lite.mjs';

const ROOMODES_FIXTURE = `customModes:
  - slug: jira-ticket-writer
    name: Jira Ticket Writer
    description: Writes Jira tickets
    roleDefinition: |-
      You are an expert task writer.

      Second paragraph with trailing space 
    whenToUse: Use it when the user asks you to create JIRA issues.
    customInstructions: |-
      Read the related docs first.
      Ask when ambiguous.
    groups:
      - read
      - edit
      - command
      - mcp
    source: project
`;

describe('parseYamlSubset', () => {
  it('parses nested maps, sequences and block scalars', () => {
    const document = parseYamlSubset(ROOMODES_FIXTURE);
    const [mode] = document.customModes;

    assert.equal(mode.slug, 'jira-ticket-writer');
    assert.equal(mode.description, 'Writes Jira tickets');
    assert.equal(mode.roleDefinition, 'You are an expert task writer.\n\nSecond paragraph with trailing space ');
    assert.deepEqual(mode.groups, ['read', 'edit', 'command', 'mcp']);
    assert.equal(mode.source, 'project');
  });

  it('supports flow sequences and quoted scalars', () => {
    const document = parseYamlSubset("groups: ['read', \"edit\"]\nname: 'Roo''s mode'\n");
    assert.deepEqual(document.groups, ['read', 'edit']);
    assert.equal(document.name, "Roo's mode");
  });

  it('ignores comment lines and blank lines between keys', () => {
    const document = parseYamlSubset('# top comment\nkey: value\n\n# inner\nother: 1\n');
    assert.deepEqual(document, { key: 'value', other: '1' });
  });

  it('throws on unexpected indentation', () => {
    assert.throws(() => parseYamlSubset('key: value\n   stray: x\n'), /Unexpected indentation/u);
  });

  it('throws when a line is not a key/value pair', () => {
    assert.throws(() => parseYamlSubset('just text\n'), /Expected "key: value"/u);
  });
});

describe('loadRoomodes', () => {
  /** @type {string} */
  let directory;

  before(async () => {
    directory = await mkdtemp(join(tmpdir(), 'roomodes-'));
  });

  after(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  /**
   * @param {string} content
   * @returns {Promise<string>} written path
   */
  async function writeRoomodes(content) {
    const file = join(directory, '.roomodes');
    await writeFile(file, content, 'utf8');
    return file;
  }

  it('returns the validated modes', async () => {
    const modes = await loadRoomodes(await writeRoomodes(ROOMODES_FIXTURE));
    assert.equal(modes.length, 1);
    assert.equal(modes[0].slug, 'jira-ticket-writer');
    assert.deepEqual(modes[0].groups, ['read', 'edit', 'command', 'mcp']);
  });

  it('defaults the groups to read when the mode has none', async () => {
    const file = await writeRoomodes(
      'customModes:\n  - slug: a\n    name: A\n    description: d\n    roleDefinition: r\n    whenToUse: w\n',
    );
    const [mode] = await loadRoomodes(file);
    assert.deepEqual(mode.groups, ['read']);
    assert.equal(mode.customInstructions, '');
  });

  it('rejects a missing required field', async () => {
    const file = await writeRoomodes('customModes:\n  - slug: a\n    name: A\n');
    await assert.rejects(() => loadRoomodes(file), /missing required field "description"/u);
  });

  it('rejects a duplicate slug', async () => {
    const entry = '  - slug: a\n    name: A\n    description: d\n    roleDefinition: r\n    whenToUse: w\n';
    const file = await writeRoomodes(`customModes:\n${entry}${entry}`);
    await assert.rejects(() => loadRoomodes(file), /duplicate mode slug "a"/u);
  });

  it('rejects an unknown tool group', async () => {
    const file = await writeRoomodes(
      'customModes:\n  - slug: a\n    name: A\n    description: d\n    roleDefinition: r\n    whenToUse: w\n    groups:\n      - telepathy\n',
    );
    await assert.rejects(() => loadRoomodes(file), /unknown group "telepathy"/u);
  });

  it('rejects an empty customModes list', async () => {
    const file = await writeRoomodes('customModes: []\n');
    await assert.rejects(() => loadRoomodes(file), /no customModes entries found/u);
  });

  it('reports a missing file', async () => {
    await assert.rejects(() => loadRoomodes(join(directory, 'nope')), /Cannot read/u);
  });
});
