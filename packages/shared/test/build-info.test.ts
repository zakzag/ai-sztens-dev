import {
  UNKNOWN_BUILD_VALUE,
  formatCommitHash,
  formatDeployDate,
  normalizeBuildValue,
} from '../src/lib/build-info.js';

/**
 * Unit tests for {@link ../src/lib/build-info.ts}.
 *
 * Runs through the same Jest + ts-jest ESM preset as `@callback/api`, so the
 * source is type-checked and imported directly (no build step, no `.mjs`).
 */
describe('normalizeBuildValue', () => {
  it('returns the trimmed value for a real build arg', () => {
    expect(normalizeBuildValue('  abc123  ')).toBe('abc123');
  });

  it('collapses an empty string to null (Vite substitutes unset args with "")', () => {
    expect(normalizeBuildValue('')).toBeNull();
  });

  it('collapses a whitespace-only string to null', () => {
    expect(normalizeBuildValue('   ')).toBeNull();
  });

  it('passes through null and undefined', () => {
    expect(normalizeBuildValue(null)).toBeNull();
    expect(normalizeBuildValue(undefined)).toBeNull();
  });
});

describe('formatDeployDate', () => {
  it('renders the placeholder when nothing was injected', () => {
    expect(formatDeployDate(null)).toBe(UNKNOWN_BUILD_VALUE);
  });

  it('humanises a valid ISO 8601 build timestamp', () => {
    const result = formatDeployDate('2026-10-12T12:34:56Z');

    expect(result).not.toBe(UNKNOWN_BUILD_VALUE);
    expect(result).not.toBe('2026-10-12T12:34:56Z');
    expect(result).toEqual(expect.stringContaining('2026'));
  });

  it('honours an explicit locale', () => {
    expect(formatDeployDate('2026-10-12T12:34:56Z', 'en-US')).toEqual(
      expect.stringContaining('2026'),
    );
  });

  it('falls back to the raw value when the date is unparseable', () => {
    expect(formatDeployDate('not-a-date')).toBe('not-a-date');
  });
});

describe('formatCommitHash', () => {
  const sha = '0123456789abcdef0123456789abcdef01234567';

  it('renders the full SHA verbatim', () => {
    expect(formatCommitHash(sha)).toBe(sha);
  });

  it('renders the placeholder when nothing was injected', () => {
    expect(formatCommitHash(null)).toBe(UNKNOWN_BUILD_VALUE);
  });
});