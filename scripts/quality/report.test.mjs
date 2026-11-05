/**
 * Behaviour tests of the shared reporter: the `file:line: [rule] snippet`
 * format and the exit contract every gate relies on.
 *
 * Run with `pnpm test:quality`.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  SNIPPET_MAX_LENGTH,
  exitWith,
  formatViolation,
  formatViolations,
  normalizeSnippet,
} from './report.mjs';

/**
 * Builds an in-memory sink so a red gate never terminates the test runner.
 *
 * @returns {{ log: Array<string>, error: Array<string>, exits: Array<number>, io: object }} the recorded calls and the sink.
 */
function createRecordingIo() {
  const log = [];
  const error = [];
  const exits = [];

  return {
    log,
    error,
    exits,
    io: {
      log: (message) => log.push(message),
      error: (message) => error.push(message),
      exit: (code) => exits.push(code),
    },
  };
}

test('formats a violation as file:line: [rule] snippet', () => {
  const formatted = formatViolation({
    file: 'apps/web/src/App.tsx',
    line: 8,
    rule: 'no-palette-utility',
    snippet: '  <header className="bg-slate-900">',
  });

  assert.equal(
    formatted,
    'apps/web/src/App.tsx:8: [no-palette-utility] <header className="bg-slate-900">',
  );
});

test('omits the snippet separator when there is no snippet', () => {
  assert.equal(
    formatViolation({ file: 'a.ts', line: 1, rule: 'no-orphans' }),
    'a.ts:1: [no-orphans]',
  );
});

test('collapses multi-line whitespace into a single printable line', () => {
  assert.equal(normalizeSnippet('  a\n\t b   c  '), 'a b c');
});

test('truncates a long snippet', () => {
  const normalized = normalizeSnippet('x'.repeat(SNIPPET_MAX_LENGTH + 50));

  assert.equal(normalized.length, SNIPPET_MAX_LENGTH);
  assert.equal(normalized.endsWith('...'), true);
});

test('formats every violation in order', () => {
  const lines = formatViolations([
    { file: 'a.ts', line: 1, rule: 'r1' },
    { file: 'b.ts', line: 2, rule: 'r2' },
  ]);

  assert.deepEqual(lines, ['a.ts:1: [r1]', 'b.ts:2: [r2]']);
});

test('exits 0 and prints a summary line when the gate is clean', () => {
  const { log, error, exits, io } = createRecordingIo();

  const code = exitWith([], 'quality:tokens', io);

  assert.equal(code, 0);
  assert.deepEqual(log, ['OK quality:tokens: 0 violations']);
  assert.deepEqual(error, []);
  assert.deepEqual(exits, []);
});

test('exits 1 and prints every violation when the gate is red', () => {
  const { log, error, exits, io } = createRecordingIo();

  const code = exitWith(
    [
      {
        file: 'a.ts',
        line: 3,
        rule: 'no-palette-utility',
        snippet: 'bg-slate-800',
      },
    ],
    'quality:tokens',
    io,
  );

  assert.equal(code, 1);
  assert.deepEqual(log, ['FAIL quality:tokens: 1 violation(s)']);
  assert.deepEqual(error, ['a.ts:3: [no-palette-utility] bg-slate-800']);
  assert.deepEqual(exits, [1]);
});
