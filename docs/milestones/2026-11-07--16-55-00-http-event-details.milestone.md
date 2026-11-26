# Milestone — transport telemetry became structured log data (AIS-152)

## Problem / feature

The admin's log drawer could only show a one-line summary per request. The transport
(`packages/api-client`) reported `{ method, path, status, durationMs, outcome }` and dropped
everything else: the success `meta`, the `X-Request-Id` header, the query string and the request
body. A failed query or mutation flattened `requestId` and the field issues into one joined string,
so "which input was rejected" had to be read out of prose. AIS-151 added
`details?: NotificationDetailField[]` to the notification entry (store-side redaction, label/value
clamping, `sessionStorage` guard); AIS-152 fills it from all three capture channels.

## Evidence

- `HttpEvent` had **no** field for a correlation id, a query, a body or the response meta — the type's
  JSDoc even claimed a listener *could not* leak a body, which stopped being true the moment a
  preview was needed.
- A validation failure with three bad inputs produced one `detail` string
  (`status=400 · code=FAILED · queryKey=[…]`); the three issues were invisible in the log.
- The success path never read `meta`, so a **successful** request had no id to grep in the server log.

## Design rationale

| Decision | Why |
| -------- | --- |
| `requestId` = header → `meta.requestId` → `ApiError.requestId` | The server sets `X-Request-Id` on every response (success included), so successful attempts become traceable too; the fallbacks need no second body read. |
| Query emitted unfiltered, only truncated | The log is an engineering tool; a redacted filter would make a bug report unreproducible. Length is the only real risk (`sessionStorage`). |
| Body preview from the **serialised, masked** payload | The Authorization header is never read into the event, and a top-level `token`/`password`/`secret`/`apiKey`/`authorization` key in the body becomes `<redacted>` **before** serialisation — the store's redaction is label-based, so it cannot protect a secret nested in one opaque body value. |
| `details` are additive, `detail` untouched | The toast and the collapsed row keep their existing strings; the structured rows are what the expanded row (AIS-153) renders. |
| `operation` injected, never inferred in the transport | The transport only sees a URL. Query/mutation take `meta.operation`; a HTTP event takes `readOperation()` from `main.tsx`, the one place allowed to read `window.location`. |
| `repeatCount` / `createdAt` kept out of `details` | Both are store-owned entry fields; duplicating them would create unused label constants and fail the dead-code gate. |
| `attempt()` takes one `AttemptRequest` object | Six positional parameters (with a body preview source) would have invited an argument-shift bug; the object also let `parse` return `{ data, responseMeta }` from a single body read. |

## Implementation

| File | Change |
| ---- | ------ |
| `packages/api-client/src/http-event.const.ts` (new) | limits, truncation suffix, request-id header, sensitive-key pattern, placeholder |
| `packages/api-client/src/http-event.logic.ts` (new) | pure `toEventQuery`, `toBodyPreview` (masking), `toResponseMeta` (shared `responseMetaSchema`) |
| `packages/api-client/src/http-client.interface.ts` | `HttpEvent` + 4 readonly fields, `HttpEventResponseMeta`, `AttemptOutcome`, `AttemptRequest`, rewritten privacy JSDoc |
| `packages/api-client/src/http-client.ts` | object-shaped `attempt`, meta from the same body, request-id resolution per path |
| `packages/api-client/src/index.ts` | exports the new event types |
| `apps/admin/.../notification.const.ts` | `DETAIL_LABEL_*` constants, `OPERATION_META_KEY` |
| `apps/admin/.../notification.interface.ts` | `OperationContext`, `OperationReader` |
| `apps/admin/.../notification-events.logic.ts` | `toHttpDetails`, `toFailureDetails` (one row per issue), `toRuntimeDetails`, `readOperationMeta` |
| `apps/admin/.../notification-capture.ts` | reader injection + `meta.operation` forwarding |
| `apps/admin/src/main.tsx` | `readRouteOperation` composition |
| `apps/admin/.../runtime-error.ts` | crashes carry structured rows too |
| `apps/admin/src/test/mocks/http-event.fixture.ts` (new) | event/meta/reader fixtures; no inline `HttpEvent` literal left in a spec |

## Outcome and how to verify

The log entry now answers "what was called, how was it answered, what was sent, where from" without
a server log, and a validation failure lists one row per rejected field.

```bash
pnpm --filter @callback/api-client test      # 222 tests, incl. the new event derivation suite
pnpm --filter @callback/api-client build
pnpm --filter @callback/admin test           # 40 logic + 14 capture cases
pnpm typecheck && pnpm lint && pnpm quality
```

Manual check: open the admin, trigger a failing write (e.g. duplicate API key identifier) and expand
the entry — the rows must show `code`, `status`, `requestId`, `queryKey`, one row per issue, `url`,
`surface`; a `GET` must have no `body` row, and the Authorization token must appear nowhere.

## Follow-ups

- AIS-153 renders these rows in the collapsible `packages/ui` row (and may add a `repeatCount` label).
- `toBodyPreview` masks **top-level** keys only; a deeply nested secret is covered only when its
  top-level key names it.
- `ApiKeyForm.test.tsx` showed two 5 s timeouts under full-suite load while passing in isolation — a
  pre-existing timing flake worth stabilising separately.
