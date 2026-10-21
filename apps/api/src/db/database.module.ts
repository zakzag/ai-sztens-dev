import { Module } from '@nestjs/common';
import { DATABASE, DATABASE_CLIENT } from './database.const.js';
import { databaseProviders } from './database.providers.js';
import { DatabaseLifecycleService } from './database-lifecycle.service.js';

/**
 * Single place that knows how to reach Postgres.
 *
 * Deliberately **not** `@Global()`: every consumer imports this module, so the
 * dependency stays visible in the module graph and a feature cannot quietly
 * query the database without declaring it. `ConfigModule` is already global
 * (`app.module.ts`), which is how the factories receive `DATABASE_URL`.
 *
 * Exports the two tokens, not the classes:
 * - `DATABASE` — the Drizzle handle for repositories/services;
 * - `DATABASE_CLIENT` — exported only so a future integration test can override
 *   the raw client; application code must depend on `DATABASE`.
 *
 * Boot behaviour: constructing this module validates `DATABASE_URL` (see
 * `createDatabaseClient`). A missing value aborts the boot with
 * `DatabaseConfigurationError` instead of running without persistence.
 */
@Module({
  providers: [...databaseProviders, DatabaseLifecycleService],
  exports: [DATABASE, DATABASE_CLIENT],
})
export class DatabaseModule {}
