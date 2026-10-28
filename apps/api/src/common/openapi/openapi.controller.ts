/**
 * The machine-readable contract endpoint (AIS-98, plan §8.6).
 *
 * `GET /api/openapi.json` is served in **every** environment while the Swagger
 * UI is not: tooling (agents, Postman, future partners) needs the document, a
 * human-facing explorer of the admin surface does not belong in prod.
 *
 * The body is *not* enveloped — it is a document, not a resource — so the route
 * carries `@SkipEnvelope()` and is listed in `ENVELOPE_EXEMPTIONS`
 * (`@callback/shared`) together with its reason.
 */

import { Controller, Get, Inject } from '@nestjs/common';
import { SkipEnvelope } from '../http/skip-envelope.decorator.js';
import { OPENAPI_DOCUMENT } from './openapi.const.js';
import { OPENAPI_JSON_ROUTE } from './openapi.config.js';
import type { OpenApiDocument } from './openapi.interface.js';

@SkipEnvelope()
@Controller()
export class OpenApiController {
  constructor(
    @Inject(OPENAPI_DOCUMENT) private readonly document: OpenApiDocument,
  ) {}

  /**
   * @returns the generated OpenAPI 3.1 document.
   */
  @Get(OPENAPI_JSON_ROUTE)
  public getDocument(): OpenApiDocument {
    return this.document;
  }
}
