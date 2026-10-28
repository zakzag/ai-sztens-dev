# AIS-97 — envelope e2e branches, the contract gate and the CI e2e job

**Date:** 2026-10-29 00:58 (Europe/Budapest)
**Ticket:** AIS-97 (subtask of AIS-87)
**Predecessor:** AIS-98 — [`2026-10-29--00-30-00-ais-98-openapi-swagger-response-validator.md`](2026-10-29--00-30-00-ais-98-openapi-swagger-response-validator.md)
**Milestone:** [`docs/milestones/2026-10-29--00-58-00-envelope-contract-gate-and-ci-e2e.milestone.md`](../milestones/2026-10-29--00-58-00-envelope-contract-gate-and-ci-e2e.milestone.md)

---

## What was missing

AIS-98 shipped the generated OpenAPI document and the dev response validator, but
AIS-97's own DoD was still open:

* no e2e proof of the `500` branch (sanitised body + `requestId` + the detail only
  in the log);
* no e2e proof of the empty-collection rule (`[]`, never `null`);
* no shared matchers — each spec re-declared its own body guards;
* **no CI gate** that fails when a non-exempt route answers with a bare body;
* no contract-drift fixture (mapper ↔ shared schema);
* `.github/workflows/ci.yml` never ran `test:e2e` at all, and on Node 22 every
  `AppModule` suite self-skips anyway.

## What was added

| File | Role |
|---|---|
| [`apps/api/test/lib/envelope.matchers.ts`](../../apps/api/test/lib/envelope.matchers.ts) | `expectSuccessEnvelope`, `expectErrorEnvelope`, `expectRawBody`, `expectRequestIdHeaderEcho` — one assertion per contract rule |
| [`apps/api/test/lib/controller-audit.ts`](../../apps/api/test/lib/controller-audit.ts) | the gate: verb-aware route ↔ registry ↔ exemption audit with four violation codes |
| [`apps/api/test/lib/audit-fixtures.ts`](../../apps/api/test/lib/audit-fixtures.ts) | permanent negative fixtures (bare body, unlisted exemption) — the gate's self-proof |
| [`apps/api/test/lib/envelope-probe.ts`](../../apps/api/test/lib/envelope-probe.ts) | test-only controllers: enveloped success, empty list, thrown failure |
| [`apps/api/test/envelope.e2e-spec.ts`](../../apps/api/test/envelope.e2e-spec.ts) | the four branches, booted from `HttpModule` + probes (no DB, no `@nestjs/config`) |
| [`apps/api/test/envelope-contract.e2e-spec.ts`](../../apps/api/test/envelope-contract.e2e-spec.ts) | the gate over the real module graph, its three negative cases, and the mapper↔schema drift fixture |
| [`apps/api/src/common/http/test/support/envelope-route.ts`](../../apps/api/src/common/http/test/support/envelope-route.ts) | `toMethodRoutes()` (verb + handler + exemption per route); `toRouteTable()` now derives from it |
| [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml) | new `api-e2e` job: Postgres service, Node 24, migrations, `test:e2e` |
| `docs/Specs/API-Convention.md` | enforcement table updated, only the AIS-99 baseline left as “not built yet” |

## Decisions

1. **The branch suite does not boot `AppModule`.** `HttpModule` *is* the production
   HTTP edge (filter, request-id interceptor, `ApiResponseService`, exemptions);
   leaving out `ConfigModule`/`DatabaseModule` means the suite needs no database
   and no Node 24, so it actually runs on a developer machine and in CI. The
   `AppModule` graph stays covered by `request-id`, `health`, `app`,
   `vapi-webhooks`, `openapi` and `envelope-exemptions`.
2. **The gate reads Nest metadata, not source text** (plan key decision 5). It is
   verb-aware, because `GET /api/api-keys` and `POST /api/api-keys` are two
   contracts and a path-level check would let a documented verb excuse an
   undocumented one.
3. **Negative cases are permanent fixtures**, not a controller created and deleted
   around a manual run: the gate is only worth having if a test proves it fails.
4. **The runtime body check and the static gate are separate guarantees**:
   `ResponseAssertInterceptor` (AIS-98, dev only) proves a documented route
   fulfils its schema; the audit proves a route cannot exist undocumented.
5. **CI runs e2e on Node 24, in a dedicated job with Postgres.** On Node 22 the
   `AppModule` suites self-skip, so a green run would prove nothing. Migrations
   create the `platform`/`email` schemas themselves, so a plain `postgres:16`
   service is enough.

## Verification

```
pnpm --filter @callback/api build    → green
pnpm --filter @callback/api lint     → 0 errors (1 pre-existing style warning)
pnpm --filter @callback/api test     → 38 suites / 360 tests
pnpm --filter @callback/api test:e2e → 11 suites / 47 tests
```

Locally (Node 20.19.2) the eight `AppModule` suites still self-skip with the
documented `[app-module-gate]` warning; they execute in the new CI job. The new
`envelope.e2e-spec.ts` does **not** skip — its four branch assertions run
everywhere, and the five non-graph assertions of `envelope-contract.e2e-spec.ts`
(the three negative fixtures plus both drift checks) ran locally and passed.

## Not done here

* `docs/Specs/openapi.json` baseline + `openapi:generate` / `openapi:check` and the
  breaking-change gate → **AIS-99**.
* The CI job was written from the repo's own local runbook and cannot be executed
  from this machine; the first PR will show whether the Postgres service and the
  `db:migrate` step need an extra env var.
