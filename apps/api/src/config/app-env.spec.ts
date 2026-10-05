import {
  APP_ENV,
  APP_ENV_RAW,
  isProd,
  isDev,
  isLocal,
} from './app-env.js';

describe('AppEnv', () => {
  const ORIGINAL_ENV = process.env;

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    jest.resetModules();
  });

  function reloadWith(value: string | undefined): void {
    if (value === undefined) {
      delete process.env.APP_ENV;
    } else {
      process.env.APP_ENV = value;
    }
    jest.resetModules();
  }

  function loadFresh() {
    // Re-require to pick up the new process.env.APP_ENV value.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('./app-env.js') as typeof import('./app-env.js');
  }

  it('defaults to dev when APP_ENV is unset', () => {
    reloadWith(undefined);
    const env_ = loadFresh();
    expect(env_.APP_ENV).toBe('dev');
    expect(env_.isDev).toBe(true);
    expect(env_.isProd).toBe(false);
    expect(env_.isLocal).toBe(false);
    expect(env_.APP_ENV_RAW).toContain('unset');
  });

  it.each([
    ['local', 'local'],
    ['dev', 'dev'],
    ['prod', 'prod'],
    ['production', 'prod'],
    ['development', 'local'],
    ['staging', 'dev'],
  ])('normalises APP_ENV=%s to canonical %s', (raw, expected) => {
    reloadWith(raw);
    const env_ = loadFresh();
    expect(env_.APP_ENV).toBe(expected);
  });

  it('exposes mutually exclusive is* booleans', () => {
    reloadWith('prod');
    const env_ = loadFresh();
    expect(env_.isProd).toBe(true);
    expect(env_.isDev).toBe(false);
    expect(env_.isLocal).toBe(false);
  });

  it('reports the raw value via APP_ENV_RAW for diagnostics', () => {
    reloadWith('production');
    const env_ = loadFresh();
    expect(env_.APP_ENV_RAW).toBe('production');
  });
});