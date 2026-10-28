# Milestone — envelope contract gate, e2e branches and CI enforcement

**Date:** 2026-10-29 00:58 (Europe/Budapest)
**Ticket:** AIS-97 (subtask of AIS-87), follows AIS-98
**Plan:** [`docs/plans/2026-10-26--17-21-00-unified-api-contract-and-envelope-plan.md`](../plans/2026-10-26--17-21-00-unified-api-contract-and-envelope-plan.md) §7, `D9`, §8.4

## 1. Problem / feature

The response envelope was implemented and documented, but nothing *enforced* it in
CI. A new controller could return a bare object, or a route could exist with no
contract entry, and every gate stayed green: the only regression signal was the
admin UI showing `UNEXPECTED_PAYLOAD` in production.

## 2. Evidence

* `.github/workflows/ci.yml` ran `install → build → lint → unit tests` only; no
  `test:e2e` step existed.
* Every `AppModule` e2e suite self-skips below Node 24.9 (`@nestjs/config` is CJS
  and Jest's ESM runner cannot `require()` it), and CI ran Node 22 — so even
  adding the step would have been a green no-op.
* No test asserted the `500` response body, the empty-collection rule, or a
  mapper↔schema drift.

## 3. Design rationale

| Decision | Why | Rejected alternative |
|---|---|---|
| The branch suite boots `HttpModule` + probe controllers, not `AppModule` | `HttpModule` *is* the production HTTP edge; dropping `ConfigModule`/`DatabaseModule` removes the DB and the Node 24 requirement, so the suite runs everywhere | Booting `AppModule` (needs Postgres + Node 24, i.e. skips locally) |
| The gate reads Nest metadata (`@SkipEnvelope`, path, verb), never source text | Survives a controller split/refactor; it is the same metadata the filter reads at runtime | Grepping controllers for `responses.ok()` |
| Verb-aware comparison (`GET /api/api-keys` ≠ `POST /api/api-keys`) | Two contracts per path; a path-level check would let a documented verb excuse an undocumented one | Path-only coverage (what AIS-92 already had) |
| Negative cases as permanent fixtures | A gate nobody can demonstrate failing is unfalsifiable | “Broken controller created for one run, then deleted” |
| Static gate **and** runtime validator, side by side | The gate: no route exists undocumented. The validator (AIS-98): a documented route fulfils its schema | One mechanism pretending to do both |
| CI e2e in a dedicated job on Node 24 with Postgres | A green run must actually execute the suites | Adding `test:e2e` to the Node 22 job (all `AppModule` suites skip) |

## 4. Implementation

| File | Change |
|---|---|
| `apps/api/test/lib/envelope.matchers.ts` | NEW — `expectSuccessEnvelope`, `expectErrorEnvelope`, `expectRawBody`, `expectRequestIdHeaderEcho` |
| `apps/api/test/lib/controller-audit.ts` | NEW — `auditEnvelopeContract()` with `UNREGISTERED_ENVELOPED_ROUTE`, `EXEMPT_ROUTE_NOT_LISTED`, `ORPHANED_EXEMPTION`, `UNKNOWN_HTTP_METHOD` |
| `apps/api/test/lib/audit-fixtures.ts` | NEW — `BareBodyProbeController`, `UnlistedExemptController` (negative fixtures) |
| `apps/api/test/lib/envelope-probe.ts` | NEW — probe module: enveloped success, empty list, thrown failure |
| `apps/api/test/envelope.e2e-spec.ts` | NEW — success, `[]`, sanitised `500` + log proof, `404` envelope |
| `apps/api/test/envelope-contract.e2e-spec.ts` | NEW — gate over the real module graph, three negative cases, mapper↔schema drift fixture |
| `apps/api/src/common/http/test/support/envelope-route.ts` | `toMethodRoutes()` added (verb + handler + exemption); `toRouteTable()` derives from it |
| `.github/workflows/ci.yml` | NEW `api-e2e` job: `postgres:16` service, Node 24, `db:migrate`, `test:e2e` |
| `docs/Specs/API-Convention.md` | enforcement table updated (only the AIS-99 baseline remains unbuilt) |

## 5. Outcome and how to verify

```
pnpm --filter @callback/api test      # 38 suites / 360 tests
pnpm --filter @callback/api test:e2e  # 11 suites / 47 tests  (8 AppModule suites skip on Node < 24.9)
pnpm --filter @callback/api lint      # 0 errors
pnpm --filter @callback/api build     # green
```

Prove the gate bites — temporarily point a non-exempt controller at a new path:

```bash
pnpm --filter @callback/api test:e2e -- envelope-contract
# expect: UNREGISTERED_ENVELOPED_ROUTE for the new route
```

In CI the `api-e2e` job runs the same command on Node 24 with a real Postgres, so
the `AppModule` suites execute instead of skipping.

## 6. Follow-ups

* **AIS-99** — committed `docs/Specs/openapi.json`, `openapi:generate` /
  `openapi:check`, breaking-change gate (`contract-change` label escape hatch).
* The `api-e2e` job is written from the repo's runbook and has not been executed
  from a developer machine; the first PR validates the service/migration env.
* VAPI/e2e suites still need `VAPI_WEBHOOK_SECRET` semantics confirmed in CI.
