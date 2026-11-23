# AIS-14 — `AUDIT_ACTOR_PROVIDER` is now exported by `AuditModule`

**Date:** 2026-11-23
**Ticket:** AIS-14 (story) / AIS-178 (slice f)
**Related:** [`close-out plan`](../plans/2026-11-23--21-20-00-ais-14-closeout-plan.md:1),
[`Jira status sync`](2026-11-23--21-11-00-ais-14-jira-status-sync.md:1)
**Trigger:** `pnpm test` failed with **1 of 1002** tests red on the branch HEAD.

---

## 1. Symptom

```text
FAIL customers/customers.module.spec.ts
  ● CustomersModule › resolves the whole feature from the real module

  Nest can't resolve dependencies of the CustomerActivitiesService
  (CUSTOMER_ACTIVITIES_REPOSITORY, AUDIT_WRITER, ?). Please make sure that the
  argument "AUDIT_ACTOR_PROVIDER" at index [2] is available in the CustomersModule
  module.

Test Suites: 1 failed, 75 passed, 76 total
Tests:       1 failed, 1001 passed, 1002 total
```

The message points at `CustomersModule`, which is misleading: the token *is*
provided — by `AuditModule` — and that module simply did not export it.

## 2. Root cause

Slice f (`F3`) made the activity author come from `AUDIT_ACTOR_PROVIDER`, the same
seam the ledger writer uses, instead of from the request body. `CustomerActivitiesService`
therefore injects three tokens, and `CustomersModule` already imports `AuditModule`
to satisfy the first two.

`AuditModule` exported **only** `AUDIT_WRITER`, and its docblock said so on purpose:
"the repository *and the actor provider* stay private". That intent no longer
matched a real consumer, and nothing failed loudly at the time, for two reasons:

1. the first test in `customers.module.spec.ts` hand-builds the provider list and
   supplied `AUDIT_ACTOR_PROVIDER` itself (line 116), so it stayed green;
2. the second test compiles the **real** module, but self-skips on Node < 24.9
   (`JEST_CAN_REQUIRE_ESM`). The 21:11 measurement on this machine ran Node
   `20.19.2`, so that skip hid the defect locally; it surfaced only when the gate
   ran on a runtime that can load the real graph.

Bootstrap would have failed the same way in any environment — this was never a
test-only problem; the API would not have started.

## 3. Fix

| File | Change |
| --- | --- |
| [`audit.module.ts`](../../apps/api/src/audit/audit.module.ts:34) | `exports: [AUDIT_WRITER, AUDIT_ACTOR_PROVIDER]` |
| [`audit.module.ts`](../../apps/api/src/audit/audit.module.ts:11) | docblock rewritten: exactly two tokens are exported, and the reason is stated; `AUDIT_REPOSITORY` stays private because it is the append path |
| [`customers.module.ts`](../../apps/api/src/customers/customers.module.ts:4) | docblock now names both tokens as the reason for importing `AuditModule` |
| [`audit.module.spec.ts`](../../apps/api/src/audit/audit.module.spec.ts:63) | the real-module test asserts **both** exported tokens; the test name no longer says "three providers" while checking one |
| [`customers.module.spec.ts`](../../apps/api/src/customers/customers.module.spec.ts:169) | the stale "the writer is the module's only export" comment is corrected and the actor token is asserted |

No production behaviour changed: the actor provider was already a provider of
`AuditModule`; it is now merely reachable from an importing module. Appending a
ledger row still requires `AUDIT_WRITER`, which still requires the caller's
transaction handle.

## 4. Verification

```text
pnpm --filter @callback/api test customers.module audit.module   → 5 passed (2 suites)
pnpm --filter @callback/api build                               → clean
node -e "…Reflect.getMetadata('exports', AuditModule)…"          → ['AUDIT_WRITER', 'AUDIT_ACTOR_PROVIDER']
node di-check.tmp.cjs  (throwaway, deleted)                      → resolved CustomerActivitiesService: true
pnpm --filter @callback/api test                                → 76 suites / 1002 tests passed
```

Because the real-graph test self-skips on this machine's Node, the DI resolution
was proven twice without it: once from the **compiled** module metadata, and once
by compiling `CustomerActivitiesService` with `AuditModule` as its only audit
source — the exact resolution that had failed.

## 5. Left as-is

- The `JEST_CAN_REQUIRE_ESM` gate stays. Raising the Node floor to 24.9 is a CI
  decision, not part of AIS-14; the e2e suites and `pnpm start` cover the graph on
  every runtime. See the milestone for why this cost a red gate.
- `docs/milestones/2026-11-23--21-25-00-audit-actor-provider-di-export.milestone.md`
  records the decision-grade version of this story.
