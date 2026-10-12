/**
 * Unit tests for {@link ../src/lib/build-info.ts} — run with Node's built-in
 * test runner (`node --test test/`), so this package needs **no** test
 * dependencies and no extra lockfile entries.
 *
 * The tests import the **compiled** `dist/` output on purpose: it is the exact
 * artefact the SPAs and the API consume through the package `exports` map, so a
 * broken ESM emit fails here instead of inside a Vite/Docker build.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  UNKNOWN_BUILD_VALUE,
  formatCommitHash,
  formatDeployDate,
  normalizeBuildValue,
} from '../dist/lib/build-info.js';

/**
 * The contract shared by the `web` footer, the `admin` footer and any future
 * caller is "never throw, never render `undefined` or `Invalid Date`", so the
 * unset/invalid paths are covered as thoroughly as the happy path.
 */
describe('normalizeBuildValue', () => {
  it('returns the trimmed value for a real build arg', () => {
    assert.equal(normalizeBuildValue('  abc123  '), 'abc123');
  });

  it('collapses an empty string to null (Vite substitutes unset args with "")', () => {
    assert.equal(normalizeBuildValue(''), null);
  });

  it('collapses a whitespace-only string to null', () => {
    assert.equal(normalizeBuildValue('   '), null);
  });

  it('passes through null and undefined', () => {
    assert.equal(normalizeBuildValue(null), null);
    assert.equal(normalizeBuildValue(undefined), null);
  });
});

describe('formatDeployDate', () => {
  it('renders the placeholder when nothing was injected', () => {
    assert.equal(formatDeployDate(null), UNKNOWN_BUILD_VALUE);
  });

  it('humanises a valid ISO 8601 build timestamp', () => {
    const result = formatDeployDate('2026-10-12T12:34:56Z');

    assert.notEqual(result, UNKNOWN_BUILD_VALUE);
    assert.notEqual(result, '2026-10-12T12:34:56Z');
    assert.ok(result.includes('2026'), `expected a 2026 date, got "${result}"`);
  });

  it('honours an explicit locale', () => {
    assert.ok(formatDeployDate('2026-10-12T12:34:56Z', 'en-US').includes('2026'));
  });

  it('falls back to the raw value when the date is unparseable', () => {
    assert.equal(formatDeployDate('not-a-date'), 'not-a-date');
  });
});

describe('formatCommitHash', () => {
  const sha = '0123456789abcdef0123456789abcdef01234567';

  it('renders the full SHA verbatim', () => {
    assert.equal(formatCommitHash(sha), sha);
  });

  it('renders the placeholder when nothing was injected', () => {
    assert.equal(formatCommitHash(null), UNKNOWN_BUILD_VALUE);
  });
});
