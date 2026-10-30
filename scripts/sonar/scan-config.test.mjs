import assert from 'node:assert/strict';
import { test } from 'node:test';

import { DEFAULT_SERVER_URL } from './sonar.const.mjs';
import { SonarConfigError } from './sonar.errors.mjs';
import {
  isTruthy,
  mergeEnv,
  normalizeServerUrl,
  parseEnvFile,
  readEnvFile,
  resolveConfig,
} from './scan-config.mjs';

test('parseEnvFile reads pairs, skips comments and blank lines', () => {
  const parsed = parseEnvFile(
    '# comment\n\nSONAR_HOST_URL=http://localhost:9000\nSONAR_TOKEN=abc\n',
  );

  assert.deepEqual(parsed, {
    SONAR_HOST_URL: 'http://localhost:9000',
    SONAR_TOKEN: 'abc',
  });
});

test('parseEnvFile strips surrounding quotes and keeps inner spaces', () => {
  const parsed = parseEnvFile('A="a b"\nB=\'c d\'\n');

  assert.deepEqual(parsed, { A: 'a b', B: 'c d' });
});

test('parseEnvFile ignores lines without a key or an equals sign', () => {
  const parsed = parseEnvFile('NOEQUALS\n=value\nKEY=value\n');

  assert.deepEqual(parsed, { KEY: 'value' });
});

test('parseEnvFile returns an empty object for empty content', () => {
  assert.deepEqual(parseEnvFile(''), {});
});

test('readEnvFile returns an empty object when the file is missing', () => {
  const env = readEnvFile('/missing/sonar.env', {
    fileExists: () => false,
    readFile: () => 'ignored',
  });

  assert.deepEqual(env, {});
});

test('readEnvFile parses the file when it exists', () => {
  const env = readEnvFile('/repo/sonar.env', {
    fileExists: () => true,
    readFile: () => 'SONAR_TOKEN=file-token\n',
  });

  assert.deepEqual(env, { SONAR_TOKEN: 'file-token' });
});

test('mergeEnv lets the real environment win over the env file', () => {
  const merged = mergeEnv(
    { SONAR_TOKEN: 'from-process' },
    { SONAR_TOKEN: 'from-file', SONAR_HOST_URL: 'http://sq:9000' },
  );

  assert.equal(merged.SONAR_TOKEN, 'from-process');
  assert.equal(merged.SONAR_HOST_URL, 'http://sq:9000');
});

test('resolveConfig throws a SonarConfigError without a token', () => {
  assert.throws(
    () => resolveConfig({}),
    (error) =>
      error instanceof SonarConfigError && /SONAR_TOKEN/.test(error.message),
  );
  assert.throws(() => resolveConfig({ SONAR_TOKEN: '   ' }), SonarConfigError);
});

test('resolveConfig defaults the server URL to localhost', () => {
  const config = resolveConfig({ SONAR_TOKEN: ' token ' });

  assert.deepEqual(config, {
    serverUrl: DEFAULT_SERVER_URL,
    token: 'token',
    waitForQualityGate: false,
  });
});

test('resolveConfig trims a trailing slash from the server URL', () => {
  const config = resolveConfig({
    SONAR_TOKEN: 't',
    SONAR_HOST_URL: 'http://sonar.local:9001/',
  });

  assert.equal(config.serverUrl, 'http://sonar.local:9001');
});

test('resolveConfig rejects a URL without an http(s) scheme', () => {
  assert.throws(
    () =>
      resolveConfig({ SONAR_TOKEN: 't', SONAR_HOST_URL: 'sonar.local:9000' }),
    SonarConfigError,
  );
});

test('resolveConfig enables the quality gate wait for truthy values', () => {
  assert.equal(
    resolveConfig({ SONAR_TOKEN: 't', SONAR_QUALITYGATE_WAIT: 'true' })
      .waitForQualityGate,
    true,
  );
  assert.equal(
    resolveConfig({ SONAR_TOKEN: 't', SONAR_QUALITYGATE_WAIT: '0' })
      .waitForQualityGate,
    false,
  );
});

test('normalizeServerUrl accepts https and rejects garbage', () => {
  assert.equal(
    normalizeServerUrl('https://sq.example.com/'),
    'https://sq.example.com',
  );
  assert.throws(() => normalizeServerUrl('ftp://sq'), SonarConfigError);
});

test('isTruthy understands the common boolean spellings', () => {
  assert.equal(isTruthy('1'), true);
  assert.equal(isTruthy('YES'), true);
  assert.equal(isTruthy('on'), true);
  assert.equal(isTruthy('false'), false);
  assert.equal(isTruthy(undefined), false);
});
