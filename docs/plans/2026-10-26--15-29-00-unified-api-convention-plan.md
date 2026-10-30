# Unified server–client API convention — implementation plan

**Created:** 2026-10-26 15:29 (Europe/Budapest)
**Status:** DRAFT — awaiting review before implementation.
**Scope:** `packages/shared` (single source of truth), `packages/api-client` (client contract), `apps/api` (server responses), `apps/admin` + `apps/web` (consumers). Extends the existing `@callback/shared` Zod-as-contract pattern and the already-planned notification system (`docs/plans/2026-10-22--15-40-00-frontend-notification-and-log-system-plan.md`).

---

## 1. Goal

Establish one written convention for every server↔client interaction, so a new endpoint is
described in the same shape as the existing `api-keys` contract:

1. **Request bodies** — always JSON, optional fields omitted (not sent as `null`/`''`).
2. **Response bodies** — always JSON; empty collections are `[]`, never `null`.
3. **Error envelope** — one shape for every failure, decided by HTTP status, never by message text.
4. **Empty / zero-result handling** — a single rule per type (`[]`, `{}`, `0`, nullable field).
5. **Server-error surfacing** — reuse the planned notification system; no new popup/window pattern.
6. **Single source of truth** — one API definition in `@callback/shared`; Zod schemas and TS types
   generated from it, consumed by both server and client.

---

## 2. What already exists (facts)

| Area                   | State                                                                                                                                            | File                                                                                                     |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| Single source of truth | Zod schema is the contract; `@callback/shared` exports schemas + TS types; api-client parses responses with them                                 | [`packages/shared/src/schemas/api-key.schema.ts`](../../packages/shared/src/schemas/api-key.schema.ts:1) |
| Client transport       | One place talks HTTP; every failure → one `ApiError`; 2xx parsed by schema, non-2xx → `ApiError`                                                 | [`packages/api-client/src/http-client.ts`](../../packages/api-client/src/http-client.ts:1)               |
| Error normalisation    | `ApiError` carries `status`, `url`, `details: readonly string[]`; helpers `isConflict/isValidationError/isNotFoundError/isNetworkError`          | [`packages/api-client/src/api-error.ts`](../../packages/api-client/src/api-error.ts:1)                   |
| Status constants       | Named `HTTP_STATUS.*` (400/401/403/404/409/422)                                                                                                  | [`packages/api-client/src/api-error.const.ts`](../../packages/api-client/src/api-error.const.ts:1)       |
| Error → text mapping   | One pure `toErrorMessage(error)` in admin; decided on `status`, never message text (plan D4)                                                     | [`apps/admin/src/lib/error-message.ts`](../../apps/admin/src/lib/error-message.ts:53)                    |
| Empty handling today   | Response fields are `null` when absent (`description`, `expiresAt`); request omits optional fields; list is a bare array, empty = nothing stored | schema + interface files above                                                                           |
| Notification system    | Planned but not built — store + toasts + log panel in `packages/notifications`; HTTP layer already has an `onEvent` hook wired in                | plan §4.4                                                                                                |

Consequence: the convention does **not** need new plumbing for errors or empty handling — it needs a
written rule set that every future endpoint follows, plus small extensions to make the current
implicit rules explicit and uniform across endpoints.

---

## 3. Decisions (D1–D9)

### D1 — Request body: JSON, optional fields omitted

- Every request is `Content-Type: application/json`.
- Optional fields are **omitted** from the object when unset (never `null`, never `''`). Zod's
  `.optional()` + `forbidNonWhitelisted` on the backend already enforce this.
- The client serialises with `JSON.stringify(body)` — no change needed in `http-client.ts`.

### D2 — Response body: JSON, always an object or array

- Every successful response is a JSON object or array (never a bare scalar at top level).
- A single resource → `{ ... }`; a collection → `[ ... ]` with the **empty case as `[]`**, never `null`.

### D3 — Error envelope: one shape, decided by status

```jsonc
{
  "error": {
    "status": 409,
    "code": "DUPLICATE_IDENTIFIER", // stable machine code; optional
    "message": "identifier already exists", // human text; may be translated server-side
  },
}
```

- The client normalises this into `ApiError` (`status`, `details: [message]`). **Status is the
  decision key**, not `code` or `message` (extends plan D4).
- `code` is optional and stable across locales; `message` is free text and must never drive UI logic.
- When the server sends no body, the client falls back to a generic message per status (existing
  `toFailureMessage` behaviour — keep it).

### D4 — Empty / zero-result handling: one rule per type

| Situation               | Rule                                                   | Example                    |
| ----------------------- | ------------------------------------------------------ | -------------------------- |
| Collection with nothing | `[]`, never `null` or omitted                          | `GET /api/api-keys` → `[]` |
| Optional scalar absent  | present as `null`, never missing                       | `expiresAt: null`          |
| Count field             | numeric `0`, never a string `"0"` or `null`            | `total: 0`                 |
| Nested object absent    | present as `{}`, never omitted (or omit the whole key) | `meta: {}`                 |

Rule of thumb: **nullable fields are explicit (`null`); optional request fields are omitted;
collections and objects are always present.** This matches the current `api-keys` contract exactly.

### D5 — Status codes to standardise on

| Code        | Meaning                            | Client reaction                           |
| ----------- | ---------------------------------- | ----------------------------------------- |
| 200         | OK (GET, PUT, DELETE)              | parse body                                |
| 201         | Created (POST that creates)        | parse created resource                    |
| 400         | Malformed JSON / bad shape         | validation mapping                        |
| 401         | No/invalid auth                    | session-expired text                      |
| 403         | Authenticated, not allowed         | forbidden text                            |
| 404         | Resource missing                   | not-found text                            |
| 409         | Conflict (duplicate)               | first detail message                      |
| 422         | Semantic validation (beyond shape) | validation mapping                        |
| 4xx generic | —                                  | first detail or status text               |
| 5xx         | Server failure                     | server-error text + surfaced to log panel |

### D6 — Content negotiation & versioning

- Always `Accept: application/json`; server always responds with `Content-Type: application/json`.
- API mounted under `/api` (already the case behind Caddy). Versioning via URL prefix is a future
  concern; document that new versions go to a new prefix (`/api/v2`) rather than breaking v1.

### D7 — Server-error surfacing: reuse the notification system, no new widget

- **Do not** build a dedicated popup window or bottom bar for server errors (this is an explicit ask).
- Surface 5xx / unexpected payloads through the already-planned `packages/notifications`:
  - HTTP-layer `onEvent` hook emits a `system` entry (`toast: false`) to the live log panel.
  - User-facing failures (409, 400, 403) emit a toast via `notify.error(...)` from the query/mutation
    callback using `toErrorMessage(error)`.
- The **log panel** (collapsed drawer, bottom-right) is the single place for server-side/runtime noise;
  toasts are for human-actionable messages. This satisfies "popup window vs bottom bar" by choosing
  the already-decided bottom-bar log panel and rejecting a separate popup.

### D8 — Single source of truth: one definition, generated twice

- The **API definition lives in `@callback/shared`** as Zod schemas (the current pattern).
- From each schema, derive two artifacts:
  - **TS types** (`export interface X`) via `z.infer<typeof schema>` re-exported from `.interface.ts`.
  - **Backend DTO validation** — the server imports the same Zod schema and validates the request with
    it (no hand-written class-validator duplication).
- One file per resource: `<resource>.schema.ts` (Zod) + `<resource>.interface.ts` (types) +
  `<resource>.const.ts` (limits/messages). The client parses responses with these schemas; the server
  validates requests with them. **No second description of the shape exists anywhere.**

### D9 — Contract drift safety

- Client parses response with the shared schema → a renamed/removed backend field throws `ApiError`
  at the edge (existing behaviour). Keep this: it is the primary drift detector.
- Add a CI check that runs both bundles' tests against a shared fixture so a server change fails the
  client build (or vice versa) before merge.

---

## 4. What else to plan (open questions for the team)

| #   | Question                                                                              | Recommended default                                                                        |
| --- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Q1  | Do we need pagination metadata (`total`, `page`) or just arrays?                      | Arrays + optional `{ total, page }` envelope only when a caller can request more.          |
| Q2  | Do errors carry a stable `code` (D3) or just `message`?                               | Include `code` for the standard set (DUPLICATE, NOT_FOUND); omit for 5xx.                  |
| Q3  | Should validation errors return field-level details (`path: message`) or one message? | Field-level array of `{ path, message }` when available; else single `message`.            |
| Q4  | How are dates serialised on the wire?                                                 | ISO 8601 with offset (already decided for `api-keys`; extend globally).                    |
| Q5  | Do we need a top-level envelope (`{ data, error }`) or bare payloads?                 | Bare payloads (matches current client); reconsider only if auth/tenant headers require it. |
| Q6  | Which status is "not found" for a collection GET — 404 or `[]`?                       | `[]` for list endpoints; 404 only for a single missing resource.                           |

---

## 5. File map (new / changed)

```text
packages/shared/src/
  schemas/api-convention.const.ts   # HTTP_STATUS re-export, error codes, empty defaults
  lib/wire-format.ts                 # toEmptyArray(), toNullable() helpers for uniform shaping
apps/api/src/
  <resource>/api-keys.controller.ts  # add: consistent error responses + [] on empty (audit all controllers)
packages/api-client/src/
  api-error.const.ts                 # add: ERROR_CODE constants, optional envelope parsing
  http-client.ts                     # parse {error} envelope into ApiError.details (extend, not replace)
apps/admin/src / apps/web/src        # consume convention; no new error widget
docs/Specs/API-Convention.md         # NEW — the written convention (living document)
```

---

## 6. Verification

1. Run existing `api-keys` e2e + unit tests — they must still pass against the new envelope parsing.
2. Add a test that a server `{error}` body with an unknown status maps to the correct fallback text.
3. Add a test that a collection endpoint returns `[]` (not `null`) when empty.
4. Confirm both client and server import the same schema from `@callback/shared` (grep for any second
   hand-written shape).
5. Lint + build all apps; confirm no new error/popup component was introduced.

---

## 7. Follow-up / deferred

- Q1 pagination metadata implementation — separate task, not in this plan.
- Auth/tenant envelope (Q5) — only if a future requirement forces it.
- OpenAPI/JSON-schema export from Zod for external docs — nice to have, defer until ≥3 endpoints exist.
