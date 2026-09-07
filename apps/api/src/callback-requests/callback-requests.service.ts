import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { CallbackRequest } from '@callback/shared';
import { CreateCallbackRequestDto } from './dto/create-callback-request.dto.js';

/**
 * In-memory placeholder store for the vertical slice.
 * To be replaced by a persistent RequestStore (e.g. Postgres) later.
 */
@Injectable()
export class CallbackRequestsService {
  private readonly requests = new Map<string, CallbackRequest>();

  create(dto: CreateCallbackRequestDto): CallbackRequest {
    const request: CallbackRequest = {
      id: randomUUID(),
      status: 'queued',
      createdAt: new Date().toISOString(),
      ...dto,
    };
    this.requests.set(request.id, request);
    return request;
  }

  findAll(): CallbackRequest[] {
    return [...this.requests.values()];
  }

  findOne(id: string): CallbackRequest {
    const request = this.requests.get(id);
    if (!request) {
      throw new NotFoundException(`Callback request ${id} not found`);
    }
    return request;
  }
}
