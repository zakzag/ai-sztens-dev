/**
 * Wiring of the OpenAPI surface (AIS-98).
 *
 * Three responsibilities, all conditional and all in one place so the
 * environment rule is impossible to miss:
 *
 * - `/api/openapi.json` — always: the document is a build artefact, available in
 *   every environment (plan §8.6);
 * - `/api/docs` — only where `isOpenApiDocsEnabled()` says so, registered
 *   straight onto the Fastify instance (the UI is third-party HTML served by a
 *   plugin, it never passes through Nest, `packages/ui` or the envelope filter);
 * - the response validator — an `APP_INTERCEPTOR` only where
 *   `isResponseAssertEnabled()` says so.
 *
 * `onApplicationBootstrap` awaits `ready()` because the UI plugins are registered
 * during `onModuleInit`: without it, an e2e `app.inject()` right after
 * `app.init()` could hit a Fastify instance whose plugin graph is not loaded yet.
 */

import { Inject, Module } from '@nestjs/common';
import type { OnApplicationBootstrap, OnModuleInit } from '@nestjs/common';
import { APP_INTERCEPTOR, HttpAdapterHost } from '@nestjs/core';
import { OPENAPI_DOCUMENT } from './openapi.const.js';
import {
  OPENAPI_DOCS_ENABLED,
  RESPONSE_ASSERT_ENABLED,
} from './openapi.config.js';
import { OpenApiController } from './openapi.controller.js';
import type { FastifyHost, OpenApiDocument } from './openapi.interface.js';
import { openApiDocument } from './openapi.registry.js';
import { ResponseAssertInterceptor } from './response-assert.interceptor.js';
import { registerSwaggerDocs } from './swagger.plugin.js';

@Module({
  controllers: [OpenApiController],
  providers: [
    { provide: OPENAPI_DOCUMENT, useFactory: openApiDocument },
    // Conditional provider list: in prod the interceptor does not exist at all,
    // so it cannot be triggered by configuration drift.
    ...(RESPONSE_ASSERT_ENABLED
      ? [{ provide: APP_INTERCEPTOR, useClass: ResponseAssertInterceptor }]
      : []),
  ],
})
export class OpenApiModule implements OnModuleInit, OnApplicationBootstrap {
  constructor(
    private readonly adapterHost: HttpAdapterHost,
    @Inject(OPENAPI_DOCUMENT) private readonly document: OpenApiDocument,
  ) {}

  /** Mounts the Swagger UI when this environment exposes it. */
  public onModuleInit(): void {
    if (!OPENAPI_DOCS_ENABLED) {
      return;
    }

    registerSwaggerDocs(this.fastify(), this.document);
  }

  /** Makes the registered Fastify plugins ready before the first request. */
  public async onApplicationBootstrap(): Promise<void> {
    if (!OPENAPI_DOCS_ENABLED) {
      return;
    }

    await this.fastify().ready();
  }

  /**
   * @returns the Fastify instance behind Nest's HTTP adapter.
   */
  private fastify(): FastifyHost {
    return this.adapterHost.httpAdapter.getInstance<FastifyHost>();
  }
}
