import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller.js';

describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('check', () => {
    it('returns status "ok"', () => {
      const result = controller.check();
      expect(result.status).toBe('ok');
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
  });
});
