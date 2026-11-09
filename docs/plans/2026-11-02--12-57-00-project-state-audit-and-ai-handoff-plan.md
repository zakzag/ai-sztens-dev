# Project state audit + AI handoff — AIsztens monorepo

**Date:** 2026-11-02 12:57 (Europe/Budapest)
**Audience:** the next human or AI contributor who has to continue the work.
**Method:** every claim below was verified against the working tree on 2026-11-02, not against ticket text.
Jira was read in full (`AIS-1` … `AIS-123`); `docs/Specs/*` and `docs/plans/*` were read; the code was inventoried
(`apps/api/src`, `apps/admin/src`, `apps/web/src`, `packages/*/src`, `.github/workflows`, `package.json` files,
`apps/api/drizzle`).

> **How to use this document.** Section 1 is the ground truth. Section 2 is closed work — do not redo it.
> Section 3 is the Jira hygiene list. Section 4 is the backlog **in dependency order, with the next concrete
> action per ticket**. Section 5 lists documentation defects that will actively mislead you if you trust the
> specs. Section 6 is the product-scope gap. Section 7 is the mandatory workflow and Section 8 the baseline
> commands.

> **Delta — re-verified 2026-11-02 19:40 (read §1 with this correction).** Sections 1, 3 and 4 were true at
> 12:57 and went stale the same day; three of the four open AIS-105 subtasks landed afterwards:
>
> | Ticket  | Actually landed after this audit                                                                                                                                                                                                                           | Evidence                                           |
> | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
> | AIS-119 | `apps/admin/src/features/api/use-list-params.{ts,const,interface,logic}.ts` + logic/hook tests. **Not consumed by any page yet** — `useListParams` appears only in its own tests, because `useApiList` (AIS-114) and server paging (AIS-107) do not exist. | commits `9cc1793`, `bbe9c7a`; Jira In Review       |
> | AIS-120 | MSW v2 harness: `test/mocks/handlers/*`, `server.ts`, `render-with-providers.tsx`, `request-recorder.ts`.                                                                                                                                                  | commit `47c1771`; Jira Done                        |
> | AIS-122 | `scripts/quality/{palette,field-error}-gate*`, dependency-cruiser + knip, `ci.yml` `quality-gates` job, `UI-Architecture.md` §9. All four gates green locally. **Jira still says To Do → set to In Review.**                                               | commits `9034f84`, `9d4ead6`, `cf35504`, `c2956bd` |
> | AIS-124 | pnpm lockfile regeneration + `light-my-request` pin.                                                                                                                                                                                                       | commit `7e55537`; Jira Done                        |
>
> Still true: `docs/Specs/openapi.json` is missing (AIS-99 open), there is **no** `pnpm typecheck` script,
> `docs/Specs/Functional-Specification.md` is still an empty template, `Local-Development.md` still claims
> `PASS: 29` while `Database-Local.md` says 23, and `apps/web` has no unit tests.
> Remaining AIS-105 work: **AIS-123** (docs) plus wiring AIS-119 into a page, which needs AIS-107 and AIS-114.

---

## 1. Verified snapshot (2026-11-02)

### 1.1 What the code actually contains

| Area                      | Reality in the working tree                                                                                                                                                                                                                                                                               |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/api` modules        | `health`, `api-keys`, `vapi-webhooks`, `common/http`, `common/openapi`, `db`, `config`. **No** auth, **no** email engine, **no** companies/CRM domain, **no** queue/worker, **no** notifications.                                                                                                         |
| API endpoints             | `GET /api/api-keys`, `GET /api/api-keys/:identifier`, `POST /api/api-keys`, `GET /healthz`, `GET /api`, `GET /api/openapi.json`, `GET /api/docs` (non-prod), 2 × `POST /api/vapi/webhooks/*`.                                                                                                             |
| HTTP verbs on resource    | **GET + POST only.** No `PATCH`, no `DELETE` anywhere in `apps/api`. Registry (`packages/shared/src/contract/endpoint.registry.ts`) holds **3** operations, all `api-keys`.                                                                                                                               |
| Pagination                | **None on the server.** `api-keys` `list()` returns everything; `listQuerySchema` / `paginatedSchema` / `ApiResult` exist in `@callback/shared` but are **not used by any route**.                                                                                                                        |
| Auth                      | **None.** `api-keys` routes are unauthenticated and return the plaintext token value; the admin SPA logs in with any non-empty password via `apps/admin/src/auth/AuthContext.tsx` (`sessionStorage`).                                                                                                     |
| DB                        | 3 Drizzle migrations (`0000`, `0001` drop callback, `0002` `platform.api_keys`). Schemas: `platform`, `email`. `email` schema is **empty** — no application code uses it.                                                                                                                                 |
| `packages/shared`         | `contract/` (envelope, error envelope, error-code catalogue, HTTP_STATUS, endpoint registry, list-query + paginated + `ApiResult`, `api-keys` schemas/fixture), `lib/build-info.ts`.                                                                                                                      |
| `packages/api-client`     | `HttpClient` interface exposes **`get` + `post` only**; `envelope.logic.ts`, `api-error.ts`, `endpoint-path.ts`, one service (`api-keys`).                                                                                                                                                                |
| `packages/ui`             | `Button`, `Input`, `Textarea`, `Card`, `Table`(+5 parts), `Badge`, `Alert`, `Banner`, tokens in `theme.css`. **No** DataTable, Pagination, Skeleton, EmptyState, Dialog, Drawer, Tooltip, Toast, LogDrawer.                                                                                               |
| `packages/notifications`  | **Does not exist** (AIS-79…AIS-86 not started).                                                                                                                                                                                                                                                           |
| `packages/*` on disk      | only `api-client`, `shared`, `ui`.                                                                                                                                                                                                                                                                        |
| `apps/admin/src`          | `app/` (router registry, layout, nav, providers, session hook, error boundary), `pages/api-keys`, `pages/LoginPage`, `pages/PlaceholderPage`, `features/api-keys`, `features/error-surface`, `entities/api-key`, `lib/*`, `services/*`, `test/mocks/*`. **No `features/api/`** → AIS-119 not implemented. |
| `apps/web/src`            | only `App.tsx`, `main.tsx`, `pages/HomePage.tsx`, `pages/LegalPage.tsx`. **No forms, no API calls, no tests.**                                                                                                                                                                                            |
| Root scripts              | `pnpm test` chains 5 suites (shared → api-client → ui → admin → api); `pnpm sonar*`; `pnpm db:up/down`. **No `typecheck` script, no husky/lefthook/lint-staged.**                                                                                                                                         |
| CI (`ci.yml`)             | `build-test` (pnpm install → build → `pnpm -r lint` → `pnpm test`, Node **24**) + `api-e2e` (Postgres service, envelope/OpenAPI gates). No palette check, no boundaries lint, no knip, no openapi drift gate.                                                                                             |
| `docs/Specs/openapi.json` | **Does not exist** (AIS-99 not done).                                                                                                                                                                                                                                                                     |
| Git hooks                 | none. Plan [`2026-10-27--11-41-38-git-hooks-quality-gate-plan.md`](2026-10-27--11-41-38-git-hooks-quality-gate-plan.md:1) exists, **never implemented**, and has **no Jira ticket**.                                                                                                                      |

### 1.2 Test / quality state

- Unit matrix is green in CI and now runs **all five** suites (AIS-121, Node 24 requirement is load-bearing: the
  API DI-graph test self-skips below Node 24.9).
- Admin suite: 20 test files / 173 tests as of AIS-118 (`docs/plans/2026-10-30--18-30-00-ais-105-subtask-summary-plan.md`).
- `apps/web` has **no unit tests** (`docs/Specs/SonarQube.md` §7), therefore no coverage for the public site.
- `pnpm format:check` was historically broken repo-wide; only your own touched files must be `prettier --write`.

---

## 2. Done — verified, do not redo

| Ticket                               | Delivered artefact (evidence)                                                                                                         |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| AIS-88                               | Envelope + error-envelope + `API_ERROR_CODE` + `HTTP_STATUS` factories in `packages/shared/src/contract`.                             |
| AIS-89                               | `ApiEndpointContract` + `API_KEYS_ENDPOINTS` registry.                                                                                |
| AIS-90                               | `AppError` hierarchy, `ZodBodyPipe` / `ZodQueryPipe`, field-level `details[]`.                                                        |
| AIS-91                               | `ApiResponseService.ok/fail`, `ApiExceptionFilter` as `APP_FILTER` with 5xx sanitisation.                                             |
| AIS-92                               | `@ReqCtx()`, `X-Request-Id` correlation, `@SkipEnvelope()` + `ENVELOPE_EXEMPTIONS` (exact two-way agreement tests).                   |
| AIS-93                               | `api-keys` migrated to the envelope; `class-validator` / global `ValidationPipe` removed.                                             |
| AIS-94                               | Client envelope unwrap in `packages/api-client/src/envelope.logic.ts`; `ApiError` carries `code`, `requestId`, `issues[]`, `details`. |
| AIS-95                               | `toFieldErrors` code-first field mapping (`features/api-keys/api-keys.logic.ts`).                                                     |
| AIS-96                               | `toErrorSurface` + `PageErrorState` + `AppErrorBanner` + `useOnlineStatus` + query-error store.                                       |
| AIS-97                               | e2e contract gates (`envelope`, `request-id`, `envelope-exemptions`, `envelope-contract`, `openapi`) wired into `ci.yml`.             |
| AIS-98                               | Generated `/api/openapi.json`, Swagger UI at `/api/docs` (non-prod), dev `ResponseAssertInterceptor`.                                 |
| AIS-106                              | `listQuerySchema`, `createListQuerySchema`, `toListQueryParams`, `mergeListQuery`, `paginatedSchema`, `ApiResult`.                    |
| AIS-118                              | `apps/admin/src/app/` layer: route registry, layout, nav, providers, session hook, `AppErrorBoundary`.                                |
| AIS-121                              | CI runs the full unit matrix on PRs (root `pnpm test`, Node 24).                                                                      |
| AIS-39/40/41/56/57/58/59/60/61/62/63 | `platform.api_keys` table, backend endpoints, admin api-keys page, DatabaseModule, UI primitives, hooks, `UI-Architecture.md`.        |
| AIS-64 (+65…69)                      | Callback feature removed end-to-end (API, admin, web, shared schemas, DB table/enum/schema).                                          |
| AIS-2/10/11/23/35/42/78              | Deploy script, GitHub Actions, smoke suite, Postgres schemas/grants, dev how-to, local SonarQube pipeline.                            |

---

## 3. Jira ⇄ code drift (cheap wins, do these first)

| Ticket          | Jira says                             | Reality                                                                                           | Action                                                            |
| --------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| AIS-100         | To Do                                 | [`docs/Specs/API-Convention.md`](../Specs/API-Convention.md:1) is complete and current.           | Close as Done; add the "openapi baseline" gap to AIS-99.          |
| AIS-78          | In Review                             | `pnpm sonar*`, `scripts/sonar/*`, [`docs/Specs/SonarQube.md`](../Specs/SonarQube.md:1) all exist. | Close as Done.                                                    |
| AIS-87          | In Progress                           | Only AIS-99 and AIS-100 remain under it.                                                          | Close after AIS-99.                                               |
| AIS-29          | In Review                             | `platform.api_keys` + migration runner exist; migration-in-deploy is AIS-44…46.                   | Keep In Review; gate it on AIS-46.                                |
| AIS-12          | In Review                             | Email **functional spec** only; no `apps/api/src/email` module.                                   | Keep; it is a spec ticket, do not confuse it with implementation. |
| AIS-31/32/33/38 | "Backlog" but statusCategory **Done** | Workflow misconfiguration — these read as unfinished in reports.                                  | Fix the workflow/filters, or move them to a Done-category status. |
| AIS-105         | In Progress (6 subtasks)              | 2 done (118, 121), 4 open (119, 120, 122, 123).                                                   | See Wave A + Wave B below.                                        |

Also missing from Jira entirely: the **git-hooks / lefthook quality gate** (plan exists since 2026-10-27) and the
repo-level `typecheck` script it depends on.

---

## 4. Backlog in dependency order — with the next action per ticket

### Wave A — finish AIS-105 (admin foundation), start here

| #   | Ticket                | Next concrete action                                                                                                                                                                                                                                                                              | Done when                                                                                                                                       |
| --- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | **AIS-119**           | Implement `apps/admin/src/features/api/` per [`2026-10-31--01-40-00-ais-119-list-params-plan.md`](2026-10-31--01-40-00-ais-119-list-params-plan.md:1): `use-list-params.{interface,const,logic}.ts`, `use-list-params.ts`, `logic.test.ts`, `test.tsx`. **Plan already exists — do not re-plan.** | `pnpm --filter @callback/admin test` + `lint` green; `?limit=999` → 20, `?page=abc` → 1, defaults never written, `resetParams` empties the URL. |
| A2  | **AIS-122**           | Layer lint (`eslint-plugin-boundaries` or `dependency-cruiser`), `knip`, palette check (`rg` rule from `UI-Architecture.md` §3.3) and the "no `error.code ===` in components" rule as CI steps. Needs a `pnpm typecheck` aggregate script (also required by the git-hooks plan).                  | The four gates fail a deliberately bad PR and pass `main`.                                                                                      |
| A3  | git-hooks (no ticket) | Implement [`2026-10-27--11-41-38-git-hooks-quality-gate-plan.md`](2026-10-27--11-41-38-git-hooks-quality-gate-plan.md:1) with **lefthook**; create a ticket for it first if the board must reflect the work.                                                                                      | pre-commit (prettier/eslint/tsc/env-guard), commit-msg (conventional commit), pre-push (`lint`+`typecheck`+`test`).                             |

> **Do not** start AIS-123 (docs) yet — it describes the _implemented_ state and must come after Waves A–D.
> **Do not** start AIS-120 (MSW) yet — it needs AIS-109 and AIS-114.

### Wave B — AIS-102 (data flow: list/pagination + full transport)

Strict order, each unblocks the next:

| #   | Ticket      | Next concrete action                                                                                                                                                                                                           | Done when                                                                                                     |
| --- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| B1  | **AIS-107** | First real `ZodQueryPipe` usage: `@Query(new ZodQueryPipe(listQuerySchema))` on `apiKeys.list`; rename repo `findAll` → `findPage` (breaking), return rows + `total`; emit `meta.pagination`.                                  | Response carries `meta.pagination`; `?sort=bogus` → `400`; e2e asserts `total`/`totalPages`.                  |
| B2  | **AIS-108** | `PATCH /api/api-keys/:identifier` and `DELETE /api/api-keys/:identifier`; add `STALE_WRITE` (409) and `SEMANTIC_VALIDATION_FAILED` (422) to `error-code.const.ts` + `API_ERROR_CODE_STATUS`; register the ops in the registry. | Envelope + openapi + client + tests for both verbs; new codes documented in `API-Convention.md` §3.           |
| B3  | **AIS-109** | `HttpClient` gains `put`/`patch`/`delete`; add the query-builder (`toListQueryParams` usage) and parametric typing of request bodies.                                                                                          | `http-client.interface.ts` covers all verbs; `packages/api-client` tests for each, including error envelopes. |
| B4  | **AIS-110** | Wire `findByIdentifier` into the admin service layer + add a "new resource" endpoint template doc/test asserting every registry operation has a client method.                                                                 | A test fails when a registry entry has no client method.                                                      |
| B5  | **AIS-114** | `useApiList` / `useApiDetail` / `useApiMutation` in `apps/admin/src/features/api/` with one uniform return shape (loading/empty/error/success + `errorSurface`).                                                               | Hooks tested success/error/loading; `api-keys` page still green.                                              |
| B6  | **AIS-120** | MSW v2 harness: `apps/admin/src/test/mocks/handlers/*`, `onUnhandledRequest: 'error'`, fixtures from `@callback/shared`, `renderWithProviders` helper.                                                                         | No admin test touches real `fetch`; a service-signature change no longer breaks tests.                        |
| B7  | **AIS-111** | Generalise `toFieldErrors(error, fields[])` into `features/api/` and add the single error-code → copy table.                                                                                                                   | `api-keys.logic.ts` consumed from the generic version; tests for every code path.                             |

### Wave C — AIS-103 (forms)

| #   | Ticket      | Next action                                                                                                                                                          |
| --- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C1  | **AIS-112** | Shared format schemas (email, E.164 phone, Hungarian tax number, IBAN, postal code, date) + Hungarian zod messages in `packages/shared/src/contract/formats/`.       |
| C2  | **AIS-113** | `packages/ui` form primitives: `FormField`, `FormActions`, `Select`, `Checkbox`, `Switch`, `RadioGroup`, `Combobox`, `DatePicker` — tokens only, CVA variants, a11y. |
| C3  | **AIS-115** | `useAppForm` in `apps/admin/src/features/` — validation + field-error + submit/toast convention in one place (depends on AIS-111 and, for toasts, on Wave G1).       |

### Wave D — AIS-104 (display + overlay primitives)

| #   | Ticket      | Next action                                                                                                                                                                              |
| --- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | **AIS-116** | `DataTable`, `Pagination`, `EmptyState`, `Skeleton`, `DescriptionList`, `StatusBadge` in `packages/ui`. `Pagination` must consume the `ApiResult.meta.pagination` shape.                 |
| D2  | **AIS-117** | `Dialog`, `ConfirmDialog`, `Drawer`, `Tooltip`, `DropdownMenu` on Radix behaviour — this is the **first new UI dependency**, so record it in `UI-Architecture.md` §7 in the same change. |

### Wave E — AIS-70 (security: audience split + auth). Highest risk in the repo

| #   | Ticket     | Next action                                                                                                                                                   |
| --- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| E1  | **AIS-71** | `@Audience()` decorator + fail-closed `AudienceGuard` registered as `APP_GUARD`; a route without an audience must be a boot/test failure.                     |
| E2  | **AIS-72** | Move `/api/api-keys` → `/api/admin/api-keys`: registry entry (one place), client const, e2e, and the two doc spots called out in `Local-Development.md` §6.7. |
| E3  | **AIS-73** | `platform.admin_users`, httpOnly cookie session, `AdminSessionGuard` + `RolesGuard`.                                                                          |
| E4  | **AIS-74** | Admin SPA cookie session (login/logout/me); delete `auth/session-token.ts` + `sessionStorage` usage; `useRequireSession` is the only reader.                  |
| E5  | **AIS-75** | `api_key` → `api_key_hash` migration + show-once response; remove the token from the list payload (`api-key.mapper.ts` already drops it client-side).         |
| E6  | **AIS-76** | `/api/public/v1/*` namespace + `X-API-Key` guard + rate limit.                                                                                                |

> Until E1–E5 land, **do not expose the API publicly**: `GET /api/api-keys` returns live provider tokens unauthenticated.

### Wave F — DB operations (AIS-43 … AIS-55)

Current state: migrations are **manual** (`pnpm --filter @callback/api db:migrate` from a laptop); nothing runs them
in deploy, so a deploy can ship code against an un-migrated schema. There are **no backups**.

| #   | Ticket        | Next action                                                                                                                                                                                                                                           |
| --- | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F1  | **AIS-43**    | Advisory-lock + `lock_timeout` / `statement_timeout` in `apps/api/src/migrate.ts`.                                                                                                                                                                    |
| F2  | **AIS-44**    | Bake `drizzle/` + `dist/migrate.js` into the API image (`infra/app/Dockerfile`).                                                                                                                                                                      |
| F3  | **AIS-45**    | One-shot `migrate` service in `infra/docker-compose.yml` (`depends_on: postgres healthy`, `restart: "no"`).                                                                                                                                           |
| F4  | **AIS-46**    | Hook the migrate step into `.github/workflows/deploy.yml` and `deploy/deploy.sh` **before** the API recreate.                                                                                                                                         |
| F5  | **AIS-47**    | CI: schema-drift (`db:check`) + destructive-DDL lint in `ci.yml`.                                                                                                                                                                                     |
| F6  | **AIS-48**    | DB checks in the smoke suite (`scripts/test/lib/20-cross-service.sh`).                                                                                                                                                                                |
| F7  | **AIS-49…55** | Pre-migration snapshot, `scripts/db/backup.sh` (encryption + DO Spaces + retention), `restore.sh`, `restore-drill.sh` (monthly), expand/contract rollback policy, RPO/RTO in the runbook, and the new `docs/Specs/Database-Migrations-and-Backup.md`. |

### Wave G — product features (nothing of the business flow exists today)

| #   | Area                                             | Plan to follow                                                                                                                                                                                                                          | State                                                                               |
| --- | ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| G1  | Notifications + live log (AIS-79 → AIS-86)       | [`2026-10-22--15-40-00-frontend-notification-and-log-system-plan.md`](2026-10-22--15-40-00-frontend-notification-and-log-system-plan.md:1)                                                                                              | not started (`packages/notifications` absent). Needed by AIS-115 (toast on submit). |
| G2  | Email engine (AIS-12/13 follow-ups)              | [`2026-10-14-email-module-structural-design-plan.md`](2026-10-14-email-module-structural-design-plan.md:1) + [`2026-10-15--02-15-46-email-engine-profile-builder-plan.md`](2026-10-15--02-15-46-email-engine-profile-builder-plan.md:1) | not started; the `email` Postgres schema exists but is empty.                       |
| G3  | Companies domain + admin pages (AIS-14 → AIS-22) | [`2026-10-30--13-40-00-admin-foundation-jira-themes-ticket-plan.md`](2026-10-30--13-40-00-admin-foundation-jira-themes-ticket-plan.md:1)                                                                                                | not started; this is the first real consumer of Waves A–D.                          |
| G4  | Call-back flow (public form → call → follow-up)  | AIS-1 epic / Kick-off MVP                                                                                                                                                                                                               | **removed by design in AIS-64**; no replacement exists (see §6).                    |

---

## 5. Documentation defects that will mislead you (fix in the same change that touches them)

| File                                                                                        | Problem                                                                                                                                                                                                                                                           |
| ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`docs/Specs/Functional-Specification.md`](../Specs/Functional-Specification.md:1)          | **Empty template.** `[Dátum]`, `[Funkció neve]`, `[Leírás]` placeholders; links to a non-existent `01-Brainstorming.md`. The repository has **no functional source of truth**.                                                                                    |
| [`docs/Specs/Local-Development.md`](../Specs/Local-Development.md:1) §2b.3                  | Still expects `platform, callback, email` and **9 USAGE / 2 CREATE**, and `_postgres-init-schemas-test.sh` "PASS: 29". After AIS-64 the truth is **2 schemas / 6 USAGE / 1 CREATE / PASS: 23** (as `Database-Local.md` §6 says).                                  |
| [`docs/Specs/Three-Env-Verification.md`](../Specs/Three-Env-Verification.md:1) §2.7.2–2.7.3 | Expects the `callback` schema and `CREATE` on it — removed by AIS-64.                                                                                                                                                                                             |
| [`docs/Specs/Caddy-Reverse-Proxy.md`](../Specs/Caddy-Reverse-Proxy.md:1)                    | Internally contradictory: §2.1/§4.1/§5.3 still describe an apex → `web` 307 redirect, while §A states the apex block was **removed** from the template (apex is a separate WordPress server). Also §4.4 duplicates the "missing secret → 500" bullet block twice. |
| [`docs/Specs/Production-Runbook.md`](../Specs/Production-Runbook.md:1) §4.3                 | Expects **four** Let's Encrypt hostnames including the apex — contradicts the apex-WordPress decision.                                                                                                                                                            |
| [`docs/Specs/Infrastructure-Docker.md`](../Specs/Infrastructure-Docker.md:1) §6.2           | Correct about `platform`/`email`, but the file has no statement that migrations are **not** run by the deploy (Wave F).                                                                                                                                           |
| `docs/Specs/API-Convention.md` §13                                                          | Correct; keep it updated as AIS-99/107/108/75 land (currently says "no server-side paging yet", which B1 changes).                                                                                                                                                |
| `docs/Specs/UI-Architecture.md` §5                                                          | Correct for today; every new page/store/hook must add a row (rule §0.10). `zustand` is listed as _planned_ and is **not installed** — do not import it without adding it to §7.                                                                                   |
| Missing specs                                                                               | `docs/Specs/Admin-Data-Flow.md`, `Forms-and-Validation.md` (AIS-123), `Database-Migrations-and-Backup.md` (AIS-55), `docs/Specs/openapi.json` (AIS-99).                                                                                                           |

**Known-good, trustworthy specs:** `Database-Local.md`, `SonarQube.md`, `AI-Agent-Artifacts.md`,
`Docker-Cheatsheet.md`, `Docker-Debug-Playbook.md`, `API-Convention.md`, `UI-Architecture.md`.

---

## 6. The product-scope gap (the most important finding)

The Kick-off MVP ([`docs/Specs/Kick-off-Meeting.md`](../Specs/Kick-off-Meeting.md:1)) requires: a public call-back form →
automatic VAPI call (STT→LLM→TTS) → owner notification with transcript + summary → call log/state machine. **None of
this exists.** The call-back form, table and schema were deleted in AIS-64, and `apps/web` is now two static pages.

Consequences for the next contributor:

1. The only end-to-end vertical slice in the repo is **admin API-key CRUD** — that is the reference implementation,
   not the product.
2. `Functional-Specification.md` being empty means nobody can tell whether the call-back flow was **deferred** or
   **cancelled**. Before building Wave G3/G4, get a written decision and record it in that file. This is a
   **question for the human owner**, listed in §9.

---

## 7. Mandatory workflow for every ticket (repo convention — do not improvise)

1. **Plan** → `docs/plans/<YYYY-MM-DD--HH-ii-ss>-<kebab-description>-plan.md`.
2. **Implement** following `.roo/rules/*` (TS: interfaces + DI + custom errors; React: layer map, tokens only, three
   state buckets; API: shared Zod contract + envelope + `AppError`).
3. **History entry** → `docs/history/<YYYY-MM-DD--HH-ii-ss>-<description>.md`.
4. **Milestone** → `docs/milestones/<YYYY-MM-DD--HH-ii-ss>-<description>.milestone.md` (**English**, ≤1 page, the six
   mandatory sections) for any non-trivial fix, multi-file change or design decision.
5. **Living specs** → update the affected `docs/Specs/*` in the same change; bump its `Utolsó frissítés` date.
   `UI-Architecture.md` for structure/token/state changes, `API-Convention.md` for contract changes,
   `Caddy-Reverse-Proxy.md` / `Infrastructure-Docker.md` / `Production-Runbook.md` for infra changes.
6. **Tests** green: `pnpm --filter <pkg> test`, `lint`, `build`, then the root `pnpm test`.
7. **Commit** title format (used by this repo): `AIS-###: feat(scope): imperative summary` — the body is an exact
   bullet list of what changed and why.
8. **Jira** → comment with the proof, tick the DoD, move to **In Review** (`Done` only after negative proof when the
   ticket demands one).

---

## 8. Baseline verification (run before you change anything)

```bash
node --version                     # 24.x — the API DI-graph test needs >= 24.9
pnpm install
pnpm --filter @callback/shared build
pnpm test                          # shared -> api-client -> ui -> admin -> api
pnpm -r lint
pnpm -r build
```

Expected: all green. If `pnpm test` fails on the API suite only, check the Node version first — that suite
**silently skips** on older runtimes instead of failing.

Optional, needs Docker (`pnpm db:up` first, and `DATABASE_URL` in `apps/api/.env.local`):

```bash
pnpm --filter @callback/api test:e2e
bash scripts/test/_postgres-init-schemas-test.sh    # expect PASS: 23  FAIL: 0
```

---

## 9. Open questions for the human owner (answer before Wave G)

1. **Call-back flow:** deferred or cancelled? The Kick-off MVP describes it; AIS-64 deleted it. Decide and write it
   into `docs/Specs/Functional-Specification.md`.
2. **First real product slice:** companies/admin (AIS-14…22) or the email engine (AIS-12/13)? Both depend on Waves A–D
   and neither exists.
3. **Auth timing:** E1–E5 before or after the first product feature? The API currently exposes provider tokens
   unauthenticated, so "before" is the safe answer if the droplet is publicly reachable.
4. **Git-hooks ticket:** should the lefthook quality gate get its own Jira ticket (it is planned but untracked)?

---

## 10. Recommended next three steps (if you only read one line)

1. **AIS-119** — the plan is written, it is unblocked, and it is the keystone of AIS-105.
2. **AIS-122** — make the layer/token rules machine-enforced before more pages are built on top of them.
3. **AIS-107** — give the server real pagination, so the URL-driven list state from step 1 has something to page.
