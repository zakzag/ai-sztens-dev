import { Module } from '@nestjs/common';
import { CallbackRequestsController } from './callback-requests.controller.js';
import { CallbackRequestsService } from './callback-requests.service.js';

@Module({
  controllers: [CallbackRequestsController],
  providers: [CallbackRequestsService],
  exports: [CallbackRequestsService],
})
export class CallbackRequestsModule {}
