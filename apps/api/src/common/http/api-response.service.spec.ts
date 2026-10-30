import { API_ERROR_CODE } from '@callback/shared';
import { ApiResponseService } from './api-response.service.js';
import { NotFoundAppError } from './app-error.js';
import type { RequestContext } from './request-context.interface.js';

/** Fixed context so the assertions need no clock mocking. */
const CTX: RequestContext = {
  requestId: 'req-42',
  timestamp: '2026-10-27T10:00:00.000Z',
  path: '/api/api-keys',
  method: 'GET',
};

describe('ApiResponseService', () => {
  const responses = new ApiResponseService();

  describe('ok', () => {
    it('wraps the payload and copies the context into meta', () => {
      expect(responses.ok([1, 2], CTX)).toEqual({
        data: [1, 2],
        meta: { requestId: 'req-42', timestamp: '2026-10-27T10:00:00.000Z' },
      });
    });

    it('keeps `data: null` for a success with nothing to return', () => {
      expect(responses.ok(null, CTX).data).toBeNull();
    });

    it('adds pagination only when it is supplied', () => {
      const paginated = responses.ok([], CTX, {
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0,
      });

      expect(paginated.meta.pagination).toEqual({
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0,
      });
    });
  });

  describe('fail', () => {
    it('derives the status from the code and keeps the request facts', () => {
      const body = responses.fail(new NotFoundAppError('gone'), CTX);

      expect(body.error.status).toBe(404);
      expect(body.error.code).toBe(API_ERROR_CODE.NOT_FOUND);
      expect(body.error.requestId).toBe('req-42');
      expect(body.error.path).toBe('/api/api-keys');
      expect(body.error.details).toEqual([]);
    });
  });
});
