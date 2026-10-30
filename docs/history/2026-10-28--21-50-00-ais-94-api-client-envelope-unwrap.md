# 2026-10-28 21:50 — AIS-94: pure envelope unwrap + `issues[]` on contract drift

## What was asked

Close AIS-94 (subtask of AIS-87). The ticket's behaviour had mostly shipped with AIS-87 on
2026-10-27; this session verified the state against the code, found five remaining gaps and
closed them.

Plan: [`docs/plans/2026-10-28--18-50-00-ais-94-api-client-envelope-unwrap-remaining-plan.md`](../plans/2026-10-28--18-50-00-ais-94-api-client-envelope-unwrap-remaining-plan.md).

## State check (verified, not assumed)

| Ticket item                                                         | Where it already lived              |
| ------------------------------------------------------------------- | ----------------------------------- |
| Transport unwraps `{ data, meta }`, services untouched              | `http-client.ts` → `parsePayload()` |
| Tolerant non-JSON path (Caddy `502` → status-only error)            | `readBody()` + transport test       |
| `ApiError` with `code`, `requestId`, `issues[]`, legacy `details[]` | `api-error.ts`                      |
| Untrusted error-body parsing + legacy Nest fallback                 | `parseErrorBody()`                  |
| Path from the shared registry (`clientPathOf`)                      | `api-keys/api-keys.const.ts`        |

## Gaps found and closed

| #                | Gap                                                                                                                                       | Fix                                                                                                                                               |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| G1               | Unwrap was private inside `http-client.ts`; the ticket's pure-function cases were only reachable through a `Response` double              | new `envelope.logic.ts` (`unwrapEnvelope`, `toIssueDetails`, `toPayloadRelativePath`) + `envelope.logic.interface.ts` (`EnvelopeUnwrapResult<T>`) |
| **G2 (defect)**  | `toPayloadError()` never set `issues` — DoD “drift → `UNEXPECTED_PAYLOAD` + `issues`” was unmet, so the admin could not highlight a field | `toPayloadError()` now takes the issue list and passes it as `issues`                                                                             |
| **G2b (defect)** | zod paths came from `successEnvelopeSchema()`, i.e. `data.identifier`, which matches no form field                                        | `toPayloadRelativePath()` strips the envelope wrapper; a payload-level issue becomes the empty path                                               |
| G3               | `api-error.const.ts` re-exported `HTTP_STATUS` only                                                                                       | also re-exports `API_ERROR_CODE` + `ApiErrorCode` from `@callback/shared`, and both are exported from `index.ts`                                  |
| G4               | `api-error.ts` had no dedicated spec                                                                                                      | new `test/api-error.test.ts`                                                                                                                      |
| G5               | `createCodedError()` could not express `issues`                                                                                           | optional `issues` added; `createValidationError()` now uses it                                                                                    |

`details` is now always the rendering of `issues` (`formatIssueLine`, exported from `api-error.ts`),
so the two views of one failure cannot disagree.

## Files of note

- `packages/api-client/src/envelope.logic.ts`, `envelope.logic.interface.ts` — new pure module
- `packages/api-client/src/http-client.ts` — `parsePayload()` delegates to `unwrapEnvelope`; drift error carries `issues`
- `packages/api-client/src/api-error.ts` — `toDetailLine` → exported `formatIssueLine`
- `packages/api-client/src/api-error.const.ts`, `index.ts` — `API_ERROR_CODE` / `ApiErrorCode` re-export
- `packages/api-client/test/envelope.logic.test.ts`, `test/api-error.test.ts` — new
- `packages/api-client/test/http-client.test.ts` — drift cases now assert payload-relative `issues`
- `apps/admin/src/test/mocks/api-error.mock.ts` — `issues` on the factory
- `docs/Specs/API-Convention.md` §9 / §12 — living doc refreshed

## Verification

```bash
pnpm --filter @callback/api-client test    # 97 passed (5 suites)
pnpm --filter @callback/shared build       # green
pnpm --filter @callback/api-client build   # green
pnpm --filter @callback/admin test         # 89 passed (10 files)
pnpm lint                                  # green (api, admin)
```

No milestone was written: this is an extraction plus two narrow defects, with no production
incident and no deploy surface change.
