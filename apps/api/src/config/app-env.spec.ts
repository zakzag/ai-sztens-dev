import {
  APP_ENV,
  APP_ENV_RAW,
  isDev,
  isLocal,
  isProd,
  normaliseAppEnv,
} from './app-env.js';

/**
 * Unit tests for the APP_ENV normaliser.
 *
 * The original version of this file asserted the module-level constants by
 * mutating `process.env` and calling `jest.resetModules()` + `require()`. That
 * cannot work in this project: the API package is ESM and Jest runs it with
 * `ts-jest/presets/default-esm`, where the CommonJS `jest` global (and
 * `require`) do not exist — every test in the suite failed with
 * `ReferenceError: jest is not defined`.
 *
 * The normaliser is therefore a pure, exported function and the tests call it
 * directly; a couple of extra assertions cover the constants that production
 * actually consumes.
 */
describe('AppEnv', () => {
  it('defaults to dev when APP_ENV is unset or empty', () => {
    expect(normaliseAppEnv(undefined)).toBe('dev');
    expect(normaliseAppEnv('')).toBe('dev');
  });

  it.each([
    ['local', 'local'],
    ['dev', 'dev'],
    ['prod', 'prod'],
    ['production', 'prod'],
    ['development', 'local'],
    ['staging', 'dev'],
    ['dev.local', 'local'],
    ['development.droplet', 'dev'],
  ])('normalises APP_ENV=%s to canonical %s', (raw, expected) => {
    expect(normaliseAppEnv(raw)).toBe(expected);
  });

  it('ignores surrounding whitespace and letter case', () => {
    expect(normaliseAppEnv('  Production  ')).toBe('prod');
    expect(normaliseAppEnv('DEV')).toBe('dev');
    expect(normaliseAppEnv('\tLocal\n')).toBe('local');
  });

  it('falls back to dev for an unknown value', () => {
    expect(normaliseAppEnv('qa')).toBe('dev');
    expect(normaliseAppEnv('prod-droplet')).toBe('dev');
  });

  it('exposes the resolved environment through the module constants', () => {
    expect(APP_ENV).toBe(normaliseAppEnv(process.env.APP_ENV));
  });

  it('exposes mutually exclusive is* booleans matching APP_ENV', () => {
    expect(isProd).toBe(APP_ENV === 'prod');
    expect(isDev).toBe(APP_ENV === 'dev');
    expect(isLocal).toBe(APP_ENV === 'local');
    expect([isProd, isDev, isLocal].filter(Boolean)).toHaveLength(1);
  });

  it('reports the raw value via APP_ENV_RAW for diagnostics', () => {
    expect(APP_ENV_RAW).toBe(
      process.env.APP_ENV || '(unset, defaulted to dev)',
    );
  });
});
