import { VapiWebhooksController } from './vapi-webhooks.controller.js';
import type {
  StoredVapiEvent,
  VapiWebhooksService,
} from './vapi-webhooks.service.js';
import type { VapiEvent } from './dto/vapi-event.dto.js';

/**
 * Unit tests for the controller's delegation logic.
 *
 * The service is replaced by a hand-rolled fake (no `jest.fn`, no Nest DI), so
 * the assertions stay readable and the suite remains independent of the
 * CommonJS-only packages that Jest's ESM runner cannot load.
 */

class FakeVapiWebhooksService {
  readonly calls: Array<{ endpoint: string; event: VapiEvent }> = [];

  record(endpoint: string, event: VapiEvent): StoredVapiEvent {
    this.calls.push({ endpoint, event });
    return {
      id: 'fixed-storage-id',
      receivedAt: '2026-10-06T00:00:00.000Z',
      endpoint,
      event,
    };
  }
}

function makeController(): {
  controller: VapiWebhooksController;
  service: FakeVapiWebhooksService;
} {
  const service = new FakeVapiWebhooksService();
  const controller = new VapiWebhooksController(
    service as unknown as VapiWebhooksService,
  );
  return { controller, service };
}

describe('VapiWebhooksController', () => {
  it('records tool-call events and acknowledges them with the storage id', () => {
    const { controller, service } = makeController();
    const body: VapiEvent = { id: 'evt-tool', type: 'tool-calls' };

    const response = controller.onToolCalls(body);

    expect(service.calls).toEqual([{ endpoint: 'tool-calls', event: body }]);
    expect(response).toEqual({ received: true, id: 'fixed-storage-id' });
  });

  it('records end-of-call reports on their own endpoint name', () => {
    const { controller, service } = makeController();
    const body: VapiEvent = { id: 'evt-eoc', type: 'end-of-call-report' };

    const response = controller.onEndOfCallReport(body);

    expect(service.calls).toEqual([
      { endpoint: 'end-of-call-report', event: body },
    ]);
    expect(response).toEqual({ received: true, id: 'fixed-storage-id' });
  });
});
