import { NotFoundException } from '@nestjs/common';
import { CallbackRequestsService } from './callback-requests.service.js';
import { CreateCallbackRequestDto } from './dto/create-callback-request.dto.js';

const validDto: CreateCallbackRequestDto = {
  name: 'Teszt Elek',
  email: 'teszt@example.com',
  phone: '+36301234567',
  reason: 'Szeretnék visszahívást kérni a weboldalon.',
};

describe('CallbackRequestsService', () => {
  let service: CallbackRequestsService;

  beforeEach(() => {
    service = new CallbackRequestsService();
  });

  it('should create a request with queued status and an id', () => {
    const request = service.create(validDto);

    expect(request.id).toBeDefined();
    expect(request.status).toBe('queued');
    expect(request.createdAt).toBeDefined();
    expect(request.name).toBe('Teszt Elek');
  });

  it('should return created requests from findAll', () => {
    service.create(validDto);
    service.create({ ...validDto, email: 'masik@example.com' });

    const all = service.findAll();
    expect(all).toHaveLength(2);
  });

  it('should return a single request by id', () => {
    const created = service.create(validDto);

    const found = service.findOne(created.id);
    expect(found).toEqual(created);
  });

  it('should throw NotFoundException when the request does not exist', () => {
    expect(() => service.findOne('missing-id')).toThrow(NotFoundException);
  });
});
