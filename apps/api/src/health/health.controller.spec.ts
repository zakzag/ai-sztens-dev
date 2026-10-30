import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller.js';

describe('HealthController', () => {
  let controller: HealthController;
  let previousDeployDate: string | undefined;
  let previousCommitHash: string | undefined;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
    }).compile();

    controller = module.get<HealthController>(HealthController);

    // Snapshot the ambient environment so each test can mutate it freely and
    // the suite never leaks state into the process running the tests.
    previousDeployDate = process.env.DEPLOY_DATE;
    previousCommitHash = process.env.COMMIT_HASH;
    delete process.env.DEPLOY_DATE;
    delete process.env.COMMIT_HASH;
  });

  afterEach(() => {
    if (previousDeployDate === undefined) {
      delete process.env.DEPLOY_DATE;
    } else {
      process.env.DEPLOY_DATE = previousDeployDate;
    }

    if (previousCommitHash === undefined) {
      delete process.env.COMMIT_HASH;
    } else {
      process.env.COMMIT_HASH = previousCommitHash;
    }
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('check', () => {
    it('returns status "oks"', () => {
      const result = controller.check();
      expect(result.status).toBe('oks');
    });

    it('returns a non-negative integer uptime', () => {
      const result = controller.check();
      expect(result.uptime).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(result.uptime)).toBe(true);
    });

    it('returns an ISO 8601 timestamp', () => {
      const result = controller.check();
      // ISO 8601 with milliseconds and Z timezone marker.
      expect(result.timestamp).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
      );
      // Must be parseable as a valid Date.
      expect(Number.isNaN(Date.parse(result.timestamp))).toBe(false);
    });

    it('returns null build metadata when the env vars are unset', () => {
      const result = controller.check();
      expect(result.deployDate).toBeNull();
      expect(result.commitHash).toBeNull();
    });

    it('returns the deploy date and commit hash verbatim when set', () => {
      process.env.DEPLOY_DATE = '2026-10-12T12:34:56Z';
      process.env.COMMIT_HASH = 'a'.repeat(40);

      const result = controller.check();

      expect(result.deployDate).toBe('2026-10-12T12:34:56Z');
      expect(result.commitHash).toBe('a'.repeat(40));
    });

    it('reads the env vars at call time, not at construction time', () => {
      expect(controller.check().commitHash).toBeNull();

      process.env.COMMIT_HASH = 'b'.repeat(40);

      expect(controller.check().commitHash).toBe('b'.repeat(40));
    });

    it('keeps the liveness fields intact when metadata is present', () => {
      process.env.DEPLOY_DATE = '2026-10-12T12:34:56Z';
      process.env.COMMIT_HASH = 'c'.repeat(40);

      const result = controller.check();

      expect(result.status).toBe('oks');
      expect(result.uptime).toBeGreaterThanOrEqual(0);
      expect(Number.isNaN(Date.parse(result.timestamp))).toBe(false);
    });
  });
});
