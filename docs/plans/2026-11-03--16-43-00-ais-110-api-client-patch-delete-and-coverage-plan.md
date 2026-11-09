# AIS-110 — client binding of PATCH/DELETE, registry↔service coverage gate, new-resource template

**Status:** plan for approval
**Ticket:** AIS-110 (Subtask of AIS-102) — `packages/api-client: operation-lefedettseg (findByIdentifier bekotese) + uj eroforras vegpont-sablon`
**Prerequisites:** AIS-109 (transport), AIS-108 (PATCH/DELETE convention), AIS-72 (path move) — **all delivered**
**Not in scope:** AIS-111 (generic field-error mapping), the admin edit/delete UI, `apps/api` changes

---

## 1. Correcting the ticket against the code

Your reading is right in substance, with one correction and one addition.

| Ticket item                                          | Status today                                                                                                                                       | Action                                 |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| Bind `findByIdentifier`                              | **Already done** — [`api-keys.service.ts:51`](packages/api-client/src/api-keys/api-keys.service.ts:51), path from `clientPathOf`, 200 + 404 tested | none (ticket headline is stale)        |
| `list` via `getList`                                 | **Already done** (AIS-114)                                                                                                                         | none                                   |
| Bind `apiKeys.update`                                | Missing — registry has it, service does not                                                                                                        | **Step 2**                             |
| Bind `apiKeys.remove`                                | Missing — same                                                                                                                                     | **Step 2**                             |
| Registry↔service coverage test                       | Missing                                                                                                                                            | **Step 3** (this is the real DoD item) |
| New-resource template + `API-Convention` §11 pointer | Missing; `Admin-Data-Flow.md` does not exist                                                                                                       | **Step 4**                             |

So: **the code remainder is PATCH + DELETE**, plus the coverage gate and the template. The registry holds **five** operations (`list`, `findByIdentifier`, `create`, `update`, `remove`) — see [`api-keys.contract.ts:63`](packages/shared/src/contract/api-keys/api-keys.contract.ts:63) — while [`ApiKeysService`](packages/api-client/src/api-keys/api-keys.interface.ts:30) exposes three.

Everything needed on the transport already exists: `patch`/`delete` on [`HttpClient`](packages/api-client/src/http-client.interface.ts:129), `noPayloadSchema`, `UpdateApiKeyInput` ([`api-keys.interface.ts:26`](packages/shared/src/contract/api-keys/api-keys.interface.ts:26)), and `toApiKeyDetailPath` ([`api-keys.path.ts:23`](packages/api-client/src/api-keys/api-keys.path.ts:23)).

---

## 2. Bind `PATCH` and `DELETE` in the client service

### 2.1 Interface — [`api-keys.interface.ts`](packages/api-client/src/api-keys/api-keys.interface.ts:1)

Add two members, JSDoc in the file's existing style:

```ts
update(identifier: string, input: UpdateApiKeyInput, options?: RequestOptions): Promise<ApiKey>;
remove(identifier: string, options?: RequestOptions): Promise<null>;
```

Decisions:

| Decision                                                                           | Reason                                                                                                                                                |
| ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `UpdateApiKeyInput` from `@callback/shared`, not `RequestBodyOf<'apiKeys.update'>` | Same `z.infer` of the same schema; the shared alias is the documented convention (“consumers import these aliases, never `z.infer` at the call site”) |
| `remove` returns `Promise<null>`, not `Promise<void>`                              | §4.2.2 of the convention: `200` + `data: null`, never `204`. `null` is a _value_, and the transport already parses it with `noPayloadSchema`          |
| Both keep `options?: RequestOptions`                                               | TanStack Query cancellation must pass through, like the three existing methods                                                                        |
| No body parameter on `remove`                                                      | `HttpClient.delete` has no body slot; the convention has no body-carrying delete                                                                      |

Header doc: extend the existing “read methods follow the transport convention” paragraph with the write side (`update` → payload, `remove` → `null`).

### 2.2 Implementation — [`api-keys.service.ts`](packages/api-client/src/api-keys/api-keys.service.ts:38)

```ts
update: async (identifier, input, options) =>
  client.patch(toApiKeyDetailPath(identifier), input, apiKeySchema, options),

remove: async (identifier, options) =>
  client.delete(toApiKeyDetailPath(identifier), noPayloadSchema, options),
```

- Import `noPayloadSchema` and `type UpdateApiKeyInput` from `@callback/shared`.
- **One detail path, three operations.** `API_KEYS_DETAIL_PATH` stays derived from `apiKeys.findByIdentifier`; no `API_KEYS_UPDATE_PATH`/`API_KEYS_REMOVE_PATH` constants — they would be three literals for one route. The parity is asserted in a test instead (Step 2.3), so a future registry divergence fails loudly.
- TypeScript enforces completeness: the object literal is typed `ApiKeysService`, so a missing method is a compile error — this is why the interface is edited first.

### 2.3 Tests — [`test/api-keys.service.test.ts`](packages/api-client/test/api-keys.service.test.ts:1)

New `describe('detail path parity')`:

1. `clientPathOf('apiKeys.update') === API_KEYS_DETAIL_PATH` and `clientPathOf('apiKeys.remove') === API_KEYS_DETAIL_PATH`.

New `describe('createApiKeysService — update')`:

1. `PATCH /api/api-keys/:identifier`; the body is sent **unchanged**, `updatedAt` included; the response is parsed into an `ApiKey`.
2. Explicit `null` survives: `{ description: null, expiresAt: null, updatedAt }` sends both nulls (clear semantics, §4.2.1) instead of dropping them.
3. A malformed row in a `200` → `ApiError` (unexpected payload), not a half-typed object.
4. `409 STALE_WRITE` with `details[{ path: 'updatedAt' }]` → `status 409`, `code STALE_WRITE`, `issues[0].path === 'updatedAt'`.
5. `404 NOT_FOUND` → coded `404`.
6. `422 SEMANTIC_VALIDATION_FAILED` → code surfaces unchanged.

New `describe('createApiKeysService — remove')`:

1. `DELETE /api/api-keys/:identifier`, `init.body === undefined`, no `Content-Type` header, resolves to `null`.
2. `404` → coded `404`.
3. Drift: `{ data: {}, meta }` → `ApiError` with `UNEXPECTED_PAYLOAD` (`noPayloadSchema` is `z.null()`).
4. Drift: an empty `204` body → `ApiError` (status-based), i.e. the `204` shortcut is not silently accepted.

Fixtures: add `VALID_UPDATE_INPUT` to [`test/mocks/api-key.mock.ts`](packages/api-client/test/mocks/api-key.mock.ts:1) (built on the shared `VALID_UPDATE_API_KEY_REQUEST`). No mock is created inside a spec file.

---

## 3. Registry ↔ service coverage gate

### 3.1 Files

| File                                | Contents                                                                                                                              |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `src/service-coverage.interface.ts` | `ServiceFactory`, `ServiceFactories`, `CoverageGap`, `ServiceCoverage`, `CoverageGapReason` (`'missing-service' \| 'missing-method'`) |
| `src/service-coverage.logic.ts`     | pure `toServiceNamespace(operationId)`, `toServiceMethodName(operationId)`, `findCoverageGaps(operationIds, services)`                |
| `src/service-coverage.errors.ts`    | `InvalidOperationIdError` (`operationId`, `reason`) — custom error class, no bare `Error`                                             |
| `src/service.registry.ts`           | `createServiceFactories(): ServiceFactories` → `{ apiKeys: createApiKeysService }`; one line per new resource                         |
| `test/service-coverage.test.ts`     | the gate itself                                                                                                                       |

### 3.2 Rules

- **Names derive from the `operationId`**, `<namespace>.<action>`: namespace = first segment, method = second. `apiKeys.findByIdentifier` → service `apiKeys`, method `findByIdentifier`. So a new resource needs no test edit — only one line in `service.registry.ts`.
- `findCoverageGaps` returns both directions:
  - `missing` — a registered operation whose namespace has no factory (`missing-service`) or whose service has no such function member (`missing-method`);
  - `orphan` — a function member of a service that no registered operation names (`${namespace}.${method}`).
- Only own, function-valued properties are inspected (`Object.entries` + `typeof === 'function'`).
- Pure: the caller builds the services (composition lives in `service.registry.ts`), so the logic is unit-tested with plain objects and no `fetch`.

### 3.3 Test cases

Positive — the real gate:

1. `findCoverageGaps(API_ENDPOINTS.map(e => e.operationId), buildServices())` → `{ missing: [], orphan: [] }`.

Negative — the ticket's DoD (“piros, ha egy registry-operationhoz nincs service-metodus”):

2. `['apiKeys.list', 'apiKeys.update']` against `{ apiKeys: { list() {} } }` → `missing` contains `apiKeys.update` with `missing-method`.
3. `['apiKeys.list']` against `{ apiKeys: { list() {}, remove() {} } }` → `orphan` contains `apiKeys.remove`.
4. `['unknown.list']` → `missing` with `missing-service`.
5. `['list']` / `['apiKeys.']` / `['.list']` → `InvalidOperationIdError`.
6. Cross-check the count: every registered `operationId` appears exactly once across all services (guards the orphan direction as data, not only as code).

`buildServices()` builds real services over a doubled `fetch` and a stub client — the same `setup()` shape the existing spec uses. The pure logic is internal tooling: import it from `../src/…`; do **not** widen [`src/index.ts`](packages/api-client/src/index.ts:1).

---

## 4. Template + documentation

### 4.1 New [`docs/Specs/Admin-Data-Flow.md`](docs/Specs/Admin-Data-Flow.md:1)

One section, **“New resource template”**: the per-layer file checklist, with `api-keys` named file-by-file as the reference implementation.

```text
packages/shared/src/contract/<resource>/   <resource>.schema.ts (strict request / tolerant response),
                                           <resource>.contract.ts (registry entries),
                                           <resource>.fixture.ts, <resource>.list-query.ts, <resource>.update.ts
packages/api-client/src/<resource>/        <resource>.service.ts, <resource>.interface.ts, <resource>.const.ts
apps/api/src/<resource>/                    service (AppError), controller (responses.ok + ZodBodyPipe), repository (Drizzle)
apps/admin/src/features/<use-case>/         query hook, *.logic.ts, query-key const
apps/admin/src/entities/<entity>/           mapper dto -> view model
apps/admin/src/pages/<page>/                composition + ui/
```

**Links, no duplication**: API side → `API-Convention.md` §4.2 (mutation convention) and §11; admin side → `UI-Architecture.md` §12 (new page recipe). Plus the completion checklist: the registry entry, the service method, the `service.registry.ts` line, and a green `service-coverage.test.ts`.

> AIS-123 also plans `Admin-Data-Flow.md`. This plan creates it with the template section only; AIS-123 extends the same living doc, so add a Jira comment on both tickets to prevent a duplicate file.

### 4.2 [`docs/Specs/API-Convention.md`](docs/Specs/API-Convention.md:1)

| Section                           | Change                                                                                                                                                                             |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| §11 “Recipe — adding an endpoint” | Replace the 9 duplicated steps with a pointer to `Admin-Data-Flow.md` §“New resource template” + keep only the API-side specifics (schema/registry/controller/mutation convention) |
| §12 “Enforcement today”           | New row: registry ↔ client service coverage → `packages/api-client/test/service-coverage.test.ts`                                                                                  |
| §13 “Known gaps”                  | Rewrite the first bullet: all five operations are bound (`list`, `findByIdentifier`, `create`, `update`, `remove`); keep the `ETag`/`If-Match`/bulk/idempotency non-goals          |
| header                            | bump `**Utolsó frissítés:**`                                                                                                                                                       |

`UI-Architecture.md` is **not** touched — no admin file changes, and the page recipe it already owns is the one the template links to.

---

## 5. Execution order

1. `api-keys.interface.ts` — add `update` + `remove` + doc.
2. `api-keys.service.ts` — implement both; `pnpm --filter @callback/api-client build` to prove interface completeness.
3. `test/mocks/api-key.mock.ts` — `VALID_UPDATE_INPUT`; `test/api-keys.service.test.ts` — path parity + PATCH + DELETE blocks.
4. `src/service-coverage.{interface,logic,errors}.ts` + `src/service.registry.ts`.
5. `test/service-coverage.test.ts` — positive gate + all negative cases.
6. `docs/Specs/Admin-Data-Flow.md`, then `API-Convention.md` §11/§12/§13 + dates.
7. `docs/history/2026-11-03--…-ais-110-patch-delete-and-service-coverage.md` and `docs/milestones/…-api-client-service-coverage-gate.milestone.md`.

## 6. Verification

```powershell
pnpm --filter @callback/shared test
pnpm --filter @callback/api-client test
pnpm --filter @callback/api-client lint
pnpm --filter @callback/admin test
pnpm quality
```

Manual proof of the gate: delete the `remove` member from `api-keys.service.ts` temporarily → `service-coverage.test.ts` must fail with `apiKeys.remove` in `missing`; restore it.

## 7. Risks

| Risk                                                                                      | Mitigation                                                                                                                                                                                               |
| ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `knip` sees `service.registry.ts` / `service-coverage.logic.ts` as dead code              | They are reached from test files, which knip treats as entry points; `pnpm quality` in Step 6 confirms it, and if production mode objects, the fix is an `entry` entry in `knip.json`, not a suppression |
| `update`/`remove` have no admin consumer yet                                              | Intended: the admin edit/delete UI is a later ticket. Interface members are not flagged as unused, and `apps/admin` stays untouched here                                                                 |
| Adding `remove` returns `null`, which a careless consumer may treat as “nothing happened” | Documented in the interface JSDoc and §4.2.2; the test asserts `data: {}` and `204` are contract violations                                                                                              |
| Registry divergence between the three detail operations                                   | Asserted by the path-parity test, so the single-constant decision stays safe                                                                                                                             |
| Two tickets touching `Admin-Data-Flow.md`                                                 | Comment on AIS-110 and AIS-123 that this plan creates the file with the template section only                                                                                                            |
