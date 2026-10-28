import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { join } from 'node:path';
import { ApiKeysModule } from './api-keys/api-keys.module.js';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { HttpModule } from './common/http/http.module.js';
import { OpenApiModule } from './common/openapi/openapi.module.js';
import { DatabaseModule } from './db/database.module.js';
import { HealthModule } from './health/health.module.js';
import { VapiWebhooksModule } from './vapi-webhooks/vapi-webhooks.module.js';
import { APP_ENV } from './config/app-env.js';

/**
 * Per-env file selection is driven by APP_ENV (set by the deploy / local
 * run helper). NestJS `ConfigModule` resolves files in the order of the
 * `envFilePath` array; later entries do NOT override earlier ones, so the
 * canonical values come first and the optional developer override (which is
 * gitignored) comes last.
 *
 * Prod ignores the env file entirely -- the Docker image excludes any
 * `.env` file via the dockerignore at `infra/app/.dockerignore`, so the
 * only authoritative source for prod env is the `environment:` block of
 * the `api` service in `infra/docker-compose.yml`. Setting `ignoreEnvFile`
 * here is the explicit "we mean it" version of that, removing any reliance
 * on the absence of the file on disk.
 */
const envFilePaths: string[] =
  APP_ENV === 'prod'
    ? []
    : [
        join(process.cwd(), `.env.${APP_ENV}`),
        join(process.cwd(), '.env.local'),
      ];

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: envFilePaths,
      // Prod env values come exclusively from `infra/.env.prod` via the
      // compose `environment:` block. We disable file-based loading so
      // a future copy/paste mistake (e.g. someone mounts a stale
      // `.env.dev` into the prod container) cannot silently leak dev
      // secrets into prod.
      ignoreEnvFile: APP_ENV === 'prod',
    }),
    // Global HTTP edge: the error filter (envelope for every throwable) and the
    // request-id interceptor. Imported first so every feature below gets them.
    HttpModule,
    // Generated OpenAPI document (`/api/openapi.json`), the dev-only Swagger UI
    // and the dev-only response validator (AIS-98). After `HttpModule` because
    // the validator is an interceptor for the same routes.
    OpenApiModule,
    DatabaseModule,
    HealthModule,
    ApiKeysModule,
    VapiWebhooksModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
