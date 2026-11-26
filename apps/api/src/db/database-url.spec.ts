import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadEnvFileIfPresent } from './database-url.js';

/**
 * Unit tests for the dotenv loader used by the migration runner and by the
 * e2e specs that do not boot `AppModule`.
 *
 * The regression these pin (2026-11-25): the loader used
 * `process.loadEnvFile()`, which writes into the **real** process env. Jest's
 * node environment hands the spec a *copy* of `process`, so the copy the test
 * reads stayed empty and `audit-immutability.e2e-spec.ts` skipped on a machine
 * with a valid `apps/api/.env.local`. The loader now parses with
 * `node:util`'s `parseEnv()` and assigns into the `process.env` the test sees.
 */

/** Environment names the tests own; restored after each case. */
const OWNED_KEYS = ['AISZTENS_TEST_DB_URL', 'AISZTENS_TEST_KEEP'] as const;

describe('loadEnvFileIfPresent', () => {
  let directory: string;
  const originalValues = new Map<string, string | undefined>();

  beforeAll(() => {
    for (const key of OWNED_KEYS) {
      originalValues.set(key, process.env[key]);
    }
  });

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'db-url-'));
  });

  afterEach(() => {
    for (const key of OWNED_KEYS) {
      const original = originalValues.get(key);

      if (original === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = original;
      }
    }
    rmSync(directory, { recursive: true, force: true });
  });

  it('loads the values into the env the test can see', () => {
    const filePath = join(directory, '.env.local');
    writeFileSync(filePath, 'AISZTENS_TEST_DB_URL=postgres://loaded\n');

    expect(loadEnvFileIfPresent(filePath)).toBe(true);
    expect(process.env['AISZTENS_TEST_DB_URL']).toBe('postgres://loaded');
  });

  it('does not override a value that is already exported', () => {
    const filePath = join(directory, '.env.local');
    writeFileSync(filePath, 'AISZTENS_TEST_KEEP=from-file\n');
    process.env['AISZTENS_TEST_KEEP'] = 'from-environment';

    expect(loadEnvFileIfPresent(filePath)).toBe(true);
    expect(process.env['AISZTENS_TEST_KEEP']).toBe('from-environment');
  });

  it('returns false for a missing file and touches nothing', () => {
    expect(loadEnvFileIfPresent(join(directory, 'absent.env'))).toBe(false);
    expect(process.env['AISZTENS_TEST_DB_URL']).toBeUndefined();
  });

  it('throws a readable error when the file cannot be read', () => {
    // A directory exists but cannot be read as a file: the misconfiguration must
    // surface, never be swallowed into a half-loaded environment.
    expect(() => loadEnvFileIfPresent(directory)).toThrow(
      /^Could not read .*: /,
    );
  });

  it('treats a file without assignments as a successful, empty load', () => {
    const filePath = join(directory, '.env.local');
    writeFileSync(filePath, '# only a comment\n\n');

    expect(loadEnvFileIfPresent(filePath)).toBe(true);
    expect(process.env['AISZTENS_TEST_DB_URL']).toBeUndefined();
  });
});
