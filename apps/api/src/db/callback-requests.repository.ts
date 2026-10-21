import { Inject, Injectable } from '@nestjs/common';
import { desc, eq } from 'drizzle-orm';
import {
  CallbackRequestNotFoundError,
  CallbackRequestNotPersistedError,
  InvalidCallbackRequestIdError,
} from './callback-requests.errors.js';
import type { CallbackRequestsRepository } from './callback-requests.repository.interface.js';
import { DATABASE } from './database.const.js';
import type { Database } from './database.interface.js';
import { callbackRequests } from './schema.js';
import type { CallbackRequestRow, NewCallbackRequestRow } from './schema.js';
import { isUuid } from './uuid.js';

/**
 * Drizzle implementation of {@link CallbackRequestsRepository}.
 *
 * The NestJS/HTTP boundary is crossed only through the constructor injection
 * (`@Inject(DATABASE)`); everything inside is a plain query. That is what allows
 * the unit tests in `callback-requests.repository.spec.ts` to drive every branch
 * with a mock handle — no connection string, no container, no Docker.
 *
 * Queries deliberately use `select()` (all columns) instead of an explicit
 * column list: `CallbackRequestRow` is the `$inferSelect` of the schema, so the
 * two cannot drift apart when a column is added.
 */
@Injectable()
export class DrizzleCallbackRequestsRepository implements CallbackRequestsRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  /** @inheritdoc */
  async create(input: NewCallbackRequestRow): Promise<CallbackRequestRow> {
    const rows = await this.db
      .insert(callbackRequests)
      .values(input)
      .returning();

    const row = rows.at(0);
    if (!row) {
      // Unreachable with the current schema; see the error's JSDoc for why it
      // is still checked (a future trigger / ON CONFLICT could empty the result).
      throw new CallbackRequestNotPersistedError();
    }
    return row;
  }

  /** @inheritdoc */
  async findAll(): Promise<CallbackRequestRow[]> {
    return await this.db
      .select()
      .from(callbackRequests)
      .orderBy(desc(callbackRequests.createdAt));
  }

  /** @inheritdoc */
  async findOne(id: string): Promise<CallbackRequestRow> {
    if (!isUuid(id)) {
      throw new InvalidCallbackRequestIdError(id);
    }

    const rows = await this.db
      .select()
      .from(callbackRequests)
      .where(eq(callbackRequests.id, id))
      .limit(1);

    const row = rows.at(0);
    if (!row) {
      throw new CallbackRequestNotFoundError(id);
    }
    return row;
  }
}
