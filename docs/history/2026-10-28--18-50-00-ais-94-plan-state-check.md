# 2026-10-28 18:50 — AIS-94 plan and state check (no code change)

## What was asked

Produce an implementation plan for Jira subtask AIS-94 ("`packages/api-client`: envelope
unwrapping in the transport + `ApiError` enrichment with `code`, `requestId`, `issues` while
keeping `details: string[]`").

## What was found

The core behaviour is **already implemented** and was delivered together with AIS-87 on
2026-10-27 (see `2026-10-27--17-01-00-unified-api-envelope-ais-87.md`):

| Delivered | Where |
|---|---|
| Success envelope unwrap inside the transport | `packages/api-client/src/http-client.ts` (`parsePayload`) |
| Tolerant non-JSON `502` path | same file (`readBody`), covered in `test/http-client.test.ts` |
| `ApiError` with `code`, `requestId`, `issues`, `details` | `packages/api-client/src/api-error.ts` |
| Path from the shared endpoint registry | `packages/api-client/src/api-keys/api-keys.const.ts` |

Five gaps against the ticket remain, one of them functional:

| # | Gap | Type |
|---|---|---|
| G1 | No pure `envelope.logic.ts` + `envelope.logic.test.ts`; unwrap is private inside the transport | structure |
| G2 | Schema drift fills `details` but not `issues` — `toPayloadError()` drops field paths | defect (DoD unmet) |
| G3 | `api-error.const.ts` re-exports `HTTP_STATUS` but not `API_ERROR_CODE` | consistency |
| G4 | `api-error.ts` (`parseErrorBody`, guards) has no dedicated spec | coverage |
| G5 | `apps/admin/src/test/mocks/api-error.mock.ts` cannot express `issues` | test ergonomics |

## Plan

`docs/plans/2026-10-28--18-50-00-ais-94-api-client-envelope-unwrap-remaining-plan.md`
— 8 steps: pure module + interface, transport rewiring with `issues` on drift, constant
re-export, two new spec files plus one extended transport test, admin mock parity,
`docs/Specs/API-Convention.md` refresh, then Jira evidence + transition.

## Verification

None executed: this session produced a plan only. The green-build claims of the ticket are
pending `pnpm --filter @callback/api-client test|build`, `pnpm --filter @callback/admin test`
and `pnpm lint` and stay as step 11 of the todo list.
