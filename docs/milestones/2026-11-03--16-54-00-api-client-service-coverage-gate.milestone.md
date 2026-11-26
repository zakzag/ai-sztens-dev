# Milestone — registry ⇄ client service coverage gate (AIS-110)

**Date:** 2026-11-03
**Ticket:** AIS-110 · **Plan:** [`docs/plans/2026-11-03--16-43-00-ais-110-api-client-patch-delete-and-coverage-plan.md`](../plans/2026-11-03--16-43-00-ais-110-api-client-patch-delete-and-coverage-plan.md)

## Problem / feature

The shared endpoint registry is the single description of the HTTP surface, but nothing
tied it to the client services. By the time AIS-110 was picked up the registry published
**five** operations while `ApiKeysService` implemented **three**: `apiKeys.update` (PATCH)
and `apiKeys.remove` (DELETE), both added to the registry and the API by AIS-108, had no
client method. The drift was invisible — no test, no type, no runtime symptom.

## Evidence

| Signal                                      | Value                                                        |
| ------------------------------------------- | ------------------------------------------------------------ |
| `API_ENDPOINTS` operations                  | 5 (`list`, `findByIdentifier`, `create`, `update`, `remove`) |
| `ApiKeysService` methods before             | 3 (`list`, `findByIdentifier`, `create`)                     |
| Ticket headline (“bind `findByIdentifier`”) | already delivered by AIS-109 — the ticket text was stale     |
| `API-Convention.md` §13 before              | still claimed “`ApiKeysService` exposes `list`/`create`”     |

## Root cause / design rationale

Each layer was verified against its own neighbour, but nobody verified the _pair_ registry ↔
service. Three alternatives were considered:

1. **Type-level check** (`ServiceFactories` keys constrained to registry namespaces) — catches a
   missing service, but not a missing _method_, and produces an unreadable compile error.
2. **Mock-based test** — a wrong mock would pass, so the gate would prove nothing.
3. **Chosen:** build the real services over a doubled `fetch` and compare their method surface
   with `API_ENDPOINTS` at runtime, in **both** directions (`missing` and `orphan`).

Method names are **derived** from the `operationId` (`apiKeys.update` → `update`), so the gate
needs no per-resource test edit; one line in `service.registry.ts` is the only extension point.

## Solution / implementation

| File                                                                   | Change                                                                                                        |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `packages/api-client/src/api-keys/api-keys.interface.ts`               | added `update` / `remove` with read-vs-write transport notes                                                  |
| `packages/api-client/src/api-keys/api-keys.service.ts`                 | `client.patch(..., apiKeySchema)`, `client.delete(..., noPayloadSchema)` on the shared detail path            |
| `packages/api-client/src/service-coverage.{interface,errors,logic}.ts` | gate types, `InvalidOperationIdError`, pure `toServiceNamespace` / `toServiceMethodName` / `findCoverageGaps` |
| `packages/api-client/src/service.registry.ts`                          | `createServiceFactories()` — the single composition point                                                     |
| `packages/api-client/test/service-coverage.test.ts`                    | real gate + negative fixtures (missing method, missing service, orphan, malformed id)                         |
| `packages/api-client/test/api-keys.service.test.ts`                    | path parity + 7 PATCH / 5 DELETE cases                                                                        |
| `docs/Specs/Admin-Data-Flow.md`                                        | new living spec holding the “New resource template”                                                           |
| `docs/Specs/API-Convention.md`                                         | §9 binding + gate, §11 now points at the template, §12 gate row, §13 corrected                                |

Deliberate non-goals: `ETag`/`If-Match`, bulk mutations, idempotency keys, and any admin
edit/delete UI (the service methods have no consumer yet).

## Outcome and how to verify

`ApiKeysService` now covers every registered operation, and a new registry entry without a
service method fails the suite.

```powershell
pnpm --filter @callback/api-client build
pnpm --filter @callback/api-client test
pnpm quality
```

Manual proof of the red branch: remove `apiKeys` from `createServiceFactories()` and run
`packages/api-client/test/service-coverage.test.ts` — two cases fail with `missing-service`,
naming all five operations. Current state: 9 suites / 198 tests green, `pnpm quality` clean
(layers, knip, tokens, field-errors).

## Follow-ups

- The admin edit/delete UI that consumes `update`/`remove` is a separate ticket.
- `docs/Specs/Admin-Data-Flow.md` was created with the template section only; AIS-123 extends
  the same living document (forms/validation) — coordinate so the file is not duplicated.
- The coverage gate lives in `packages/api-client`; if a second consumer package ever appears,
  move `service.registry.ts` next to that consumer's composition root.
