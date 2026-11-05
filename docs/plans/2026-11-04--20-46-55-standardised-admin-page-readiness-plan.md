# Standardised admin page development — readiness plan

**Created:** 2026-11-04 20:46 (Europe/Budapest)
**Ticket scope:** `AIS-129` story family, `AIS-85` / `AIS-86` chain, `AIS-128`, `AIS-133`, `AIS-135`
**Status:** plan only — no implementation started

---

## 1. The question this plan answers

> Which open Jira tickets are actually required so that **another developer** can build admin
> pages where behaviour, data flow, modals and the frontend are all **standardised**?

The answer is deliberately narrow: the standard is **already ~80 % built**. Three blockers remain,
two of which can start today in parallel.

---

## 2. Evidence base

Everything below was verified against the repository on 2026-11-04, not against ticket text.

| Check | Command / location | Result |
| --- | --- | --- |
| UI primitives present | `packages/ui/src/components/` | 30 folders — **no** `toast/`, **no** `log-drawer/` |
| Notification package | `packages/` | only `api-client`, `shared`, `ui` — **no** `notifications` |
| Reference CRUD slice | `apps/admin/src/pages/api-keys/` | `ApiKeyDetailPage.tsx`, `ui/ApiKeyEditForm.tsx`, `ui/ApiKeyDeleteDialog.tsx` present |
| Data-display primitives | `packages/ui/src/components/` | `data-table/`, `pagination/`, `empty-state/`, `skeleton/`, `description-list/`, `status-badge/` |
| Overlay primitives | `packages/ui/src/components/` | `dialog/`, `confirm-dialog/`, `drawer/`, `tooltip/`, `dropdown-menu/` |
| OpenAPI baseline tooling | `scripts/` | **no** `scripts/openapi/`, no `openapi:generate` / `openapi:check` |
| Migration runner | `apps/api/src/migrate.ts` | exists; advisory-lock hardening **absent** (documented in its own docstring) |
| Deploy migration step | `infra/*.yml`, `deploy/` | **no** `migrate` service, **no** migration step |
| Companies resource | `apps/api/src/` | **no** `companies` module |
| Auth / audience layer | `apps/api/src/` | **no** `auth/`, **no** `public/` |
| Component catalogue | all `package.json` | no `storybook` |
| Admin E2E harness | all `package.json` | no `playwright`, no `cypress` |

---

## 3. What is already standardised — nothing to build

| Dimension | Delivered by | Status |
| --- | --- | --- |
| **Data flow** (adatáramlás) | `AIS-102` + `AIS-106`…`AIS-110` (list/pagination contract, `meta.pagination`, `PATCH`/`DELETE`, full client transport), `AIS-119` (URL list state), `AIS-114` (generic `useApiList` / `useApiDetail` / `useApiMutation`) | Done |
| **Frontend primitives** | `AIS-104` + `AIS-113` (form primitives) + `AIS-116` (data-display) | Done |
| **Modals / windows** (ablakok) | `AIS-117` — Dialog, ConfirmDialog, Drawer, Tooltip, DropdownMenu with Radix behaviour | Done |
| **State rules** | `AIS-130` — URL + TanStack Query first; Zustand only for transient UI state | Done |
| **Reference CRUD slice** | `AIS-131` — detail read, `PATCH` with `STALE_WRITE`, delete via `ConfirmDialog` | Done |
| **Error handling, level 1–3** | `AIS-111` (field errors), `AIS-96` (page + app banner) | Done |
| **App layer / routing** | `AIS-118` — `src/app/`, route registry, nav generated from the registry | Done |
| **Quality gates** | `AIS-121` (CI test matrix), `AIS-122` (layer lint, knip, palette, field-error) | Done on the production scope |
| **Test harness** | `AIS-120` — MSW harness, mocks under `apps/admin/src/test/mocks` | Done |

**Conclusion:** data flow, primitives, modals and state are standardised. What is missing is the
**fourth feedback level (toast)**, **the written recipe**, and **a gate that is actually green**.

---

## 4. MUST-HAVE — blocking

### 4.1 `AIS-133` — the single "new admin page" checklist

**What it standardises:** the recipe — the file-by-file order from `packages/shared/src/contract`
→ `packages/api-client` → `apps/api` → `apps/admin/src/features` → `entities` → `pages` → route
registry → nav → MSW handler → tests → the `UI-Architecture.md` §5 state-plan row.

**Why it blocks:** today the knowledge lives in three places that have already diverged:

| Source | Problem |
| --- | --- |
| `.roo/rules/react.coding-standards.md` §12 | 10 steps, no file-name list — cannot be copied |
| `docs/Specs/Admin-Data-Flow.md` §3 | contract-side steps only, no UI steps |
| `docs/Specs/UI-Architecture.md` §5 | state-plan table only |

Worse: §12 **mandates** a page-local Zustand store while §5 says `zustand` stays uninstalled.
A new developer will follow the wrong document.

**Cost:** documentation only, no code. **Can start immediately.**

### 4.2 `AIS-81` → `AIS-83` → `AIS-84` → `AIS-85` — the missing feedback level

**What it standardises:** the fourth feedback level (`notify` / toast) and, through `AIS-85`, makes
the reference page use the *standard* form pattern.

**Why it blocks — measured:**

| Required by the standard | Reality today |
| --- | --- |
| `Toast` + `ToastStack` in `packages/ui` | absent from `packages/ui/src/components/` |
| a `notify` port | `packages/notifications` does not exist |
| reference page on `useAppForm` | `ApiKeyForm.tsx` still uses **raw `useForm`** and a permanent inline `Alert variant="success"` that stays until the next submit |

The consequence is the expensive one: **every new page copies the non-standard pattern.** The
`AIS-90`-era plan already standardised levels 1–3; level 4 is the only hole.

> `AIS-132` was correctly closed as a duplicate — the scope belongs to `AIS-81` / `AIS-83` /
> `AIS-85`. The dedup decision was right; only the cross-link to `AIS-129` was missing (now
> recorded there).

**Minimum path (4 tickets):** `AIS-81` → `AIS-83` → `AIS-84` → `AIS-85`.
**Optional extension:** `AIS-79` (store core), `AIS-80` (sessionStorage), `AIS-82` (log drawer) are
**not** required for standard CRUD pages. `AIS-83` formally depends on `AIS-79`, but a thin
`ToastStack` + provider satisfies the form feedback contract. Defer `79`/`80`/`82` if speed matters.

### 4.3 `AIS-128` — green `pnpm typecheck`

**Why it blocks:** `tsc --noEmit -p apps/api/tsconfig.json` fails with **20 errors in 6 files**
(`api-keys.repository.spec.ts`, `common/http/test/support/envelope-route.ts`,
`common/openapi/openapi.registry.spec.ts`, `db/schema.spec.ts`, `test/envelope-contract.e2e-spec.ts`,
`test/lib/envelope.matchers.ts`). `tsconfig.build.json` excludes them, so `nest build` never
compiled them and CI never type-checked an API test file.

A new developer's first `pnpm typecheck` is **red on day one** — the gate cannot be trusted, so it
gets ignored.

**Cost:** small and self-contained. **Can start immediately.**

---

## 5. SHOULD-HAVE — cheap, improves onboarding

| Ticket | Why | Prerequisite |
| --- | --- | --- |
| `AIS-135` — `pnpm new-resource` scaffold | turns the `AIS-133` checklist into one command | **hard: `AIS-133`** — otherwise it emits the old structure |
| `AIS-134` — board hygiene | not needed to code, but needed so the newcomer can trust the board | Jira workflow mapping fix (`Backlog` → done category) is a settings change, not an API call |
| `AIS-127` — commitlint + CI commit-title gate | process standardisation; the rule text already exists from `AIS-101` | — |

---

## 6. Explicitly OUT of scope for admin page development

| Tickets | Why |
| --- | --- |
| `AIS-71`…`AIS-76` (audience guard, `/api/admin/api-keys`, admin cookie session, key hashing, public namespace) | needed **before go-live**, not to build pages. `AIS-129` states the `ProtectedRoute` + session placeholder is enough for page work — but this must not be forgotten before release |
| `AIS-14`…`AIS-22` (companies vertical) | this is the **first consumer** of the standard, not an enabler. `AIS-131` already provides the CRUD reference. `AIS-22` is additionally blocked — no email-module endpoint exists |
| `AIS-43`…`AIS-55` (migration runner, deploy pipeline, backups, restore drills) | infrastructure. Real, but unrelated to UI standardisation |
| `AIS-99`, `AIS-100`, `AIS-125` (OpenAPI baseline + CI gate) | pages consume `packages/shared` contracts, not the generated spec |
| `AIS-129` | container story only — closes when `AIS-133`, `AIS-134`, `AIS-135` and `AIS-85` are done |

---

## 7. Gaps that no ticket covers

| Gap | Impact | Suggested action |
| --- | --- | --- |
| **No component catalogue** | no `storybook`, no `playwright`, no `cypress` anywhere. The 30 primitives are discoverable only by reading `packages/ui/src/index.ts`. A newcomer cannot browse the visual vocabulary | new story: Storybook (or a docs page) over `packages/ui` |
| **No admin E2E harness** | `AIS-86` and `AIS-85` state it plainly: *"automatizált e2e nincs (nincs e2e harness az admin apphoz)"*. Cross-page flows (list → detail → edit → delete) are untested end-to-end | new story: Playwright smoke suite on the reference slice |
| **No i18n / text catalogue** | Hungarian UI strings are hardcoded in components. Harmless now, a rewrite later | defer; note in `UI-Architecture.md` |

---

## 8. Execution sequence

### Track A — parallel, start now (no shared files)

1. `AIS-133` — write the single checklist, point §12 / `Admin-Data-Flow.md` §3 / `UI-Architecture.md` §5 at it
2. `AIS-128` — fix the 20 type errors, switch `apps/api` `typecheck` to `-p tsconfig.json`

### Track B — feedback level, strict order

3. `AIS-81` — `Toast` + `ToastStack` (token-only CVA, a11y, max 3 visible, no timer)
4. `AIS-83` — React bindings: provider, `useSyncExternalStore` hooks, `notify` facade, `NotificationHost` + timers
5. `AIS-84` — admin capture: single store instance, `QueryCache`/`MutationCache`, HTTP `onEvent`, host in the layout
6. `AIS-85` — `ApiKeyForm` → `useAppForm` + `notify`; make the `useAppForm` `notify` port mandatory; drop the success `Alert`

### Track C — after Track A

7. `AIS-135` — `pnpm new-resource` scaffold (needs `AIS-133`)
8. `AIS-134` — status hygiene + workflow mapping
9. `AIS-127` — commitlint + CI title gate

### Close-out

10. `AIS-129` closes when `AIS-133`, `AIS-134`, `AIS-135` and `AIS-85` are done
11. `AIS-105` closes when its remaining subtasks (`AIS-128`, `AIS-129`) are done
12. `AIS-86` closes when all of `AIS-79`…`AIS-85` are done

### Critical path

```text
AIS-133 ─┐
AIS-128 ─┴─ (parallel) ─→ AIS-81 → AIS-83 → AIS-84 → AIS-85 → AIS-129 close-out
AIS-133 ─────────────────→ AIS-135
```

---

## 9. Verification

After Track A + Track B, the following must all be green for a new developer's first day:

```bash
pnpm quality          # 4 gates: layers, tokens/palette, field-errors, knip
pnpm test:quality
pnpm typecheck        # must be green INCLUDING apps/api spec + e2e files
pnpm -r build
pnpm -r lint
pnpm test
```

Manual acceptance checks:

- [ ] `packages/ui/src/components/toast/` exists and is exported from `packages/ui/src/index.ts`
- [ ] `packages/notifications` exists with `react` as a **peerDependency**
- [ ] a successful form submit produces **one** toast and **one** log entry
- [ ] `rg "useForm\(" apps/admin/src/pages` returns **no** raw `useForm` usage
- [ ] a single checklist document lists every affected file in order and is referenced (not duplicated) by §12, `Admin-Data-Flow.md` §3 and `UI-Architecture.md` §5
- [ ] `pnpm typecheck` is clean in `apps/api`

---

## 10. Risks

| Risk | Mitigation |
| --- | --- |
| `AIS-133` and `AIS-128` both touch the docs / `apps/api` build config if done carelessly | keep them in separate PRs; `AIS-133` touches only `docs/` and `.roo/rules`, `AIS-128` only `apps/api` |
| `AIS-85` and `AIS-84` both modify `packages/api-client/src/http-client.interface.ts` in some plans | `onEvent` belongs to the transport owner; land it once in `AIS-84`, never twice |
| Skipping `AIS-79`/`AIS-80`/`AIS-82` causes a later refactor when the log drawer arrives | the `notify` facade is deliberately the seam: `AIS-83` can grow persistence behind it without touching pages |
| `AIS-135` scaffold emits a stale structure | hard prerequisite `AIS-133`; add a generator unit test asserting the produced file tree matches the checklist |
| Auth (`AIS-71`…`AIS-74`) forgotten until release | keep it as an explicit release gate in `AIS-70`; do not close `AIS-70` before the admin routes are authenticated |

---

## 11. Follow-ups

- Decide on a component catalogue (Storybook vs. a static docs route) — currently untracked
- Decide on an admin E2E harness (Playwright) — currently untracked and explicitly absent
- Decide the fate of `AIS-5` (no description, no acceptance criteria)
- Link `AIS-1` (`MVP`) and `AIS-77` (`STEP-2`) epics to their stories — both currently have zero children
- `AIS-22` stays blocked until an email-module endpoint exists
