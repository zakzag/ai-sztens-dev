/**
 * NestJS provider definitions for the database layer.
 *
 * The behaviour lives in `database.factory.ts` (pure, unit-tested without
 * `@nestjs/config`); this file only binds it to the DI container, which is the
 * single place that has to know `ConfigService` exists.
 */
import type { FactoryProvider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Sql } from 'postgres';
import { DATABASE, DATABASE_CLIENT } from './database.const.js';
import { createDatabase, createDatabaseClient } from './database.factory.js';
import type { Database } from './database.interface.js';

/** `DATABASE_CLIENT` provider — the raw client, closed on shutdown. */
export const databaseClientProvider: FactoryProvider<Sql> = {
  provide: DATABASE_CLIENT,
  inject: [ConfigService],
  useFactory: (config: ConfigService): Sql => createDatabaseClient(config),
};

/** `DATABASE` provider — the handle every repository injects. */
export const databaseProvider: FactoryProvider<Database> = {
  provide: DATABASE,
  inject: [DATABASE_CLIENT],
  useFactory: (client: Sql): Database => createDatabase(client),
};

/** Everything `DatabaseModule` registers. */
export const databaseProviders = [databaseClientProvider, databaseProvider];
