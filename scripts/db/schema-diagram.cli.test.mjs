/**
 * Tests of the CLI's pure helpers: argument parsing, the date default and the
 * missing-source error.
 *
 * The CLI is imported, never spawned: importing it does not run the generator
 * because `run()` only executes when the module is the entry point.
 *
 * @module scripts/db/schema-diagram.cli.test
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import { SchemaSourceMissingError } from './schema-diagram.errors.mjs';
import {
  parseArguments,
  readSchemaSource,
  todayIsoDate,
} from './schema-diagram.mjs';

test('the default options mean "write the document with today\'s date"', () => {
  assert.deepEqual(parseArguments([]), {
    help: false,
    check: false,
    stdout: false,
    date: null,
  });
});

test('--check, --stdout and -h are recognised', () => {
  assert.equal(parseArguments(['--check']).check, true);
  assert.equal(parseArguments(['--stdout']).stdout, true);
  assert.equal(parseArguments(['-h']).help, true);
  assert.equal(parseArguments(['--help']).help, true);
});

test('--date accepts both separator forms', () => {
  assert.equal(parseArguments(['--date=2026-11-22']).date, '2026-11-22');
  assert.equal(parseArguments(['--date', '2026-11-22']).date, '2026-11-22');
});

test('a malformed or missing --date value is rejected', () => {
  assert.throws(() => parseArguments(['--date']), /expects YYYY-MM-DD/);
  assert.throws(() => parseArguments(['--date=2026-1-2']), /expects YYYY-MM-DD/);
});

test('an unknown argument is rejected instead of ignored', () => {
  assert.throws(() => parseArguments(['--verbose']), /unknown argument/);
});

test('--check and --stdout cannot be combined', () => {
  assert.throws(
    () => parseArguments(['--check', '--stdout']),
    /cannot be combined/,
  );
});

test('todayIsoDate formats a local date with padding', () => {
  assert.equal(todayIsoDate(new Date(2026, 0, 5, 23, 30)), '2026-01-05');
  assert.equal(todayIsoDate(new Date(2026, 10, 22, 1, 0)), '2026-11-22');
});

test('a missing schema source raises the dedicated error', () => {
  assert.throws(
    () => readSchemaSource('/definitely/not/a/schema.ts'),
    SchemaSourceMissingError,
  );
});
