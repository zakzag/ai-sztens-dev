import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationShutdown,
} from '@nestjs/common';
import type { Sql } from 'postgres';
import { DATABASE_CLIENT } from './database.const.js';

/**
 * Closes the `postgres.js` pool when the application shuts down.
 *
 * Why a separate provider instead of `onModuleDestroy` on the module class: the
 * client is created by a factory, and `@Inject(DATABASE_CLIENT)` gives this
 * service the one object that exposes `end()`. Repositories never see it (see
 * the note in `database.const.ts`).
 *
 * Shutdown must never throw: a failed `end()` is logged and swallowed, otherwise
 * a normal `SIGTERM` (every deploy) would exit non-zero and look like a crash.
 * The `timeout` guarantees the process cannot hang on a half-open pool.
 */
@Injectable()
export class DatabaseLifecycleService implements OnApplicationShutdown {
  private readonly logger = new Logger(DatabaseLifecycleService.name);
  private closed = false;

  constructor(@Inject(DATABASE_CLIENT) private readonly client: Sql) {}

  async onApplicationShutdown(): Promise<void> {
    if (this.closed) return;
    this.closed = true;

    try {
      await this.client.end({ timeout: 5 });
      this.logger.log('Postgres client closed.');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      // Intentionally not rethrown: the process is already going down.
      this.logger.error(`Could not close the Postgres client: ${message}`);
    }
  }
}
