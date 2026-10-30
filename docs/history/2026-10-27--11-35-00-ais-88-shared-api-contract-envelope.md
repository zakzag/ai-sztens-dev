# 2026-10-27 11:35 — AIS-88: shared API contract (envelope, error catalogue, HTTP statuses)

First subtask of [`AIS-87`](https://zakzag.atlassian.net/browse/AIS-87) (unified API contract +
response envelope). Plan: `docs/plans/2026-10-26--17-21-00-unified-api-contract-and-envelope-plan.md`
(D2, D3, D4, D6, D8, D13).

## What changed

`packages/shared/src/contract/` is now the **only** place where a request or response shape is
written down. Nothing in the server or the client may keep a second copy.

| File                                                                                              | Content                                                                                                                |
| ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| [`http-status.const.ts`](../../packages/shared/src/contract/http-status.const.ts:1)               | `HTTP_STATUS` + `HttpStatus` — one table for server and client (D5)                                                    |
| [`error-code.const.ts`](../../packages/shared/src/contract/error-code.const.ts:1)                 | `API_ERROR_CODE`, `ApiErrorCode`, `API_ERROR_CODE_STATUS`, `UNKNOWN_API_ERROR_CODE_STATUS` (D8)                        |
| [`datetime.schema.ts`](../../packages/shared/src/contract/datetime.schema.ts:1)                   | `isoDateTimeSchema` — the single ISO 8601 (offset required) schema                                                     |
| [`envelope.interface.ts`](../../packages/shared/src/contract/envelope.interface.ts:1)             | `ApiEnvelope<T>`, `ResponseMeta`, `PaginationMeta` (D2)                                                                |
| [`envelope.schema.ts`](../../packages/shared/src/contract/envelope.schema.ts:1)                   | `responseMetaSchema`, `paginationMetaSchema`, `successEnvelopeSchema()`, `toSuccessEnvelope()`                         |
| [`error-envelope.interface.ts`](../../packages/shared/src/contract/error-envelope.interface.ts:1) | `ApiErrorEnvelope`, `ApiErrorBody`, `ApiErrorDetail`, `AppErrorShape`, `ErrorContext`                                  |
| [`error-envelope.ts`](../../packages/shared/src/contract/error-envelope.ts:1)                     | `apiErrorEnvelopeSchema`, `apiErrorDetailSchema`, `apiErrorBodySchema`, `resolveApiErrorStatus()`, `toErrorEnvelope()` |
| [`api-keys/`](../../packages/shared/src/contract/api-keys/api-keys.schema.ts:1)                   | the former `src/schemas/api-key.*` trio, moved (`git mv`, content unchanged apart from imports)                        |
| [`index.ts`](../../packages/shared/src/contract/index.ts:1)                                       | explicit re-exports (no `export *`)                                                                                    |

Public surface: [`packages/shared/src/index.ts`](../../packages/shared/src/index.ts:1) re-exports the
contract explicitly; the old `packages/shared/src/schemas/` folder is gone.

Client side: [`packages/api-client/src/api-error.const.ts`](../../packages/api-client/src/api-error.const.ts:1)
no longer declares its own `HTTP_STATUS` — it re-exports the shared one, so the duplicated constant
between the two packages is gone (decision 6 of the subtask).

## Decisions taken while implementing

1. **The status is derived from the code**, never passed in (`toErrorEnvelope(error, ctx)`); the
   catalogue maps `API_KEY_IDENTIFIER_CONFLICT → 409` etc. A service says _what_ went wrong only.
2. **An unknown code stays on the wire and gets `500`.** `code` in the schema is therefore a free
   string, not an enum: a code from a newer server must still parse on an older client (D8), and
   `resolveApiErrorStatus` only honours _own_ keys of the catalogue (`toString` must not resolve).
3. **`details` is always present**, `[]` when no field is at fault — same rule as `data`/`meta`.
4. **`meta` is always `requestId` + `timestamp`**, `pagination` is absent (never `null`) when the
   endpoint does not paginate. The factories take these as arguments: no clock, no `randomUUID`, so
   they stay pure and the server filter/test build identical bodies.
5. **`data` is required in the parsed type.** `z.ZodTypeAny` as the payload parameter made zod's
   `objectUtil.addQuestionMarks` mark `data` optional (it cannot prove a generic type excludes
   `undefined`). The payload parameter is `z.ZodType<TPayload, …, unknown>` with
   `TPayload extends object`, and the schema closes with an explicitly typed identity `transform`, so
   the published type is `ApiEnvelope<TPayload>` with a required `data` — no type assertion.

## Tests

New: `packages/shared/test/envelope.test.ts` (object / array / `null` payload, minimal vs paginated
meta, missing `data`, missing `meta`, unknown key stripping, bad timestamps, pagination bounds) and
`packages/shared/test/error-envelope.test.ts` (every catalogue code → status, unknown code → 500,
details copy, catalogue invariants, schema accept/reject cases). The `api-key.schema.test.ts` cases
moved with the source and are unchanged.

## Verification

```bash
pnpm --filter @callback/shared build      # ok
pnpm --filter @callback/shared test       # 4 suites, 85 tests, green
pnpm --filter @callback/api-client build  # ok
pnpm --filter @callback/api-client test   # 2 suites, 29 tests, green
pnpm --filter @callback/admin test        # 10 files, 87 tests, green
pnpm --filter @callback/admin lint        # clean
pnpm --filter @callback/admin build       # ok
```

`rg "src/schemas"` now only hits historical plans/history documents; `docs/Specs/UI-Architecture.md`
(§6 recipe and the header date) was updated because the shared wire-schema location changed.

## Follow-ups

- AIS-89: endpoint registry (`ApiEndpointContract`) on top of this contract.
- AIS-90/91/92: `AppError`, Zod pipes, `ApiResponseService`, global `ApiExceptionFilter`, requestId.
- AIS-93/94: `api-keys` migration to the envelope on the server, envelope unwrapping in the client.
- AIS-100: `docs/Specs/API-Convention.md` plus the story-level milestone (this subtask records its
  narrative here only; the decision-grade summary belongs to the story milestone).
