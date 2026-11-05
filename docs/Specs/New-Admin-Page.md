# New admin page — the single checklist

**Utolsó frissítés:** 2026-11-05 (AIS-136: a notification alrendszer **automatikus** — egy page soha nem mountol hostot, nem hoz létre store-t; lásd §2 „no work" bekezdés és §3)
**Status:** living document — the current process, not a snapshot
**Owner:** AIS-133 (parent story: AIS-129)
**Reference slice:** `api-keys` — `apps/admin/src/pages/api-keys/`, routes `/api-keys` and `/api-keys/:identifier`
**Gate:** `pnpm quality:docs` (see §4) fails the build when this file and its pointers drift apart.

This is the **normative** artefact: if this file and any other document disagree about _which files to
create and in what order_, this file wins. The other documents stay authoritative for their own
subject — the HTTP contract in [`API-Convention.md`](API-Convention.md), the UI rules in
[`UI-Architecture.md`](UI-Architecture.md), the flows in [`Admin-Data-Flow.md`](Admin-Data-Flow.md).

Read §1, then work §2 top to bottom. Every step states a **file name**; nothing here is "add the
reducer somewhere". Steps marked **no work** are as important as the others — they are where a second,
hand-maintained list would be invented.

---

## 1. Decide before you write code

| #   | Decision                                                                                                                                                                                                                                                     | Source of truth                                                                                                               |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| 1   | **State bucket.** Ask in order: must it survive a reload or a copied link → the **URL**; does it come from the server → **TanStack Query**; do two parts of the page share it and may it be lost on navigation → **page-local store**; otherwise `useState`. | [`react.coding-standards.md`](../../.roo/rules/react.coding-standards.md) §6.1                                                |
| 2   | **No store is a decision.** If the test above never answers "store", the page gets **no** `<page>.store.ts` — write that down in the state-plan row. A store that mirrors URL or Query state is a defect.                                                    | §6.1–§6.3 of the same file                                                                                                    |
| 3   | **Forms.** Every form goes through `useAppForm`; a raw `useForm` under `apps/admin/src/pages/` is forbidden.                                                                                                                                                 | [`UI-Architecture.md`](UI-Architecture.md) §4.4, [`Forms-and-Validation.md`](Forms-and-Validation.md)                         |
| 4   | **No new dependency.** `zustand` is installed **only** together with the first page that genuinely needs a page store, in the same change that adds the store.                                                                                               | [`UI-Architecture.md`](UI-Architecture.md) §7, [`react.coding-standards.md`](../../.roo/rules/react.coding-standards.md) §6.4 |
| 5   | **Naming.** The registry namespace is camelCase and plural (`apiKeys`), the folder is kebab-case (`api-keys`), the operation is `<resource>.<action>` (`apiKeys.list`).                                                                                      | [`API-Convention.md`](API-Convention.md) §1.1                                                                                 |

---

## 2. The ordered work

| #       | Where                                                                                | What must exist                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------- | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **0**   | (decision notes)                                                                     | The five answers of §1, written down — the state-plan row in step 15 is their public form.                                                                                                                                                                                                                                                                                                                                                                                       |
| **1**   | `packages/shared/src/contract/<resource>/`                                           | `<resource>.schema.ts` (request `.strict()`, response tolerant), `<resource>.list-query.ts` (list schema + sortable columns), `<resource>.update.ts` (partial `PATCH` schema with a **required** `updatedAt`), `<resource>.contract.ts` (registry entries), `<resource>.fixture.ts` (one valid example, reused by the tests and by OpenAPI), `<resource>.const.ts` / `<resource>.interface.ts` (limits, path constants, `z.infer` types).                                        |
| **2**   | `packages/shared/src/contract/endpoint.registry.ts` + `packages/shared/src/index.ts` | One entry per operation (`operationId`, method, path, `tag`, `successStatus`, `dataSchema`, `requestSchema?`, `errors[]`) and the export.                                                                                                                                                                                                                                                                                                                                        |
| **3**   | `packages/shared/test/`                                                              | `<resource>.schema.test.ts`, `<resource>-update.test.ts`, `<resource>-list-query.test.ts` — valid case, each rejection branch, and the fixture. `endpoint-registry.test.ts` covers step 2 automatically.                                                                                                                                                                                                                                                                         |
| **4**   | `packages/api-client/src/<resource>/`                                                | `<resource>.service.ts` (`create<Resource>Service(client: HttpClient)`, path via `clientPathOf('<resource>.<action>')`, **never** a literal), `<resource>.interface.ts` (every method takes `options?: RequestOptions`), `<resource>.const.ts`, `<resource>.path.ts` (**only** when `:identifier` substitution is needed).                                                                                                                                                       |
| **5**   | `packages/api-client/src/service.registry.ts`                                        | **One line** — the key equals the registry namespace. `test/service-coverage.test.ts` needs no new test; it fails on a missing or orphan operation.                                                                                                                                                                                                                                                                                                                              |
| **6**   | `apps/api/src/<resource>/`                                                           | `<resource>.controller.ts` (`@Body(new ZodBodyPipe(schema))`, `responses.ok(...)`; `DELETE` returns `200` + `data: null`), `<resource>.service.ts` (business decision, `AppError` on failure), `<resource>.repository.ts` + `<resource>.repository.interface.ts` (atomic, version-checked writes), `<resource>.mapper.ts`, `<resource>.logic.ts`, `<resource>.errors.ts`, `<resource>.error-guard.ts`, `<resource>.module.ts`, `<resource>.const.ts`, `<resource>.interface.ts`. |
| **7**   | `apps/api/src/db/schema.ts` + `apps/api/drizzle/`                                    | The table definition plus a new `000N_*.sql` migration and its `meta/` snapshot.                                                                                                                                                                                                                                                                                                                                                                                                 |
| **8**   | `apps/api/src/<resource>/`                                                           | One `*.spec.ts` per unit (controller, service, repository, mapper, logic, error guard) and all doubles under `apps/api/src/<resource>/test/mocks/` — **never** inside a spec file.                                                                                                                                                                                                                                                                                               |
| **9**   | `apps/admin/src/features/<use-case>/`                                                | `use-<use-case>.ts` (query/mutation, cache invalidation), `<use-case>.logic.ts` (pure rules), `<use-case>.const.ts` (query keys — mandatory here, never inline), `<use-case>.interface.ts` (narrow result types incl. `errorMessage` / `errorSurface`). Build on the generic base: `features/api/use-api-list.ts`, `use-api-detail.ts`, `use-api-mutation.ts`, `use-list-params.ts`.                                                                                             |
| **10**  | `apps/admin/src/entities/<entity>/`                                                  | `<entity>.interface.ts` (domain type + view model), `<entity>.mapper.ts` (pure dto → view model), `<entity>.const.ts`, `components/` (display only), `<entity>.mapper.test.ts`.                                                                                                                                                                                                                                                                                                  |
| **11**  | `apps/admin/src/pages/<page>/`                                                       | `<Page>.tsx` (composition only), `<page>.interface.ts`, `<page>.const.ts` (route path, limit options, labels), `<page>.logic.ts`, `ui/*.tsx` for page-only parts, and tests for every part. Loading / empty / error / success are all explicit — a bare `null` is a defect.                                                                                                                                                                                                      |
| **11b** | `apps/admin/src/pages/<page>/<page>.store.ts`                                        | **Only** when step §1 answered "store" at step 3: store factory + provider + selector hook, all inside this folder, `zustand` installed in the **same** change.                                                                                                                                                                                                                                                                                                                  |
| **12**  | `apps/admin/src/app/router/route-registry.tsx`                                       | **One** `RouteEntry` (path, element, `navLabel` or `null`, `hidden`). Path constants come from `app/app.const.ts`, except a detail route, whose path lives in the page const (`API_KEY_DETAIL_ROUTE_PATH`).                                                                                                                                                                                                                                                                      |
| **13**  | `apps/admin/src/app/layout/AdminNav.tsx`                                             | **No work.** The navigation is derived from the registry; a second hand-written nav list is a defect.                                                                                                                                                                                                                                                                                                                                                                            |
| **14**  | `apps/admin/src/test/mocks/`                                                         | `handlers/<resource>.handlers.ts` registered in `test/mocks/server.ts`, plus fixtures under `test/mocks/`. Tests mock the service layer or the network — never `fetch` internals, never real timers.                                                                                                                                                                                                                                                                             |
| **15**  | `docs/Specs/UI-Architecture.md` §5                                                   | The new page's **row** in the state plan: which bucket owns what, and why the other three are intentionally empty.                                                                                                                                                                                                                                                                                                                                                               |

Column and layer order is not negotiable: `contract → api-client → api → features → entities → pages
→ route → nav → mocks → state-plan row`. The layer gate (`pnpm quality:layers`) may only pass in that
order, so working out of order means rewriting.

**Notifications need no step at all (AIS-136).** The toast stack and the log drawer are mounted once,
by `<NotificationHost />` in `app/layout/AdminLayout.tsx`, and the capture adapters are bound to the
single store in `main.tsx`. A page therefore never mounts `NotificationProvider` / `NotificationHost`,
never creates a notification store and never sets `meta.successMessage` on its mutations: the global
capture already toasts every `banner`/`page` failure and logs every `field` one. The only two things a
page may do are (a) pass `useNotifier()` + a `successMessage` into `useAppForm` for a successful write,
and (b) render its own error region for the tier it owns. The public `/login` route deliberately has
no host.

---

## 3. Do not

| Do not                                                                         | Do instead                                                  |
| ------------------------------------------------------------------------------ | ----------------------------------------------------------- |
| Call `fetch` outside `packages/api-client`                                     | a service method, consumed by a hook                        |
| Copy server data into a store or `useState`                                    | read it from the TanStack Query cache                       |
| Branch on `error.status` / `error.code` / `instanceof ApiError` in a component | `toErrorSurface` / `toFieldErrors` in a `*.logic.ts`        |
| Use a colour literal, a Tailwind palette utility or an arbitrary colour value  | `packages/ui` tokens and primitives                         |
| Call `useForm` directly in a page                                              | `useAppForm`                                                |
| Import another page's module or store                                          | share through `entities/` or `lib/`                         |
| Import `app/` from `pages/`                                                    | keep the route path in the page const or `app/app.const.ts` |
| Add a second navigation list                                                   | the `route-registry.tsx` entry is the only list             |
| Duplicate validation copy                                                      | the shared catalogue in `packages/shared`                   |
| Mount `NotificationProvider` / `NotificationHost` on a page                    | the host already lives in `AdminLayout`, once                |
| Create a notification store, or set `meta.successMessage` on a write           | one store in `app/notifications`, the form's `notify` port   |

---

## 4. Done signal

```bash
pnpm quality          # layers + dead code + tokens + field errors + docs
pnpm test:quality     # the gates' own positive/negative fixtures
pnpm typecheck && pnpm -r build && pnpm -r lint && pnpm test
```

A page is done when all of the above are green, the §2 steps exist, and the state-plan row in
`UI-Architecture.md` §5 describes the page.

**What the gate checks.** `pnpm quality:docs` fails when (R1) a relative link in `docs/Specs` points
at a path that does not exist, (R2) a `§N` reference on a line that links a document names a section
that document does not have, (R3) a `docs/Specs` document lacks `**Utolsó frissítés:** YYYY-MM-DD`, or
(R4) one of the pointer documents — this file's §5 list, the rule file's §12, `UI-Architecture.md` §6
and `Admin-Data-Flow.md` §3 — stops linking back here. `docs/Specs/outdated/` is never scanned.

**What it does not check.** Whether a reference is _semantically_ the right section, and a bare `§N`
in prose with no link on the line (its target document is ambiguous). R2 applies to the documents of
this process — this file, `UI-Architecture.md`, `Admin-Data-Flow.md`, `Forms-and-Validation.md` and
`API-Convention.md`; the older operational runbooks keep their own numbering and are out of scope.

---

## 5. References

| Subject                                                                                                                                        | Document                                                                                        |
| ---------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| HTTP contract: envelope, error codes, list query, `PATCH`/`DELETE`, `operationId` registry, server layering, client transport, endpoint recipe | [`API-Convention.md`](API-Convention.md) §1.1, §4.2, §5, §7, §9, §11                            |
| List and detail/edit/delete data flows                                                                                                         | [`Admin-Data-Flow.md`](Admin-Data-Flow.md) §3.6, §3.7                                           |
| Tokens and styling rules                                                                                                                       | [`UI-Architecture.md`](UI-Architecture.md) §3.3                                                 |
| Primitives available in `packages/ui`                                                                                                          | [`UI-Architecture.md`](UI-Architecture.md) §4                                                   |
| The form pattern (`useAppForm`)                                                                                                                | [`UI-Architecture.md`](UI-Architecture.md) §4.4                                                 |
| Per-page state plan                                                                                                                            | [`UI-Architecture.md`](UI-Architecture.md) §5                                                   |
| Pointer back to this checklist                                                                                                                 | [`UI-Architecture.md`](UI-Architecture.md) §6                                                   |
| CI quality gates                                                                                                                               | [`UI-Architecture.md`](UI-Architecture.md) §9                                                   |
| Validation schemas and error copy                                                                                                              | [`Forms-and-Validation.md`](Forms-and-Validation.md)                                            |
| State buckets, layering, styling, testing rules                                                                                                | [`react.coding-standards.md`](../../.roo/rules/react.coding-standards.md) §0, §2, §6.1, §7, §10 |
