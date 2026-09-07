import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import type { CallbackRequest } from '@callback/shared';
import { CallbackRequestsService } from './callback-requests.service.js';
import { CreateCallbackRequestDto } from './dto/create-callback-request.dto.js';

@Controller('callback-requests')
export class CallbackRequestsController {
  constructor(private readonly callbackRequestsService: CallbackRequestsService) {}

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  create(@Body() dto: CreateCallbackRequestDto): CallbackRequest {
    return this.callbackRequestsService.create(dto);
  }

  @Get()
  findAll(): CallbackRequest[] {
    return this.callbackRequestsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string): CallbackRequest {
    return this.callbackRequestsService.findOne(id);
  }
}
