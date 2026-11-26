/**
 * Behaviour tests of the field-error gate: the negative fixture proves the rule
 * fires on a component that branches on the error shape, the positive fixture
 * proves the allowlisted decision file and the excluded test code do not.
 *
 * Run with `pnpm test:quality`.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  FIELD_ERROR_ALLOWLIST,
  FIELD_ERROR_EXCLUDE,
} from './field-error-gate.const.mjs';
import { checkFieldErrors, isInScope } from './field-error-gate.logic.mjs';
import { runFieldErrorGate } from './field-error-gate.mjs';
import { matchesAnyGlob } from './glob.mjs';

const NEGATIVE_TREE = fileURLToPath(
  new URL('./fixtures/field-errors/negative/', import.meta.url),
);
const POSITIVE_TREE = fileURLToPath(
  new URL('./fixtures/field-errors/positive/', import.meta.url),
);

test('reports every error-shape rule in the negative fixture tree', () => {
  const violations = runFieldErrorGate({ base: NEGATIVE_TREE });

  const reportedRules = [
    ...new Set(violations.map((violation) => violation.rule)),
  ].sort();

  assert.deepEqual(reportedRules, [
    'no-api-error-instanceof',
    'no-code-comparison',
    'no-error-code-comparison',
    'no-error-status-comparison',
  ]);
});

test('names the offending component file', () => {
  const violations = runFieldErrorGate({ base: NEGATIVE_TREE });

  const files = new Set(violations.map((violation) => violation.file));

  assert.equal(files.has('apps/admin/src/components/Leaky.tsx'), true);
});

test('finds no violation in the positive fixture tree', () => {
  const violations = runFieldErrorGate({ base: POSITIVE_TREE });

  assert.deepEqual(violations, []);
});

test('flags a component that compares error.status', () => {
  const violations = checkFieldErrors([
    {
      file: 'apps/admin/src/pages/x/XPage.tsx',
      text: 'if (error.status === 503) { return null; }',
    },
  ]);

  assert.equal(violations.length, 1);
  assert.equal(violations[0].rule, 'no-error-status-comparison');
  assert.equal(violations[0].line, 1);
});

test('allows the decision logic file and excludes test files', () => {
  const text = 'if (error instanceof ApiError && error.status !== 401) {';

  const violations = checkFieldErrors([
    { file: 'apps/admin/src/features/x/x.logic.ts', text },
    { file: 'apps/admin/src/lib/error-message.ts', text },
    { file: 'apps/admin/src/features/x/x.logic.test.ts', text },
    { file: 'apps/admin/src/test/mocks/api-error.mock.ts', text },
  ]);

  assert.deepEqual(violations, []);
});

test('exclusion wins over the allowlist when both patterns match', () => {
  const file = 'apps/admin/src/test/x.logic.ts';

  assert.equal(matchesAnyGlob(file, FIELD_ERROR_ALLOWLIST), true);
  assert.equal(matchesAnyGlob(file, FIELD_ERROR_EXCLUDE), true);
  assert.equal(
    isInScope(file, FIELD_ERROR_ALLOWLIST, FIELD_ERROR_EXCLUDE),
    false,
  );
});

test('a *.logic.test.ts file is out of scope', () => {
  const file = 'apps/admin/src/lib/error-surface.logic.test.ts';

  assert.equal(
    isInScope(file, FIELD_ERROR_ALLOWLIST, FIELD_ERROR_EXCLUDE),
    false,
  );
});

test('puts a page component in scope and the decision file out of scope', () => {
  assert.equal(
    isInScope(
      'apps/web/src/pages/HomePage.tsx',
      FIELD_ERROR_ALLOWLIST,
      FIELD_ERROR_EXCLUDE,
    ),
    true,
  );
  assert.equal(
    isInScope(
      'apps/admin/src/lib/error-surface.logic.ts',
      FIELD_ERROR_ALLOWLIST,
      FIELD_ERROR_EXCLUDE,
    ),
    false,
  );
});

test('reports at most one finding per line, the first matching rule winning', () => {
  const violations = checkFieldErrors([
    {
      file: 'apps/admin/src/components/Both.tsx',
      text: 'const x = error.code === "CONFLICT" && error.status === 409;',
    },
  ]);

  assert.equal(violations.length, 1);
  assert.equal(violations[0].rule, 'no-error-status-comparison');
});

test('accepts an empty file list', () => {
  assert.deepEqual(checkFieldErrors([]), []);
});
