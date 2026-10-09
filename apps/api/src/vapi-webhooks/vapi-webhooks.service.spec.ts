import { VapiWebhooksService } from './vapi-webhooks.service.js';
import type { VapiEvent } from './dto/vapi-event.dto.js';

/**
 * Unit tests for the in-memory VAPI event store.
 *
 * No Nest DI container and no jest globals are used, so the suite runs in the
 * project's ESM Jest setup without any interop shims.
 */

function event(id: string, type = 'end-of-call-report'): VapiEvent {
  return { id, type };
}

describe('VapiWebhooksService', () => {
  it('records an event and returns a handle with a UUID and a receive timestamp', () => {
    const service = new VapiWebhooksService();

    const stored = service.record('end-of-call-report', event('evt-1'));

    expect(stored.id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(stored.endpoint).toBe('end-of-call-report');
    expect(stored.event).toEqual(event('evt-1'));
    expect(Number.isNaN(Date.parse(stored.receivedAt))).toBe(false);
  });

  it('stores each recorded event under its own storage id', () => {
    const service = new VapiWebhooksService();

    const first = service.record('tool-calls', event('evt-1', 'tool-calls'));
    const second = service.record('tool-calls', event('evt-2', 'tool-calls'));

    expect(service.findOne(first.id)).toEqual(first);
    expect(service.findOne(second.id)).toEqual(second);
    expect(service.findAll()).toHaveLength(2);
  });

  it('keeps events that share a VAPI message id (the store is not an idempotency cache)', () => {
    // Documents the current, deliberate behaviour: deduplication by
    // `message.id` is NOT implemented — a future milestone that adds
    // persistence is expected to change this test on purpose.
    const service = new VapiWebhooksService();

    service.record('end-of-call-report', event('evt-duplicate'));
    service.record('end-of-call-report', event('evt-duplicate'));

    expect(service.findAll()).toHaveLength(2);
  });

  it('returns undefined for an unknown storage id', () => {
    const service = new VapiWebhooksService();

    expect(service.findOne('does-not-exist')).toBeUndefined();
  });

  it('returns a snapshot whose array is not the internal store', () => {
    const service = new VapiWebhooksService();
    service.record('tool-calls', event('evt-1', 'tool-calls'));

    const snapshot = service.findAll();
    snapshot.length = 0;

    expect(service.findAll()).toHaveLength(1);
  });
});
