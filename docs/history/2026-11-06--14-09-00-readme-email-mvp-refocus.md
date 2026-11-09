# README refocused on the e-mail assistant MVP

**Date:** 2026-11-06 14:09 (Europe/Budapest)
**Scope:** documentation only — no code, config or test change.

## Problem

[`README.md`](../../README.md:1) still described AIsztens as an automated **call-back**
system: the intro, the component table, "Current State" and "Next Steps" all centred on the
call queue, the call dispatcher and the VAPI voice provider. That contradicted the product
decision recorded in
[`docs/plans/2026-10-21--15-37-00-ais-64-callback-removal-plan.md`](../plans/2026-10-21--15-37-00-ais-64-callback-removal-plan.md):
the callback bounded context was deleted (AIS-64) and the voice feature is **not** part of the
MVP. The MVP is an **AI e-mail assistant for companies** (Gmail ingestion, triage, context,
drafting, approval-gated send, digests), designed in
[`docs/plans/2026-10-14-email-module-structural-design-plan.md`](../plans/2026-10-14-email-module-structural-design-plan.md).

## Changes

| Section               | What changed                                                                                                                             |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Intro                 | Rewritten: e-mail assistant for companies; external services are executors, the backend is the decision maker                            |
| `MVP scope` (new)     | Two-column in-scope / out-of-scope table; explicit statement that callback + VAPI are legacy, with the leftover files named and frozen   |
| Monorepo layout       | Added `packages/ui`, `packages/api-client` and `packages/notifications` (previously missing)                                             |
| Prerequisites         | Node `>= 24.9.0` (was `>= 20`), Docker added for the local Postgres stack                                                                |
| Scripts               | Replaced the stale table with the real ones: `typecheck`, `quality`, `db:up`/`db:down`, `qa:all`, `test:stack`                           |
| API conventions (new) | `/api` prefix, envelope + exemption registry, `packages/shared` Zod contract, `/api/openapi.json`, dev proxy, `GET /healthz`             |
| Current state         | Replaces the obsolete callback vertical slice with: e-mail module designed-but-not-implemented, plus the delivered api-keys/admin slices |
| Next steps            | E-mail module phases first, then removal of the leftover VAPI module and the unused phone helper                                         |
| Links                 | Fixed the broken `docs/01-aisztens.md` link — now points at `docs/Specs/`, `docs/plans/`, `docs/history/`, `docs/milestones/`            |

## Notes

- Nothing in the repository referenced the VAPI webhook module from the e-mail or admin slices,
  so the README could mark it as inert without a code change.
- The dead-code gate (`pnpm quality:dead-code`) and the docs gate (`pnpm quality:docs`) are
  unaffected: the docs gate only scans `docs/Specs`, and `README.md` is not part of `knip`'s
  entry set.
- The follow-up ticket for physically deleting `apps/api/src/vapi-webhooks/` and
  `packages/shared/src/contract/common/phone.helper.ts` is still open; the README records the
  intended end state.
