import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import { SonarConfigError, SonarServerError } from './sonar.errors.mjs';
import { buildScanOptions, checkServerStatus, main } from './scan.mjs';

/** Builds a fake `fetch` response. */
function fetchResponse({
  ok = true,
  status = 200,
  body = { status: 'UP' },
} = {}) {
  return { ok, status, json: async () => body };
}

test('checkServerStatus returns the payload when the server is up', async () => {
  const status = await checkServerStatus('http://localhost:9000', async () =>
    fetchResponse(),
  );

  assert.equal(status.status, 'UP');
});

test('checkServerStatus requests the system status endpoint', async () => {
  const requested = [];
  await checkServerStatus('http://localhost:9000', async (url) => {
    requested.push(url);
    return fetchResponse();
  });

  assert.deepEqual(requested, ['http://localhost:9000/api/system/status']);
});

test('checkServerStatus turns a network error into a SonarServerError', async () => {
  await assert.rejects(
    () =>
      checkServerStatus('http://localhost:9000', async () => {
        throw new Error('ECONNREFUSED');
      }),
    (error) =>
      error instanceof SonarServerError && /ECONNREFUSED/.test(error.message),
  );
});

test('checkServerStatus rejects an HTTP error response', async () => {
  await assert.rejects(
    () =>
      checkServerStatus('http://localhost:9000', async () =>
        fetchResponse({ ok: false, status: 503 }),
      ),
    (error) => error instanceof SonarServerError && /503/.test(error.message),
  );
});

test('checkServerStatus rejects a server that is not UP yet', async () => {
  await assert.rejects(
    () =>
      checkServerStatus('http://localhost:9000', async () =>
        fetchResponse({ body: { status: 'STARTING' } }),
      ),
    (error) =>
      error instanceof SonarServerError && /STARTING/.test(error.message),
  );
});

test('checkServerStatus rejects an unknown status payload', async () => {
  await assert.rejects(
    () =>
      checkServerStatus('http://localhost:9000', async () =>
        fetchResponse({ body: {} }),
      ),
    SonarServerError,
  );
});

test('buildScanOptions passes the credentials and no quality gate option by default', () => {
  const options = buildScanOptions({
    serverUrl: 'http://sq',
    token: 't',
    waitForQualityGate: false,
  });

  assert.deepEqual(options, { serverUrl: 'http://sq', token: 't' });
});

test('buildScanOptions forwards the quality gate wait property', () => {
  const options = buildScanOptions({
    serverUrl: 'http://sq',
    token: 't',
    waitForQualityGate: true,
  });

  assert.deepEqual(options.options, { 'sonar.qualitygate.wait': 'true' });
});

test('main validates the config, checks the server and calls the scanner', async () => {
  const logs = [];
  const scanned = [];

  await main({
    env: {
      SONAR_TOKEN: 'secret-token',
      SONAR_HOST_URL: 'http://localhost:9000',
    },
    repoRoot: process.cwd(),
    log: { log: (message) => logs.push(message), warn: () => {} },
    fetchImpl: async () => fetchResponse(),
    scanImpl: async (options) => scanned.push(options),
  });

  assert.equal(scanned.length, 1);
  assert.deepEqual(scanned[0], {
    serverUrl: 'http://localhost:9000',
    token: 'secret-token',
  });
  assert.ok(logs.some((message) => message.includes('http://localhost:9000')));
  assert.ok(logs.every((message) => !message.includes('secret-token')));
});

test('main reads the token from sonar.env', async () => {
  const repoRoot = mkdtempSync(join(tmpdir(), 'sonar-scan-'));
  try {
    writeFileSync(
      join(repoRoot, 'sonar.env'),
      'SONAR_TOKEN=from-file\nSONAR_HOST_URL=http://sq:9000\n',
      'utf8',
    );
    let scannedOptions;

    await main({
      env: {},
      repoRoot,
      log: { log: () => {}, warn: () => {} },
      fetchImpl: async () => fetchResponse(),
      scanImpl: async (options) => {
        scannedOptions = options;
      },
    });

    assert.deepEqual(scannedOptions, {
      serverUrl: 'http://sq:9000',
      token: 'from-file',
    });
  } finally {
    rmSync(repoRoot, { recursive: true, force: true });
  }
});

test('main fails before scanning when the token is missing', async () => {
  const repoRoot = mkdtempSync(join(tmpdir(), 'sonar-scan-'));
  try {
    await assert.rejects(
      () =>
        main({
          env: {},
          repoRoot,
          log: { log: () => {}, warn: () => {} },
          fetchImpl: async () => fetchResponse(),
          scanImpl: async () => assert.fail('a scanner nem hívható meg'),
        }),
      SonarConfigError,
    );
  } finally {
    rmSync(repoRoot, { recursive: true, force: true });
  }
});

test('main does not scan when the server is not reachable', async () => {
  await assert.rejects(
    () =>
      main({
        env: { SONAR_TOKEN: 't' },
        repoRoot: process.cwd(),
        log: { log: () => {}, warn: () => {} },
        fetchImpl: async () => {
          throw new Error('offline');
        },
        scanImpl: async () => assert.fail('a scanner nem hívható meg'),
      }),
    SonarServerError,
  );
});
