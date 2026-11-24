# Milestone — `AUDIT_ACTOR_PROVIDER` must be exported by `AuditModule`

**Date:** 2026-11-23 · **Ticket:** AIS-14 / AIS-178 (slice f)

## 1. Problem

The branch `AIS-14-company-admin` failed its unit gate: **1 of 1002** tests red in
`customers.module.spec.ts`, with

```text
Nest can't resolve dependencies of the CustomerActivitiesService
(CUSTOMER_ACTIVITIES_REPOSITORY, AUDIT_WRITER, ?). … the argument
"AUDIT_ACTOR_PROVIDER" at index [2] is available in the CustomersModule module.
```

`CustomersModule` is the wrong suspect: the token existed, in `AuditModule`, which
`CustomersModule` already imports. The application could not have booted with this
defect — the admin `customers` API was dead on arrival, not merely mis-tested.

## 2. Evidence

| Observation | Value |
| --- | --- |
| Failing suite / total | 1 / 76 suites, 1 / 1002 tests |
| Injection site | [`customers-activities.service.ts`](../../apps/api/src/customers/customers-activities.service.ts:66) — third constructor token |
| Export site before the fix | `audit.module.ts` → `exports: [AUDIT_WRITER]` |
| Local Node version during the earlier green measurement | `20.19.2` (real-module test **self-skips** below `24.9`) |

## 3. Root cause

Slice f introduced the rule "the activity author is a server-side decision" (`F3`):
`CustomerActivitiesService` resolves the author from `AUDIT_ACTOR_PROVIDER` — the
same seam `AuditWriter` uses — and stamps `author_type` / `author_name` /
`operator_id` / `customer_user_id` itself. `AuditModule`'s docblock still claimed
the actor provider must stay private ("nothing can append a row without an actor"),
an intent that predates its first external consumer.

The existing tests could not see this for two independent reasons:

1. the hand-built provider list in the same spec supplied `AUDIT_ACTOR_PROVIDER`
   itself, so it stayed green regardless of the module's export surface;
2. the test that compiles the **real** module is gated on `JEST_CAN_REQUIRE_ESM`
   (Node ≥ 24.9, because `@nestjs/config` is CommonJS-only), so on the maintainer's
   workstation it prints a warning and returns — the exact place where the defect
   lived was the one place that did not run.

The lesson is structural: a DI graph is only verified by a test that builds the
**real** module, so any environment where that test skips has no DI coverage at all.

## 4. Solution

| File | Change |
| --- | --- |
| [`audit.module.ts`](../../apps/api/src/audit/audit.module.ts:34) | exports `AUDIT_WRITER` **and** `AUDIT_ACTOR_PROVIDER` |
| [`audit.module.ts`](../../apps/api/src/audit/audit.module.ts:11) | new docblock: exactly two tokens exported, with the reason per token; `AUDIT_REPOSITORY` stays private because it is the append path |
| [`customers.module.ts`](../../apps/api/src/customers/customers.module.ts:4) | docblock names both tokens as the reason for importing `AuditModule` |
| [`audit.module.spec.ts`](../../apps/api/src/audit/audit.module.spec.ts:63) | real-module test asserts both exported tokens |
| [`customers.module.spec.ts`](../../apps/api/src/customers/customers.module.spec.ts:169) | corrected the stale "only export" comment; asserts the actor token too |

Design rule that follows, and that reviewers should enforce: **a read-only seam is
exported, the append path is not.** The actor provider reads the current principal;
the repository and the writer write ledger rows. Exporting the former cannot append
anything; exporting the latter would let a feature bypass the diff/transaction.

## 5. Outcome and verification

```text
pnpm --filter @callback/api test customers.module audit.module  → 5 passed
pnpm --filter @callback/api build                              → clean
Reflect.getMetadata('exports', AuditModule)                     → ['AUDIT_WRITER','AUDIT_ACTOR_PROVIDER']
compile CustomerActivitiesService with AuditModule as the only audit source → resolved
pnpm --filter @callback/api test                                → 76 suites / 1002 tests passed
```

The last two checks exist because the real-graph test skips on Node 20: the fix was
proven against the **compiled** metadata and against an actual Nest resolution, not
just by a green rerun.

## 6. Follow-ups

- The real-module DI tests skip on Node < 24.9. Either raise the CI Node floor or
  replace the gate with a CJS-friendly compile path; until then, treat the e2e
  bootstrap as the only local proof of the graph.
- A future auth story (AIS-73/74) replaces `SystemAuditActorProvider` in one line
  precisely because the token is now a first-class export.
