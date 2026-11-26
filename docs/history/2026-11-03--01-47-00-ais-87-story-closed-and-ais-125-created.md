# AIS-87 closed — the unified API contract story is Done

**Date:** 2026-11-03 01:47 (Europe/Budapest)
**Scope:** Jira only — no code change in this pass.

## What was closed

The story **AIS-87** („Egységes API szerződés + válasz-boríték") is now **Done**. Its 11
delivered subtasks (AIS-88 … AIS-98) were the contract chain: shared Zod contract → endpoint
registry → `AppError`/pipes → `ApiResponseService` + `ApiExceptionFilter` → requestId
correlation → `api-keys` migration → client unwrap → the two admin error surfaces → the
e2e/CI gate → the generated OpenAPI.

## What was moved, and why it was not "done quietly"

The two remaining subtasks were **real open work**, not stale statuses:

| Missing artefact                                    | Checked in the repo |
| --------------------------------------------------- | ------------------- |
| `scripts/openapi/` (generate/check/diff)            | absent              |
| `docs/Specs/openapi.json` (committed baseline)      | absent              |
| `openapi:generate` / `openapi:check` npm scripts    | absent              |
| a contract-check step in `.github/workflows/ci.yml` | absent              |

AIS-87's own DoD contained _„a baseline committolva van és a CI elbukik, ha elavult"_, and the
story text said _„A story csak akkor Done, ha mind a 13 subtask Done"_. Closing it as Done
without addressing that would have asserted a gate that does not exist.

So the scope was moved, not hidden:

- **AIS-125** created — „OpenAPI baseline + CI kapu és a konvenció doksi zárása (AIS-99 +
  AIS-100)", priority High, carrying the same decisions, DoD and test plan.
- **AIS-99** and **AIS-100** re-parented from AIS-87 to AIS-125 (both still `To Do`).
- The AIS-87 DoD's baseline line amended to point at AIS-125, with a **closing note** in the
  description explaining the move, the reason and the fixed order.
- The subtask table trimmed to the 11 delivered rows, and AIS-125 added under „Nem része ennek
  a storynak".

## Fixed order (dependency, not preference)

```
AIS-102 (AIS-106 → AIS-107 → AIS-108 → AIS-109 → AIS-110) → AIS-125 (AIS-99 baseline) → AIS-100 docs close
```

The baseline is generated from the registry, and AIS-102 changes that registry (new endpoints,
`PATCH`/`DELETE`, `meta.pagination`). Generating it earlier would make it stale on arrival —
which is exactly what the `openapi:check` gate is supposed to catch.

## What AIS-87 delivered (the reason it is worth closing)

1. **One truth for the contract.** Three parallel descriptions of the same data (class-validator
   DTO, hand-written interface, Zod schema) collapsed into `packages/shared/src/contract`; the
   `class-validator` DTOs were **deleted**, not duplicated. One definition → `z.infer` type,
   server validation, client parse.
2. **Errors are a machine decision.** `{ error: { code, status, message, details[], requestId,
timestamp, path } }` with a stable, language-independent `code`; `message` is never user copy,
   and an unknown code degrades to a status-based fallback so a newer server cannot break an
   older bundle.
3. **Four display tiers, not a popup.** Field (`details[].path` → RHF `setError`), page `Alert` +
   retry, app banner (401/offline/503), log panel (5xx).
4. **Every answer correlates to a server log line** via `meta.requestId` + `X-Request-Id`, while
   `GET /healthz` and the VAPI webhooks stayed byte-identical (proved by e2e).
5. **The client stopped guessing.** `ApiError` carries `code`, `requestId` and `issues[]`
   (payload-relative dot paths), and the legacy `details: string[]` stayed — no breaking change
   for callers.
6. **The contract is machine-readable and self-guarding.** The generated `/api/openapi.json` +
   Swagger UI, the dev response validator and the route-coverage test force every controller
   route to have a contract entry — no hidden endpoints.

## Follow-ups

- **AIS-125** must run **after** AIS-102/AIS-110; its baseline is worthless one commit earlier.
- **AIS-100** is largely satisfied already: `docs/Specs/API-Convention.md` carries all 13
  sections (§11 = „új végpont receptje"), and the `docs/history/` + `docs/milestones/` entries
  exist. It closes with the baseline row and the §11 pointer at the AIS-110 template.
- The AIS-87 closing comment (Hungarian) records the same summary for the humans reading Jira.
