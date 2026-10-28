# 2026-10-28 14:48 — AIS-90 completed: catalogue-typed AppError codes and full pipe coverage

## What was asked

Finish AIS-90 (AppError hierarchy + `ZodBodyPipe`/`ZodQueryPipe`). The bulk was
already committed in `b40ad63`; four DoD gaps remained.

## What was implemented

| Gap | Change |
|---|---|
| `AppError.code` was typed `string`, so an uncatalogued code compiled | `AppErrorInit.code` and `ConflictAppError`'s override are now `ApiErrorCode` (`app-error.interface.ts`, `app-error.ts`); `toApiErrorCode()` returns `ApiErrorCode` too (`api-error-code.mapper.ts`) |
| compile-time proof | Two `@ts-expect-error` tests in `app-error.spec.ts` (init with a non-catalogue code, conflict with an uncatalogued override) — ts-jest fails with TS2578 if the type stops rejecting them |
| "undeclared key → 400" was only asserted the other way round | `zod.pipe.spec.ts` now proves the strict path with the real `createApiKeySchema` (client-injected `id` → `VALIDATION_FAILED` / `400`, message "Unrecognized key") and keeps the tolerated-strip case for a non-strict schema |
| no `zod-error.mapper` coverage | new `zod-error.mapper.spec.ts`: field path, nested `lines.1.quantity`, root `''`, deterministic issue order, record-key segment, non-empty message |
| missing pipe cases | wrong field type, `null` body, `undefined` body, query `'abc'`, absent optional query key |

`zod.pipe.ts` also gained a docblock stating that **strictness is a schema
property**, not a pipe flag — so the old `forbidNonWhitelisted` semantics stay
visible in the contract instead of hiding inside the pipe.

## Verification

```bash
pnpm --filter @callback/api test    # 25 suites / 226 passed (was 24 / 212)
pnpm --filter @callback/api build   # green
pnpm --filter @callback/api lint    # green
```

The two `@ts-expect-error` directives passing is the proof that the catalogue now
constrains `AppError` at compile time.

## Notes

* The runtime fallback for an unknown code still exists in `resolveApiErrorStatus`
  — it protects against a **newer server answering an older bundle**, not against
  our own code; `AppError` can no longer be constructed with such a code.
* Deviations from the ticket text that were kept (and are deliberate): `status` is
  a derived getter instead of a per-subclass constant; `message` stays on
  `Error.message` with `cause` holding the original failure; the nine proposed
  files are realised as three (`app-error.ts`, `zod.pipe.ts`, `zod-error.mapper.ts`).
