# AIS-98 — generated `/api/openapi.json`, Swagger UI and the dev response validator

**Date:** 2026-10-29 00:30 (Europe/Budapest)
**Ticket:** AIS-98 (subtask of AIS-87)
**Plan:** [`docs/plans/2026-10-29--00-10-00-ais-98-openapi-swagger-response-validator-plan.md`](../plans/2026-10-29--00-10-00-ais-98-openapi-swagger-response-validator-plan.md)
**Milestone:** [`docs/milestones/2026-10-29--00-30-00-openapi-generation-swagger-ui-response-validator.milestone.md`](../milestones/2026-10-29--00-30-00-openapi-generation-swagger-ui-response-validator.milestone.md)

---

## What was asked

The endpoints existed only in our heads and in the shared Zod registry — nothing
machine-readable was served, and nothing checked the server's own **output**. The
ticket asked for the two jobs of plan §8.4 that turn the registry into something
usable and self-checking:

1. a clickable reference (`/api/docs`) plus the generated document
   (`/api/openapi.json`) — no second description of any payload;
4. a dev/staging **response validator** that fails the request when a controller
   breaks the contract it just claimed to implement.

Baseline (`docs/Specs/openapi.json` + CI drift gate) and the full documentation
pass stayed out of scope (AIS-99, AIS-100).

## What was built

### Generation (`apps/api/src/common/openapi/`)

| File | Role |
|---|---|
| [`openapi.config.ts`](../../apps/api/src/common/openapi/openapi.config.ts) | title/version/servers/tags, the bearer scheme (documented, not required), route constants and the two **pure** env predicates |
| [`zod-openapi.ts`](../../apps/api/src/common/openapi/zod-openapi.ts) | `extendZodWithOpenApi`, the `ApiEnvelope`/`ApiErrorEnvelope`/meta components registered once, `envelopeOf()`, `openApiErrorResponses()`, `toOpenApiPath()`, `pathParameters()`, and the payload **name table** |
| [`openapi.registry.ts`](../../apps/api/src/common/openapi/openapi.registry.ts) | pure, memoised `buildOpenApiDocument()` over `API_ENDPOINTS` |
| [`openapi.controller.ts`](../../apps/api/src/common/openapi/openapi.controller.ts) | `@SkipEnvelope() GET /api/openapi.json` |
| [`openapi.module.ts`](../../apps/api/src/common/openapi/openapi.module.ts) | wiring, conditional plugin registration and the conditional `APP_INTERCEPTOR` |

### UI + validator

* `@fastify/swagger` runs in **static mode** with the pre-built document;
  `@fastify/swagger-ui` mounts `/api/docs` from `OpenApiModule.onModuleInit`
  (via `HttpAdapterHost`) only when `isOpenApiDocsEnabled()` — i.e. never in prod.
* `ResponseAssertInterceptor` (+ `response-assert.logic.ts`,
  `route-match.logic.ts`, `ContractViolationError`) validates the outgoing body of
  every **registered** route against `successEnvelopeSchema(entry.dataSchema)` in
  local/dev; it never runs in prod and never touches exempt or plugin routes.

### Shared contract

* `ApiEndpointContract` gained an optional `example`, filled from a new
  [`api-keys.fixture.ts`](../../packages/shared/src/contract/api-keys/api-keys.fixture.ts)
  that the registry test also parses — one sample, two consumers.
* `ENVELOPE_EXEMPTIONS` gained `/api/openapi.json` **with its reason**;
  `/api/docs` is deliberately not listed (it never reaches the Nest filter).

## Decisions worth remembering

1. **`/api/openapi.json` is a Nest controller, not a plugin route** — that is what
   makes it testable, exemptable and independent of `@fastify/swagger`'s route
   naming.
2. **The envelope is described once** as a component with untyped `data`; every
   operation narrows it with `allOf` + a `$ref`. A test asserts the exact `allOf`
   shape, so a future "quick inline" fails.
3. **Payload schemas are referenced by name, never inlined** — request bodies
   included, otherwise the create body would be a second description of
   `createApiKeySchema`.
4. **Two OpenAPI type families had to be bridged.** `@asteasolutions/zod-to-openapi`
   emits `openapi3-ts` types, `@fastify/swagger` expects `openapi-types`, and they
   disagree (e.g. `servers[].variables[].enum`). That single bridge lives in
   `toSwaggerDocument()` in `swagger.plugin.ts`, documented.

## Verification

```
pnpm --filter @callback/api build        # green
pnpm --filter @callback/api lint         # 0 errors (1 pre-existing style warning)
pnpm --filter @callback/api test         # 38 suites / 62 openapi tests green
pnpm --filter @callback/shared test      # 5 suites green
```

Manual run (`APP_ENV=dev PORT=3010 pnpm --filter @callback/api start`):

| Request | Result |
|---|---|
| `GET /api/openapi.json` | `200`, `application/json`, `openapi: 3.1.0`, both `api-keys` paths, `ApiEnvelope`/`ApiErrorEnvelope` + 6 more components, `bearerAuth` |
| `GET /api/docs` | `200`, `text/html` |
| `GET /api/docs/json` | `200`, the same generated document (the UI reads our spec, not a re-derived one) |
| `GET /healthz` | `200`, bare `{status, …}` — unchanged |
| `GET /api` | `200`, enveloped (`{data, meta}`) |

`GET /api/api-keys` returned `500 INTERNAL_ERROR` on that run **only** because no
local Postgres was running — the log line shows the Drizzle query failure, which
is the expected behaviour without `pnpm db:up`.

## Known gaps

* The committed baseline order `docs/Specs/openapi.json` + `openapi:generate` /
  `openapi:check` and the CI breaking-change gate are **AIS-99**.
* `/api/docs` is not mounted in prod at all (decision taken for AIS-98); if it is
  ever wanted there, it needs a Caddy basic-auth rule *and* a new
  `isOpenApiDocsEnabled` rule.
* `api-keys.e2e-spec.ts`-style DB coverage of the validator was not added: the
  validator's behaviour is pinned by unit tests, and its mounting is covered by
  `apps/api/test/openapi.e2e-spec.ts`.
