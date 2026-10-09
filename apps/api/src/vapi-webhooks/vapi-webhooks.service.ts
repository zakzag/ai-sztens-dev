import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { VapiEvent } from './dto/vapi-event.dto.js';

/** A received VAPI event, as recorded by the in-memory placeholder store. */
export interface StoredVapiEvent {
  id: string;
  receivedAt: string;
  endpoint: string;
  event: VapiEvent;
}

/**
 * In-memory store for inbound VAPI events.
 *
 * This is the vertical-slice placeholder: every authenticated webhook
 * is persisted here so the smoke tests can verify the controller's
 * end-to-end behaviour without a database. The actual business logic
 * (assistant dispatch, status updates, follow-up actions) will be
 * added on top of this store in the next milestone, once the webhook
 * contract is finalised.
 *
 * The store is process-local and NOT persistent across restarts. It
 * mirrors `CallbackRequestsService` — both will be replaced by a
 * Postgres-backed store at the same time.
 */
@Injectable()
export class VapiWebhooksService {
  private readonly logger = new Logger(VapiWebhooksService.name);
  private readonly events = new Map<string, StoredVapiEvent>();

  /**
   * Record an event and return the storage handle. The `endpoint`
   * argument is the relative URL the controller received the event on
   * (e.g. `tool-calls`, `end-of-call-report`) so the downstream
   * consumers can branch on it without re-parsing the path.
   */
  record(endpoint: string, event: VapiEvent): StoredVapiEvent {
    const stored: StoredVapiEvent = {
      id: randomUUID(),
      receivedAt: new Date().toISOString(),
      endpoint,
      event,
    };
    this.events.set(stored.id, stored);
    this.logger.log(
      `Recorded VAPI event ${event.type} (msg=${event.id ?? 'n/a'}) on /${endpoint} as ${stored.id}.`,
    );
    return stored;
  }

  /** Snapshot of all events recorded since process start. */
  findAll(): StoredVapiEvent[] {
    return [...this.events.values()];
  }

  /** Look up a single stored event by its storage id. */
  findOne(id: string): StoredVapiEvent | undefined {
    return this.events.get(id);
  }
}
