# Milestone — removing the global `ValidationPipe` and the class-validator dependency

**Date:** 2026-10-28 · **Ticket:** AIS-93 (story AIS-87) · **Type:** contract consolidation

## 1. Problem / feature

AIS-87 moved every request/response shape into `packages/shared/src/contract` (Zod) and validated
requests with route-level `ZodBodyPipe` / `ZodQueryPipe`. AIS-93's DoD still carried the line
"`class-validator` stays only where it is still justified (the VAPI DTO)". Checking that assumption
showed the justification did not exist, leaving `apps/api` with a second, inactive validation layer.

## 2. Measured data / evidence

| Check                                                                                  | Result                                                                                                                     |
| -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `rg "class-validator\|class-transformer" apps/api/src`                                 | comment hits only — **no import** anywhere                                                                                 |
| `rg "@(IsString\|IsObject\|IsOptional\|ValidateNested\|…)" apps/api/src/vapi-webhooks` | 0 hits — the "DTO" is a plain interface ([`vapi-event.dto.ts`](../../apps/api/src/vapi-webhooks/dto/vapi-event.dto.ts:18)) |
| `rg "@Body\(" apps/api/src`                                                            | 1 validated route (`api-keys`, Zod pipe) + 2 bare `@Body()` on interface types                                             |
| `ValidationPipe` behaviour on an interface-typed `@Body()`                             | `ValidationPipe.toValidate()` returns `false` (no metatype) → value passed through untouched                               |
| `apps/api/package.json` direct deps on the two packages                                | present, unused                                                                                                            |

Net effect before the change: a pipe that validated nothing, installed globally, on top of two
dependencies nothing imported. It made "an unvalidated route" invisible.

## 3. Root cause / design rationale

The pipe was introduced in AIS-10/AIS-40 when `CreateApiKeyDto` was a class-validator DTO. AIS-93
deleted that DTO and replaced it with the shared Zod schema, but the _global_ installation was left
behind — it was the last class-validator-era artefact and it outlived its reason.

Alternatives considered:

- **Keep the pipe as a safety net.** Rejected: it silently strips/forbids nothing for interface-typed
  bodies, so it gives false assurance while adding a second validation philosophy next to Zod.
- **Keep the dependencies "in case".** Rejected: an unused peer-shaped dependency invites the next
  contributor to write a DTO class again — exactly the three-truths problem AIS-87 removed.
- **Replace the pipe with a Zod catch-all.** Rejected: the contract is per route (`entry.requestSchema`
  in the registry); a catch-all would need the registry at runtime and would hide the per-route
  decision that the ticket wants to be explicit.

## 4. Solution / implementation

| File                                                                                                                                                                                | Change                                                                                                                                                                       |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`apps/api/src/main.ts`](../../apps/api/src/main.ts:63)                                                                                                                             | import + `app.useGlobalPipes(new ValidationPipe(...))` removed; comment records why it must not come back                                                                    |
| [`apps/api/package.json`](../../apps/api/package.json:26)                                                                                                                           | `class-validator`, `class-transformer` removed                                                                                                                               |
| `pnpm-lock.yaml`                                                                                                                                                                    | re-resolved; the `apps/api` importer lists neither (they remain only as **optional peers** of `@nestjs/common`, which is a package-manager detail, not a dependency of ours) |
| [`apps/api/test/api-keys.e2e-spec.ts`](../../apps/api/test/api-keys.e2e-spec.ts:127), [`apps/api/test/vapi-webhooks.e2e-spec.ts`](../../apps/api/test/vapi-webhooks.e2e-spec.ts:91) | boot helpers no longer mirror a pipe `main.ts` does not install (they must mirror production, so a stale mirror is a false positive)                                         |
| [`apps/api/src/common/http/to-app-error.ts`](../../apps/api/src/common/http/to-app-error.ts:70)                                                                                     | docblock: `message: string[]` is now a legacy/third-party shape, still mapped to whole-payload details                                                                       |
| [`docs/Specs/API-Convention.md`](../../docs/Specs/API-Convention.md:24)                                                                                                             | §1 and §7 state the new rule: no global pipe, no class-validator, validation is per route with the shared schema                                                             |

## 5. Outcome and how to verify

Validation now has exactly one path: the shared Zod schema, applied by a route-level pipe, producing
`VALIDATION_FAILED` with field paths. An unvalidated route is visible in review (no pipe on the
handler) instead of being masked by a global pipe.

```bash
rg "class-validator|class-transformer" apps/api/src apps/api/package.json   # comments only, no imports/deps
rg "ValidationPipe" apps/api/src apps/api/test                              # comments + the ZodValidationPipe base class only; no `useGlobalPipes`
pnpm --filter @callback/api test        # 31 suites, 297 tests
pnpm --filter @callback/api test:e2e    # 8 suites, 33 tests (AppModule suites self-skip on Node < 24.9)
pnpm --filter @callback/api build
pnpm --filter @callback/api lint
```

Manual: `curl -X POST /api/api-keys` with `{"name":"x"}` (no `apiKey`) → `400`, `code: VALIDATION_FAILED`,
`details[].path === "apiKey"`, and `X-Request-Id` on the response.

## 6. Follow-ups

- The VAPI webhook bodies remain **unvalidated by design** (provider-owned, verified by HMAC over the
  raw body). If VAPI payloads ever need field validation, it belongs in a Zod schema in
  `@callback/shared` + a `ZodBodyPipe` — not in a resurrected global pipe.
- `@nestjs/common` still declares the two packages as optional peers; do not read that as a licence to
  depend on them again.
