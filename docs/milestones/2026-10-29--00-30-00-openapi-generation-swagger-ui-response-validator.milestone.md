# Milestone — generated OpenAPI document, Swagger UI and the dev response validator

**Date:** 2026-10-29 00:30 (Europe/Budapest)
**Ticket:** AIS-98 (subtask of AIS-87)
**Plan:** [`docs/plans/2026-10-29--00-10-00-ais-98-openapi-swagger-response-validator-plan.md`](../plans/2026-10-29--00-10-00-ais-98-openapi-swagger-response-validator-plan.md)

## 1. Problem / feature

The API contract lived only in `packages/shared/src/contract` (Zod schemas + endpoint
registry). No machine-readable description was served, so there was no clickable
reference and nothing consumable by Postman/agents. Worse: **nothing checked the
server's own output** — a mapper that dropped a field, or a controller that forgot
`responses.ok()`, was only discovered in the browser.

## 2. Evidence

- `packages/shared/test/endpoint-registry.test.ts` already proved the registry is
  complete — but nothing consumed it at runtime.
- The envelope e2e suites assert _errors_, never that a **successful** body still
  matches its schema; a bare payload from a controller passed every gate.
- After the change, a manual run showed `GET /api/openapi.json` → `200`,
  `openapi: 3.1.0`, both `api-keys` paths, 8 components and `bearerAuth`;
  `GET /api/docs` → `200 text/html`; `GET /api/docs/json` → the same document;
  `GET /healthz` → unchanged bare body.

## 3. Design rationale

| Decision                                                                           | Why                                                                                                                                                     | Rejected alternative                                                                          |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Generate from `API_ENDPOINTS` with `@asteasolutions/zod-to-openapi`                | One description: the spec points at the schemas the server validates and the client parses                                                              | `@nestjs/swagger` decorators (a second shape description, built on DTOs that no longer exist) |
| Envelope as a **component** + `allOf` per operation                                | The envelope is written once; a new endpoint cannot restate `meta`                                                                                      | Inlining `successEnvelopeSchema()` per route (duplicates the envelope in every response)      |
| Payload/request schemas referenced by **name**                                     | Request bodies stay a `$ref` too, so no endpoint re-describes a payload                                                                                 | Inlining the Zod schema (what the first draft did for `POST`)                                 |
| `/api/openapi.json` = **Nest controller**                                          | Testable, exemptable, independent of plugin route naming                                                                                                | `@fastify/swagger`'s own `/json` route                                                        |
| `/api/docs` = `@fastify/swagger` static + `swagger-ui`, registered from the module | The UI is third-party HTML; it never touches `packages/ui` or the envelope filter. Module-level registration also makes it testable through `AppModule` | Registering in `main.ts` (invisible to e2e)                                                   |
| UI/validator off in **prod**                                                       | The UI maps the admin surface; the validator adds a parse and deliberately fails a live request                                                         | Caddy basic-auth in prod (deferred; would need an infra change)                               |
| Validator = `APP_INTERCEPTOR`, route-matched against the registry                  | An exempt route (`/healthz`, VAPI) or a plugin asset is never validated; a registered one always is                                                     | A global middleware (cannot see the matched route pattern cleanly)                            |

Two type families had to be bridged: `zod-to-openapi` emits `openapi3-ts` types,
`@fastify/swagger` expects `openapi-types`, and they disagree on optional details
(e.g. `servers[].variables[].enum`). The bridge is a single documented function,
`toSwaggerDocument()` in `swagger.plugin.ts`, which passes the document through its
JSON form — the value both libraries actually receive.

## 4. Implementation

| File                                                                                                                                            | Change                                                                                                                                                                                                 |
| ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `apps/api/src/common/openapi/openapi.config.ts`                                                                                                 | NEW — constants, route paths, bearer scheme, `isOpenApiDocsEnabled()`, `isResponseAssertEnabled()`                                                                                                     |
| `apps/api/src/common/openapi/zod-openapi.ts`                                                                                                    | NEW — `extendZodWithOpenApi`, components (`ApiEnvelope`, `ApiErrorEnvelope`, meta, error detail), `envelopeOf()`, `openApiErrorResponses()`, `toOpenApiPath()`, `pathParameters()`, payload name table |
| `apps/api/src/common/openapi/openapi.registry.ts`                                                                                               | NEW — pure, memoised `buildOpenApiDocument()` / `openApiDocument()`                                                                                                                                    |
| `apps/api/src/common/openapi/openapi.controller.ts`                                                                                             | NEW — `@SkipEnvelope() GET /api/openapi.json`                                                                                                                                                          |
| `apps/api/src/common/openapi/swagger.plugin.ts`                                                                                                 | NEW — static-mode plugin pair + the type bridge                                                                                                                                                        |
| `apps/api/src/common/openapi/openapi.module.ts`                                                                                                 | NEW — document provider, conditional UI registration, conditional `APP_INTERCEPTOR`                                                                                                                    |
| `apps/api/src/common/openapi/response-assert.interceptor.ts`, `response-assert.logic.ts`, `route-match.logic.ts`, `contract-violation.error.ts` | NEW — the validator                                                                                                                                                                                    |
| `apps/api/src/common/openapi/openapi.interface.ts`, `openapi.const.ts`, `openapi.errors.ts`                                                     | NEW — derived types, DI token, `UnregisteredPayloadSchemaError`                                                                                                                                        |
| `apps/api/src/common/openapi/test/mocks/openapi.mock.ts`                                                                                        | NEW — execution context, call handler, envelope fixtures                                                                                                                                               |
| `apps/api/src/common/openapi/*.spec.ts` (5)                                                                                                     | NEW — generation, components, config, validator, controller                                                                                                                                            |
| `apps/api/test/openapi.e2e-spec.ts`                                                                                                             | NEW — document + UI + raw `healthz`                                                                                                                                                                    |
| `apps/api/src/app.module.ts`                                                                                                                    | `OpenApiModule` imported after `HttpModule`                                                                                                                                                            |
| `apps/api/package.json`                                                                                                                         | `@asteasolutions/zod-to-openapi`, `@fastify/swagger`, `@fastify/swagger-ui`, `fastify`                                                                                                                 |
| `packages/shared/src/contract/endpoint.interface.ts`                                                                                            | optional `example`                                                                                                                                                                                     |
| `packages/shared/src/contract/api-keys/api-keys.fixture.ts`                                                                                     | NEW — `VALID_API_KEY`, `VALID_API_KEY_LIST`                                                                                                                                                            |
| `packages/shared/src/contract/api-keys/api-keys.contract.ts`                                                                                    | examples per entry                                                                                                                                                                                     |
| `packages/shared/src/contract/endpoint.registry.ts`                                                                                             | `ENVELOPE_EXEMPTIONS` += `/api/openapi.json` (with reason)                                                                                                                                             |
| `packages/shared/src/{index,contract/index}.ts`, `packages/shared/test/endpoint-registry.test.ts`                                               | export/consume the fixture                                                                                                                                                                             |
| `apps/api/src/common/http/envelope-exemptions.spec.ts`                                                                                          | `OpenApiController` in the inventory                                                                                                                                                                   |
| `docs/Specs/API-Convention.md`                                                                                                                  | exemption table, TODO replaced, enforcement table, known gaps                                                                                                                                          |

## 5. Outcome and how to verify

```bash
pnpm --filter @callback/api build     # green
pnpm --filter @callback/api lint      # 0 errors
pnpm --filter @callback/api test      # 38 suites green
pnpm --filter @callback/shared test   # 5 suites green

APP_ENV=dev PORT=3010 pnpm --filter @callback/api start
curl -s localhost:3010/api/openapi.json | head -c 80      # {"openapi":"3.1.0",...
curl -s -o NUL -w "%{http_code} %{content_type}\n" localhost:3010/api/docs   # 200 text/html
curl -s localhost:3010/healthz                            # {"status":"oks",...}
```

Prod check: `isOpenApiDocsEnabled('prod') === false` (unit-tested), so the UI is not
mounted while `/api/openapi.json` stays reachable.

## 6. Follow-ups

- **AIS-99** — committed baseline `docs/Specs/openapi.json`, `openapi:generate` /
  `openapi:check`, CI breaking-change gate. The generator is already deterministic
  (asserted by test), so the script is a thin wrapper.
- **AIS-100** — full `API-Convention.md` pass (only the affected sections were
  updated here).
- `/api/docs` behind Caddy basic-auth in prod, if ever needed.
