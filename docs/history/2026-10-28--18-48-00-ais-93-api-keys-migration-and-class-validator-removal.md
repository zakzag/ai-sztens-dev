# 2026-10-28 18:48 — AIS-93 verified and closed: `api-keys` on the envelope, `class-validator` removed

## What was asked

Continue the AIS-87 chain: verify the `api-keys` backend migration (AIS-93) against its DoD and
close the gaps it still had.

## What was verified (already in place)

| DoD item                                                                | Evidence                                                                                                                                                                                                                                                                                                                                                   |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Controller wraps every response: `responses.ok(result, ctx)`            | [`api-keys.controller.ts`](../../apps/api/src/api-keys/api-keys.controller.ts:46), `:55`, `:68`                                                                                                                                                                                                                                                            |
| Service throws `AppError`, not `HttpException`                          | [`api-keys.service.ts`](../../apps/api/src/api-keys/api-keys.service.ts:62), `:85` — `NotFoundAppError`, `ConflictAppError` with `API_KEY_IDENTIFIER_CONFLICT`                                                                                                                                                                                             |
| Body validated by the shared Zod schema                                 | `@Body(new ZodBodyPipe(createApiKeySchema))`                                                                                                                                                                                                                                                                                                               |
| `create-api-key.dto.ts`, its spec and the local wire interface are gone | folder listing: no `dto/`, no `api-keys.interface.ts`                                                                                                                                                                                                                                                                                                      |
| Contract limits not duplicated on the server                            | [`api-keys.const.ts`](../../apps/api/src/api-keys/api-keys.const.ts:1) keeps only DI token, route segment and Postgres codes                                                                                                                                                                                                                               |
| e2e covers the whole DoD                                                | [`api-keys.e2e-spec.ts`](../../apps/api/test/api-keys.e2e-spec.ts:182) — 201 envelope, 200 list/one, 404 `NOT_FOUND`, 409 `API_KEY_IDENTIFIER_CONFLICT` with `details[0].path === 'identifier'`, 400 `VALIDATION_FAILED` with `apiKey` path, 400 for server-managed `id`, 400 for a slashed identifier, inbound `X-Request-Id` echoed in `meta` and header |

## Gap found and closed

The DoD said “`class-validator` stays only where it is still justified (the VAPI DTO), and the
`package.json` diff shows it”. Reading the actual code, the VAPI “DTO” is a **plain TypeScript
interface** ([`vapi-event.dto.ts`](../../apps/api/src/vapi-webhooks/dto/vapi-event.dto.ts:18)) with no
decorators, and the controller uses a bare `@Body()`. So nothing in the app used
`class-validator` / `class-transformer`, and the global `ValidationPipe` in `main.ts` validated
nothing (no metatype → pass-through). Both the dependency and the pipe were dead weight that still
_looked_ like an active contract layer.

| File                                                                                            | Change                                                                                                                            |
| ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| [`apps/api/src/main.ts`](../../apps/api/src/main.ts:63)                                         | global `ValidationPipe` removed, replaced by a comment saying validation belongs to the Zod pipes                                 |
| [`apps/api/src/common/http/to-app-error.ts`](../../apps/api/src/common/http/to-app-error.ts:70) | docblock corrected: a `message: string[]` exception is now a legacy/third-party shape, not something our own pipe produces        |
| [`apps/api/test/api-keys.e2e-spec.ts`](../../apps/api/test/api-keys.e2e-spec.ts:127)            | the boot helper no longer mirrors a pipe that does not exist                                                                      |
| [`apps/api/test/vapi-webhooks.e2e-spec.ts`](../../apps/api/test/vapi-webhooks.e2e-spec.ts:91)   | same                                                                                                                              |
| [`apps/api/package.json`](../../apps/api/package.json:26)                                       | `class-validator` + `class-transformer` removed from dependencies                                                                 |
| `pnpm-lock.yaml`                                                                                | re-resolved; the `apps/api` importer no longer lists either package (they survive only as **optional peers** of `@nestjs/common`) |
| [`docs/Specs/API-Convention.md`](../../docs/Specs/API-Convention.md:24)                         | §1 and §7 state that no global validation pipe and no class-validator dependency exist                                            |

## Gates

```bash
pnpm --filter @callback/api test        # 31 suites, 297 tests
pnpm --filter @callback/api test:e2e    # 8 suites, 33 tests (AppModule suites self-skip on Node 20.19.2)
pnpm --filter @callback/api build       # green
pnpm --filter @callback/api lint        # green
```

## Why removing the pipe is safe

`ValidationPipe` only acts on a class metatype. Every `@Body()` in the app is either
`@Body(new ZodBodyPipe(schema))` (validated) or `@Body() event: VapiEvent` where `VapiEvent` is an
interface — erased at runtime, so the pipe returned the value untouched. No `@Param`/`@Query`
handler relied on `transform: true` coercion either (path params are strings, and the query pipes
coerce in the schema). The behaviour of every route is therefore unchanged; what changed is that
the _absence_ of validation is now visible instead of masked.

Jira: AIS-93 commented and moved to `Done`.
