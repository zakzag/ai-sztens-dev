# AIS-174 — Admin surface decisions: the docs follow the code, the code follows the rule

**Date:** 2026-11-08 · **Ticket:** AIS-174 · **Parent:** AIS-170 · **Preconditions:** AIS-171,
AIS-172, AIS-173 (all done, code verified) · **Type:** documentation + two missing minimal tests.
**No new feature, no new dependency, no new quality gate.**

---

## 1. What the ticket asks

Five decisions and two tests, in this order:

| #   | Item                                                                                                   | Where the decision must live                                                    |
| --- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| 1   | **C7** — the list header action is `Link` + `buttonVariants`, **not** `Button`                         | `docs/Specs/UI-Architecture.md` §4.0 + a post-hoc note on the AIS-155 plan `D9` |
| 2   | **C10** — one written rule for where a route path comes from                                           | `docs/Specs/New-Admin-Page.md` §2 step 12                                       |
| 3   | **C8** — the definition of the "standard list", **including** its documented gaps                      | `docs/Specs/UI-Architecture.md` §5 + `New-Admin-Page.md` §2 step 11             |
| 4   | **C6** — the exception list (who does _not_ follow page folder + `PageShell`, and why)                 | `docs/Specs/New-Admin-Page.md` §3                                               |
| 5   | **Tests** — `LoginPage.test.tsx`, `PlaceholderPage.test.tsx`, mocks under `apps/admin/src/test/mocks/` | the two page files                                                              |
| 6   | **Closing docs** — `docs/history/` entry + milestone                                                   | `docs/history/`, `docs/milestones/`                                             |

---

## 2. Repo state verified before planning

| Claim of the ticket                                                                                       | Verified?                     | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| --------------------------------------------------------------------------------------------------------- | ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C7: code already uses `Link` + `buttonVariants` for the header action                                     | **yes**                       | [`ApiKeysPage.tsx`](../../apps/admin/src/pages/api-keys/ApiKeysPage.tsx:83) — `actions={<Link to={API_KEYS_CREATE_ROUTE_PATH} className={buttonVariants()}><PlusIcon />…}` with a comment explaining that opening the overlay is a _navigation_                                                                                                                                                                                                                                                                               |
| C7: AIS-155 `D9` prescribes `Button` + `Button.icon`                                                      | **yes**                       | [AIS-155 plan `D9`](2026-11-07--14-46-00-ais-155-entity-dialog-standard-plan.md:24)                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| C7: `D8` of the same plan is **also** stale (it keeps the legacy detail page and routes the delete there) | **yes — extra drift**         | [AIS-155 plan `D8`](2026-11-07--14-46-00-ais-155-entity-dialog-standard-plan.md:23) vs. [AIS-173 removal](2026-11-08--17-36-00-ais-173-api-keys-delete-in-view-overlay-plan.md:1)                                                                                                                                                                                                                                                                                                                                             |
| C10: the rule exists in three fragments, none complete                                                    | **partly**                    | step 12 already says "path constants come from `app/app.const.ts`, except a detail route, whose path lives in the page const" ([`New-Admin-Page.md`](../../docs/Specs/New-Admin-Page.md:49)); the _reason_ is only a code comment ([`app.const.ts`](../../apps/admin/src/app/app.const.ts:47)); and [`UI-Architecture.md`](../../docs/Specs/UI-Architecture.md:860) says "detail and list **labels** come from the same `app.const.ts` constant", which reads as a contradiction of "the detail path lives in the page const" |
| C8: `useListParams` supports `search`, no page uses it                                                    | **yes**                       | [`use-list-params.ts`](../../apps/admin/src/features/api/use-list-params.ts:1); `ApiKeysPage` only reads/writes `page`, `limit`, `sort`, `order`                                                                                                                                                                                                                                                                                                                                                                              |
| C8: "standard list = `DataTable` + `Pagination` + `EmptyState` **with an action**"                        | **no — drift #1**             | [`ApiKeysTable.tsx`](../../apps/admin/src/pages/api-keys/ui/ApiKeysTable.tsx:106) renders `<EmptyState title={API_KEYS_EMPTY_MESSAGE} />`, while [`EmptyStateProps.action`](../../packages/ui/src/components/empty-state/empty-state.interface.ts:22) exists but is unused. The audit plan row 4 claimed "üres állapot akció **van**" ([audit plan](2026-11-08--13-40-00-admin-page-consistency-audit-plan.md:117))                                                                                                           |
| C6: `LoginPage` / `PlaceholderPage` have no tests                                                         | **yes**                       | no `*.test.tsx` under `apps/admin/src/pages/` for either file                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| C6/tests: `LoginPage` can report "invalid authentication → error message"                                 | **no — drift #2**             | [`LoginPage.tsx`](../../apps/admin/src/pages/LoginPage.tsx:15) `if (password.trim().length === 0) { return; }` — an empty submit is a **silent no-op**: no message, no token, no feedback. The copy is inline in JSX, there is no `login.const.ts`, and the page is a flat file (documented exception)                                                                                                                                                                                                                        |
| DoD: §5 has no legacy detail row and names `PageShell` + the three overlays                               | **yes, already true**         | [`UI-Architecture.md`](../../docs/Specs/UI-Architecture.md:934) rows: `api-keys`, `LoginPage`, `PlaceholderPage`, `calls`, `not-found`; overlay table + `PageShell` paragraph directly below                                                                                                                                                                                                                                                                                                                                  |
| DoD grep `ApiKeyDetailPage` finds nothing in `docs/Specs`                                                 | **no — drift #3 (by nature)** | [`New-Admin-Page.md`](../../docs/Specs/New-Admin-Page.md:3) and [`UI-Architecture.md`](../../docs/Specs/UI-Architecture.md:4) / [`:108`](../../docs/Specs/UI-Architecture.md:108) / [`:153`](../../docs/Specs/UI-Architecture.md:153) mention the removed page **in dated removal sentences**, never as a live pointer                                                                                                                                                                                                        |
| DoD grep `§12` finds no stale reference in `Admin-Data-Flow.md`                                           | **yes**                       | only `API-Convention.md` (`:399`, `:442`) and the rule-file pointer (`New-Admin-Page.md:105`, `UI-Architecture.md:1039`) carry `§12`, both valid                                                                                                                                                                                                                                                                                                                                                                              |

**Environment note.** `rg` is not installed on this machine; every `rg` command of the ticket is
equivalent to `Get-ChildItem -Recurse docs\Specs -Include *.md | Select-String -Pattern …` and the plan
uses that form in §7.

---

## 3. Decisions

| #       | Decision                                                                                                                                                                                                                                                               | Why                                                                                                                                                                                                              |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **D-A** | The docs follow the code where the code is justifiably better (**C7: `Link`**), and the code follows the docs where the docs are the rule (`C2` exception already written in AIS-173). No sentence stays that the code contradicts                                     | The ticket's own D-A; the only way to stop the next developer from copying the wrong pattern                                                                                                                     |
| **D-B** | A **missing** capability is a documented decision, not a defect. No search/filter UI, no per-row icon action, **no empty-state CTA** (drift #1)                                                                                                                        | Re-discovering a deliberate absence on every new page costs more than writing it down once                                                                                                                       |
| **D-C** | The empty-state CTA stays **out**: the standard list is `DataTable` + `Pagination` + **copy-only** `EmptyState`, and the single create entry point is the header action. `EmptyState.action` remains available for a follow-up ticket                                  | One call to action, one place. Two competing "create" affordances on an empty list is a design decision nobody asked for in a docs ticket; adding it would be a feature, and the ticket explicitly delivers none |
| **D-D** | `LoginPage` gets the **minimum** that makes the ticket's second test case real: copy extracted to `pages/login.const.ts` and a visible message when the password is empty (`Input.error`, no new state machine, no `useAppForm`, no backend call)                      | A silent no-op submit is a UX/a11y defect and a test cannot assert a message that does not exist. Same file, one `useState`, zero dependencies                                                                   |
| **D-E** | Historical removal sentences that **name** the retired file stay; the DoD grep is **triaged**, not blindly satisfied: a hit is a defect only when it is a _live_ pointer (a link, a route, an instruction). Each historical hit is listed in the `docs/history/` entry | D-A forbids sentences the code contradicts, not sentences about the past; deleting the removal narrative would lose the "where did it go" answer that AIS-173 shipped                                            |
| **D-F** | No new quality rule. `pnpm quality:docs` (R1–R4) is unchanged                                                                                                                                                                                                          | It already catches a broken link or a `§N` that names no section; a new rule would only re-implement it                                                                                                          |
| **D-G** | The AIS-155 plan is **not rewritten** — its `D9` (and `D8`) get one appended note at the end of the file                                                                                                                                                               | Plans are a record; a deleted sentence rewrites history, a note keeps it auditable                                                                                                                               |

---

## 4. Work steps

### Step 1 — C7: the header action is a link (`docs/Specs/UI-Architecture.md` §4.0)

Add a short block **inside** §4.0 (`### 4.0 Overlay primitives`), because the header action is the door
to the create overlay:

- **Rule:** the list header action that opens a create overlay is
  `<Link to={…} className={buttonVariants()}>` + a decorative icon — **not** `Button`.
- **Why:** opening the overlay is a _navigation_ to a real URL (`/api-keys/new`), so the browser's own
  affordances (open in a new tab, copy the link, middle click) must work; `buttonVariants()` supplies
  the primary look without a second hand-written class recipe; the icon is `aria-hidden` and the
  label carries the accessible name (WCAG 2.5.3).
- **Boundary:** an action that only mutates state _without_ changing the URL (e.g. a future bulk
  action, the `ConfirmDialog` opener of AIS-173) stays a `Button`. The difference is **navigable or
  not**, exactly like the dialog rule in §5.
- Reference [`ApiKeysPage.tsx`](../../apps/admin/src/pages/api-keys/ApiKeysPage.tsx:83) as the
  reference implementation.

### Step 2 — C10: one place for the route-path rule (`New-Admin-Page.md` §2 step 12)

Rewrite the tail of step 12 into a self-contained rule (it is the normative checklist, so the rule
lives **here**, once):

1. **List / static paths** live in `apps/admin/src/app/app.const.ts` (`APP_ROUTE_API_KEYS_PATH`, …),
   because the navigation and the breadcrumb both read them and both live in `app/`.
2. **Detail / overlay templates** (`API_KEY_VIEW_ROUTE_PATH`, `API_KEY_EDIT_ROUTE_PATH`,
   `API_KEYS_CREATE_ROUTE_PATH`) live in the **page** const (`<page>.const.ts`), because the page
   builds the row link and the header action, and `pages/` must never import `app/`
   (`no-page-to-higher-layer`). The registry — which may import a page — takes the same literal.
3. **One literal, N consumers:** whatever the registry mounts and the page links to must be the same
   exported constant; a hand-retyped path in either place is a defect.
4. **The `PageShell` `back` slot** gets its URL from the same page const, because the primitive is
   router-free and the page owns every `Link`.
5. Keep the existing cross-reference: `app/app.const.ts` explains the same boundary next to the
   constants, and §4.2 of `UI-Architecture.md` must not contradict it.

Then reconcile [`UI-Architecture.md`](../../docs/Specs/UI-Architecture.md:860) §4.2: change the
"detail and list **labels** come from the same `app.const.ts` constant" bullet so it says **labels**
(which is true — `APP_API_KEYS_LABEL` is read by nav + breadcrumb), and add a pointer that the
**path** rule lives in `New-Admin-Page.md` §2 step 12. Pointer, not copy.

### Step 3 — C8: the standard list, gaps included

Two places, one wording (the checklist is normative, §5 is the state plan):

- **`New-Admin-Page.md` §2 step 11** — append one paragraph after the step table:

  > **The standard list (AIS-174).** `DataTable` (+ `isLoading` skeleton and the `sr-only` loading
  > sentence) + `Pagination` from `meta.pagination` + `EmptyState` with copy only. The create entry
  > point is the **header action** (a `Link`, see §2 step 12) — the empty state carries **no** action
  > button, deliberately: two competing "create" affordances on an empty list is one too many.
  > **Documented gaps, not defects:** there is **no search/filter UI** (`useListParams` parses
  > `search`, no page exposes it) and **no per-row icon action** (the row's name is the link into the
  > read-only overlay). Both are separate tickets if a page needs them.

- **`UI-Architecture.md` §5** — the same definition as a short block after the state-plan table, with
  the reason it is stated: a new page must not re-invent the list, and must not "fix" the gaps.

### Step 4 — C6: the exception list (`New-Admin-Page.md` §3)

Append a `**Documented exceptions**` block under the §3 "Do not" table. Four rows, each with _why_ and
_when it ends_:

| Surface                      | Why it is not a page folder + `PageShell`                                                                                  | Ends when                                                                       |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `pages/LoginPage.tsx`        | renders **outside** `AdminLayout`; `ProtectedRoute` centres a `Card`; its heading is `text-xl`, not the shell's `text-2xl` | a real auth page (AIS-74 cookie session) lands — then it becomes `pages/login/` |
| `pages/PlaceholderPage.tsx`  | static landing shell (`/`), no data, no state                                                                              | the first real dashboard replaces it                                            |
| catch-all `pages/not-found/` | an unknown URL has **no trail**, so `breadcrumbLabel: null` is the only legal value                                        | never — it is the permanent fallback                                            |
| `pages/calls/`               | placeholder for a feature that has not started; the file already **is** a page folder with its own `calls.const.ts`        | the real call list lands                                                        |

State the invariant plainly: **a flat exception file may carry a sibling `*.const.ts`, nothing else.**
No `*.logic.ts`, no `ui/`, no store outside a page folder.

### Step 5 — the two missing tests

**5a — `apps/admin/src/pages/LoginPage.tsx` (copy in the page module + the empty-password path)**

Why the copy cannot go into a sibling file (correction found while implementing): the layer gate's
`no-flat-page-to-page` rule ([`.dependency-cruiser.rules.cjs`](../../.dependency-cruiser.rules.cjs:154))
forbids a flat page from importing **anything** under `src/pages/`, and a sibling `login-page.const.ts`
is itself a flat page. The constants therefore live in `LoginPage.tsx` as **exported** constants, and the
test imports them from there — one home for the copy, no gate change, no folder.

- `LOGIN_PAGE_TITLE`, `LOGIN_PASSWORD_FIELD_ID`, `LOGIN_PASSWORD_LABEL`, `LOGIN_SUBMIT_LABEL`,
  `LOGIN_EMPTY_PASSWORD_MESSAGE`.
- One `const [error, setError] = useState<string | null>(null)`; an empty/whitespace password **sets**
  `LOGIN_EMPTY_PASSWORD_MESSAGE` and returns; typing clears it; it reaches the input as `error` (the
  primitive already wires `aria-invalid` and `aria-describedby`,
  [`input.interface.ts`](../../packages/ui/src/components/input/input.interface.ts:16)).
- Keep the TODO comment about the real `POST /api/auth/login` — this is deliberately **not** the auth
  ticket.

**5b — `apps/admin/src/pages/PlaceholderPage.tsx`.** The title and the subtitle move out of the JSX into
exported `PLACEHOLDER_PAGE_TITLE` / `PLACEHOLDER_PAGE_SUBTITLE`, for the same reason and with the same
constraint as 5a; the test imports them so it cannot drift from the rendered copy.

**5c — `apps/admin/src/pages/LoginPage.test.tsx`**

Renders through the existing harness — **no new mock file, no `vi.mock` inside the test**
([`renderWithProviders`](../../apps/admin/src/test/mocks/render-with-providers.tsx:52) already mounts
`QueryClientProvider → NotificationProvider → SessionProvider`; `SessionProvider` wraps `AuthProvider`,
so `useAuth()` resolves):

| Case                                    | Assertion                                                                                                                                                                                                                   |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| submit with a password                  | `installRecordingStorages()` double: `session.writtenKeys()` contains `SESSION_TOKEN_KEY` from [`session-token.ts`](../../apps/admin/src/auth/session-token.ts:17) and the stored value matches `/^placeholder-token-\d+$/` |
| submit with empty / whitespace password | the message `LOGIN_EMPTY_PASSWORD_MESSAGE` is rendered, the input is `aria-invalid="true"`, and `session.isUntouched()` is `true`                                                                                           |
| typing after a failed submit            | the message disappears (`queryByText` → `null`)                                                                                                                                                                             |
| render                                  | heading `Bejelentkezés` at level 1, submit button labelled by `LOGIN_SUBMIT_LABEL`                                                                                                                                          |

Use [`installRecordingStorages()`](../../apps/admin/src/test/mocks/web-storage.mock.ts:195) in
`beforeEach` and its `restore()` in `afterEach`. The ticket's "mock `auth/session-token.ts`" is
satisfied _differently and better_: the rules forbid mocks inside test files, and asserting the
**storage write** is the observable behaviour, not the internal call.

**5d — `apps/admin/src/pages/PlaceholderPage.test.tsx`**

- renders `PageShell`'s single `h1` with the page title (`role: 'heading', level: 1`);
- the subtitle paragraph is present;
- `getByTestId('build-info')` exists — i.e. [`BuildInfoFooter`](../../apps/admin/src/components/BuildInfoFooter.tsx:28)
  is rendered as a child of the shell (this is the regression the test is for: a shell refactor that
  drops `children`).

### Step 6 — the post-hoc note on the AIS-155 plan (`D-G`)

Append one section at the end of
[`2026-11-07--14-46-00-ais-155-entity-dialog-standard-plan.md`](2026-11-07--14-46-00-ais-155-entity-dialog-standard-plan.md)
— **nothing above it is edited**:

- **`D9` superseded by AIS-174:** the header action is `Link` + `buttonVariants()`, not
  `Button` + `Button.icon`; rationale in `UI-Architecture.md` §4.0.
- **`D8` superseded by AIS-173:** the legacy detail page and the `/api-keys/:identifier` route were
  removed; the delete moved into the read-only overlay as a local-state `ConfirmDialog`.
- **Routes table row** (`/api-keys/:identifier` — "marad") is historical, superseded by AIS-173.

### Step 7 — living-document headers

- `docs/Specs/New-Admin-Page.md:3` — prepend the AIS-174 entry (C7 pointer, C10 rule, standard list,
  exception list), keep the existing chain.
- `docs/Specs/UI-Architecture.md:3` — same; **and** demote the duplicate
  `**Utolsó frissítés:** 2026-11-08 (AIS-172: …)` at
  [`UI-Architecture.md:166`](../../docs/Specs/UI-Architecture.md:166) to a plain
  `**AIS-172 (2026-11-08):**` block, so the file has exactly one header line (R3 stays satisfied,
  the duplicate stops looking like the current date).
- Keep both dates at `2026-11-08` (the change lands today). If it slips, the date is the **landing**
  date, not the planning date.

### Step 8 — closing documentation

- `docs/history/2026-11-08--<HH-mm-ss>-ais-174-admin-surface-decisions.md`
  (why / what changed per file / **drift triage** of the `ApiKeyDetailPage` grep per `D-E` /
  verification numbers).
- `docs/milestones/2026-11-08--<HH-mm-ss>-admin-surface-decisions.milestone.md` — **English**, ≤ one
  page, required structure (problem, evidence, rationale, changed files, how to verify, follow-ups:
  search/filter UI, empty-state CTA, row actions, real auth).

---

## 5. Ordering constraints

1. Step 5a **before** step 7: `New-Admin-Page.md` links `LoginPage.tsx` and `PlaceholderPage.tsx` in the
   exception table — a link to a file that does not exist yet fails `pnpm quality:docs` (R1).
2. Step 2 before step 3: the standard-list paragraph cites "the header action (a `Link`, see §2 step
   12)", which only reads correctly after the step-12 rewrite.
3. Step 6 is independent, but do it **after** step 1 so the note can reference the written rule.
4. Steps 4 and 7 last: docs first make the change reviewable, headers last state that it is done.

---

## 6. Tests

| Test file                                       | Cases                                                                                                                                                                        |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/admin/src/pages/LoginPage.test.tsx`       | success writes the token to `sessionStorage`; empty/whitespace password → message + `aria-invalid` + **no** write; message clears on typing; render (heading + submit label) |
| `apps/admin/src/pages/PlaceholderPage.test.tsx` | `h1` = page title, subtitle rendered, `data-testid="build-info"` present                                                                                                     |

Both use only existing mocks (`render-with-providers`, `web-storage.mock`). No network, no timers, no
mock defined inside a test file.

---

## 7. Verification

```powershell
# the ticket's three manual checks (rg is not installed here)
Get-ChildItem -Recurse docs\Specs -Include *.md | Select-String -Pattern 'ApiKeyDetailPage'
Get-ChildItem -Recurse docs\Specs -Include *.md | Select-String -Pattern '§12'
Get-ChildItem -Recurse docs\Specs -Include *.md | Select-String -Pattern 'ApiKeyDetailCard'

# behaviour
pnpm --filter @callback/admin test -- LoginPage PlaceholderPage

# full gate set from the DoD
pnpm quality
pnpm test:quality
pnpm typecheck
pnpm -r build
pnpm -r lint
pnpm test
```

Expected outcomes:

- the `ApiKeyDetailPage` / `ApiKeyDetailCard` hits are **only** the dated removal sentences listed in
  §2 (New-Admin-Page header, `UI-Architecture.md:4`, `:108`, `:153-154`); every hit is classified in
  the history entry per `D-E`;
- `§12` hits are only the valid ones (`API-Convention.md:399`, `:442`, plus the pointer lines in
  `New-Admin-Page.md:105` and `UI-Architecture.md:1039`);
- `pnpm quality:docs` green — the new links resolve, the new `§` references name existing sections,
  both headers carry `**Utolsó frissítés:** 2026-11-08`, and the four pointer documents still link
  the checklist ([`POINTER_SOURCES`](../../scripts/quality/docs-gate.const.mjs:59)).

---

## 8. Risks

| Risk                                                                    | Mitigation                                                                                                               |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `knip` (dead code) fails on the new exported copy constants             | every constant is consumed by the component **and** the test in the same change                                          |
| Prettier reformats the wide markdown tables and `format:check` goes red | run `pnpm format` on the touched `.md` files before the final gate                                                       |
| Rewriting a changelog line loses the removal trail                      | historical sentences stay (`D-E`); only _live_ pointers are removed                                                      |
| The ticket's DoD grep cannot be literally zero                          | the triage in §7 + the history entry make the deviation explicit instead of silently ignoring it                         |
| `LoginPage` grows into the auth feature                                 | the step is capped at one `useState` + copy extraction; `D-D`, plus an explicit "out of scope" line in the history entry |

---

## 9. Out of scope

- Search / filter UI on the list (`useListParams` `search` stays unused) — separate ticket.
- Per-row icon actions, empty-state CTA (`D-C`).
- Real authentication (`POST /api/auth/login`, cookie session AIS-74), RHF on the login form.
- Any restructuring of `UI-Architecture.md` beyond §4.0 / §4.2 / §5 and the two header lines.
- A new quality gate (`D-F`).

---

## 10. Deliverables (Definition of Done, mirrored)

- [ ] `UI-Architecture.md` §4.0 documents the `Link` + `buttonVariants` header action and its
      navigable/not-navigable boundary.
- [ ] AIS-155 plan carries the appended note for `D9` (and the `D8` / routes drift).
- [ ] `New-Admin-Page.md` §2 step 12 states the route-path rule completely; §4.2 of
      `UI-Architecture.md` no longer reads as a contradiction.
- [ ] The standard list and its two documented gaps are written in `New-Admin-Page.md` §2 step 11 and
      `UI-Architecture.md` §5.
- [ ] `New-Admin-Page.md` §3 lists the four exceptions with reason and end condition.
- [ ] `LoginPage.test.tsx` and `PlaceholderPage.test.tsx` exist and are green; no mock inside a test
      file; `LoginPage` shows a message instead of silently ignoring an empty submit.
- [ ] `UI-Architecture.md` §5 state-plan table still has no legacy detail row and still names
      `PageShell` + the create/view/edit overlays (verified, expected to need no edit).
- [ ] `docs/history/…-ais-174-admin-surface-decisions.md` + the milestone exist; the history entry
      contains the grep triage.
- [ ] `pnpm quality && pnpm test:quality && pnpm typecheck && pnpm -r build && pnpm -r lint && pnpm test`
      green.
