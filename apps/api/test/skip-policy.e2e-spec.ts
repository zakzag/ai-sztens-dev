import { jest } from '@jest/globals';
import {
  DATABASE_SKIP_REASON,
  reportDatabaseSkip,
} from './lib/database-gate.js';
import { isSkipFatal, reportSkip } from './lib/skip-policy.js';

/**
 * The skip policy decides whether a missing prerequisite **warns** or **fails**
 * the run, so both branches need a pin:
 *
 * - locally a skip keeps the developer workflow (no database, no modern Node)
 *   usable;
 * - in CI a skip must fail, because a run that reports `18 passed` while all
 *   140 tests skipped is not a verification — that is exactly how 96 real
 *   failures stayed invisible until the same command ran on Node 24.
 *
 * `CI` is set by the runner, so every test owns the variable for its duration
 * and restores it afterwards (jest workers share `process.env`).
 */

const CI_KEY = 'CI';

describe('skip policy', () => {
  const originalCi = process.env[CI_KEY];

  afterEach(() => {
    if (originalCi === undefined) {
      delete process.env[CI_KEY];
    } else {
      process.env[CI_KEY] = originalCi;
    }
    jest.restoreAllMocks();
  });

  describe('isSkipFatal', () => {
    it('is false outside CI', () => {
      delete process.env[CI_KEY];

      expect(isSkipFatal()).toBe(false);
    });

    it('is true when CI is the literal string "true"', () => {
      process.env[CI_KEY] = 'true';

      expect(isSkipFatal()).toBe(true);
    });

    it('is false for any other CI value', () => {
      process.env[CI_KEY] = 'false';

      expect(isSkipFatal()).toBe(false);
    });
  });

  describe('reportSkip', () => {
    it('warns with the context and the reason outside CI', () => {
      delete process.env[CI_KEY];
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => {
        // noise suppression only
      });

      expect(() => reportSkip('[gate]', 'skipped: no database')).not.toThrow();
      expect(warn).toHaveBeenCalledWith('[gate] skipped: no database');
    });

    it('throws instead of warning in CI, naming the context and the reason', () => {
      process.env[CI_KEY] = 'true';
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => {
        // must not be reached in CI
      });

      expect(() => reportSkip('[gate]', 'skipped: no database')).toThrow(
        '[gate] skipped: no database',
      );
      expect(warn).not.toHaveBeenCalled();
    });
  });

  describe('reportDatabaseSkip', () => {
    it('uses the shared [database-gate] tag and the operator-facing reason', () => {
      delete process.env[CI_KEY];
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => {
        // noise suppression only
      });

      reportDatabaseSkip();

      expect(warn).toHaveBeenCalledWith(
        `[database-gate] ${DATABASE_SKIP_REASON}`,
      );
    });

    it('fails the run in CI', () => {
      process.env[CI_KEY] = 'true';

      expect(() => reportDatabaseSkip()).toThrow(DATABASE_SKIP_REASON);
    });
  });
});
