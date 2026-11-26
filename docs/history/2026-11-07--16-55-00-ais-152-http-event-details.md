# AIS-152 — `HttpEvent` enrichment and structured `details` in the admin log

**Date:** 2026-11-07 · **Ticket:** [AIS-152](https://zakzag.atlassian.net/browse/AIS-152) · **Parent:** AIS-143
**Plan:** [`docs/plans/2026-11-07--15-25-00-ais-152-http-event-details-plan.md`](../plans/2026-11-07--15-25-00-ais-152-http-event-details-plan.md)

## What was built

The transport used to report `{ method, path, status, durationMs, outcome }` and drop the success
`meta`, the `X-Request-Id` header, the query string and the request body; a failure glued `requestId`
and the field issues into one string. The ticket turns that into structured log data.

### `packages/api-client`

| File | Change |
| ---- | ------ |
| `src/http-event.const.ts` (new) | `HTTP_BODY_PREVIEW_MAX_LENGTH = 500`, `HTTP_QUERY_MAX_LENGTH = 500`, `HTTP_EVENT_TRUNCATION_SUFFIX`, `REQUEST_ID_HEADER = 'x-request-id'`, `HTTP_PREVIEW_SENSITIVE_KEY_PATTERN`, `HTTP_PREVIEW_REDACTED_PLACEHOLDER` |
| `src/http-event.logic.ts` (new) | pure `toEventQuery`, `toBodyPreview` (masks a sensitive **top-level** key before serialising), `toResponseMeta` (validated with the shared `responseMetaSchema`) |
| `src/http-client.interface.ts` | `HttpEvent` gains `requestId`, `query`, `bodyPreview`, `responseMeta` (all `readonly`) + new `HttpEventResponseMeta`; new internal `AttemptOutcome<T>` / `AttemptRequest<T>`; the privacy JSDoc was rewritten (token never, body only as a masked prefix, store owns value redaction) |
| `src/http-client.ts` | `attempt()` now takes one `AttemptRequest` object, `parsePayload`/`parseListPayload` return `{ data, responseMeta }` (one body read), all three emit paths (network, non-2xx, drift) fill the new fields |
| `src/index.ts` | exports `HttpEventResponseMeta`, `AttemptOutcome`, `AttemptRequest` |
| `test/http-event.logic.test.ts` (new), `test/http-client.test.ts`, `test/mocks/fetch.mock.ts` (`withHeader`) | 12 new cases: query truncation, masked body, unserialisable body, meta validation, header-vs-envelope `requestId`, `totalItems`, drift/non-2xx `responseMeta: null` |

### `apps/admin`

| File | Change |
| ---- | ------ |
| `app/notifications/notification.const.ts` | one `DETAIL_LABEL_*` constant per row + `OPERATION_META_KEY` |
| `app/notifications/notification.interface.ts` | `OperationContext { operation: string \| null }`, `OperationReader`, both failure contexts extend it |
| `app/notifications/notification-events.logic.ts` | new `toHttpDetails`, `toFailureDetails` (one row per field issue), `toRuntimeDetails`, `readOperationMeta`; the four entry builders set `details`, every `detail` string stayed byte-identical |
| `app/notifications/notification-capture.ts` | `createHttpEventEmitter(store, readOperation)`; query/mutation handlers forward `readOperationMeta(meta)` |
| `app/notifications/runtime-error.ts` | emits `details: toRuntimeDetails(report, includeDetails)` |
| `main.tsx` | `readRouteOperation = () => window.location.pathname`, composed once (the only `window.location` read) |
| `test/mocks/http-event.fixture.ts` (new) | `createTestHttpEvent`, `createTestHttpEventMeta`, `createTestOperationReader`; the inline `HttpEvent` literals in the two specs are gone |
| `notification-events.logic.test.ts`, `notification-capture.test.ts` | 40 + 14 cases including the per-issue rows, the skipped-empty-row rule and the operation forwarding |

## Decisions that deviate from the ticket text

- **`DETAIL_LABEL_REPEAT` and `DETAIL_LABEL_TIMESTAMP` were not created.** `repeatCount` and
  `createdAt` are store-owned fields the row renders from the entry (AIS-153), so the constants would
  have been unused exports and `pnpm quality:dead-code` would fail.
- **The body preview masks sensitive top-level keys.** The store redacts by *detail label*, and the
  whole body travels under one label, so a credential nested in a payload would otherwise reach
  `sessionStorage`. A test asserts neither the injected token nor a body `token` appears.

## Docs

`docs/Specs/API-Convention.md` (§9 `onEvent`, §10 tier 4, header date) and
`docs/Specs/UI-Architecture.md` (§4.1.3 capture matrix, the structured-half paragraph, the wiring
order, header date) were updated in the same change.

## Verification

```bash
pnpm --filter @callback/api-client test   # 222 passed
pnpm --filter @callback/api-client build
pnpm --filter @callback/admin test
pnpm typecheck && pnpm lint && pnpm quality
```

`ApiKeyForm.test.tsx` hit two 5 s timeouts in one **full** admin run (while passing in isolation,
13/13) and passed in the next full run (43 files, 490 tests) — a pre-existing load flake, not a
behavioural change.
