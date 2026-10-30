import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { ApiResponseService } from './common/http/api-response.service.js';
import type { RequestContext } from './common/http/request-context.interface.js';

/** Fixed context so the `meta` assertion needs no clock mocking. */
const CTX: RequestContext = {
  requestId: '0192f3c4-0000-4000-8000-000000000002',
  timestamp: '2026-10-27T10:00:00.000Z',
  path: '/',
  method: 'GET',
};

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService, ApiResponseService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('wraps the greeting in the success envelope', () => {
      expect(appController.getHello(CTX)).toEqual({
        data: 'Hello World!',
        meta: { requestId: CTX.requestId, timestamp: CTX.timestamp },
      });
    });
  });
});
