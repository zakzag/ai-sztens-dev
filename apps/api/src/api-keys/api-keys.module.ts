/**
 * Feature module of the API-key store.
 *
 * Imports `DatabaseModule` explicitly instead of relying on a global: the
 * dependency on Postgres stays visible in the module graph (see the docblock of
 * `DatabaseModule`). The repository is bound to the {@link API_KEYS_REPOSITORY}
 * token, so the service never imports the Drizzle class.
 */

import { Module } from '@nestjs/common';
import { DatabaseModule } from '../db/database.module.js';
import { API_KEYS_REPOSITORY } from './api-keys.const.js';
import { ApiKeysController } from './api-keys.controller.js';
import { DrizzleApiKeysRepository } from './api-keys.repository.js';
import { ApiKeysService } from './api-keys.service.js';

@Module({
  imports: [DatabaseModule],
  controllers: [ApiKeysController],
  providers: [
    ApiKeysService,
    { provide: API_KEYS_REPOSITORY, useClass: DrizzleApiKeysRepository },
  ],
  exports: [ApiKeysService],
})
export class ApiKeysModule {}
