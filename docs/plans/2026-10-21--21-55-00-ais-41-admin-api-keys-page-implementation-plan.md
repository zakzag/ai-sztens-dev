# AIS-41 — Admin API key page (list + create form)

**Jira:** AIS-41 (Subtask of AIS-30 — "Admin: AI API kulcs tároló oldal (teljes stack példa)")
**Date:** 2026-10-21
**Status:** implemented (2026-10-21 22:08) — see [history](../history/2026-10-21--22-08-00-ais-41-admin-api-keys-page.md) and [milestone](../milestones/2026-10-21--22-08-00-admin-api-keys-page.milestone.md)
**Related:** [combined AIS-57 + AIS-41 plan](2026-10-21--20-40-00-ais-57-ais-41-admin-api-keys-page-plan.md),
[`docs/Specs/UI-Architecture.md`](../Specs/UI-Architecture.md:1),
[`.roo/rules/react.coding-standards.md`](../../.roo/rules/react.coding-standards.md:1),
[AIS-40 backend plan](2026-10-21--18-25-00-ais-40-api-keys-backend-plan.md)

This document is the **execution plan of Phase 6** of the combined plan. It exists separately
because the combined plan covers seven phases (AIS-58 … AIS-63 + AIS-41) and the page itself
now needs a file-by-file, test-by-test breakdown.

---

## 1. Starting state

Everything this ticket depends on already exists and is green; the page is the only missing
piece.

| Area                        | Fact                                                                                                                                                              | Evidence                                                                                                                                                             |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Backend endpoints           | `GET /api/api-keys`, `GET /api/api-keys/:identifier`, `POST /api/api-keys`; global prefix `/api`                                                                  | [`api-keys.controller.ts:36`](../../apps/api/src/api-keys/api-keys.controller.ts:36), [`main.ts:38`](../../apps/api/src/main.ts:38)                                  |
| Error codes                 | 400 validation (`forbidNonWhitelisted`), 404 unknown identifier, 409 duplicate identifier                                                                         | [`api-keys.service.ts:71`](../../apps/api/src/api-keys/api-keys.service.ts:71)                                                                                       |
| Client service              | `apiKeysService.list()` / `.create(input)` — no `fetch` outside `packages/api-client`                                                                             | [`api-keys.service.ts`](../../packages/api-client/src/api-keys/api-keys.service.ts:1), [`services/api-client.ts:48`](../../apps/admin/src/services/api-client.ts:48) |
| Shared schemas              | `apiKeySchema`, `apiKeyListSchema`, `createApiKeySchema` + limit constants                                                                                        | [`api-key.schema.ts:50`](../../packages/shared/src/schemas/api-key.schema.ts:50), [`api-key.const.ts:17`](../../packages/shared/src/schemas/api-key.const.ts:17)     |
| Query hooks                 | `useApiKeysQuery()` → `{ apiKeys, isLoading, error, refetch }`; `useCreateApiKeyMutation({ onCreated })` → `{ isPending, isSuccess, error, createApiKey, reset }` | [`use-api-keys.ts:31`](../../apps/admin/src/features/api-keys/use-api-keys.ts:31)                                                                                    |
| Query keys                  | `API_KEYS_QUERY_KEYS.all` / `.list` in the feature const file                                                                                                     | [`api-keys.const.ts:16`](../../apps/admin/src/features/api-keys/api-keys.const.ts:16)                                                                                |
| 409 mapping                 | `isIdentifierConflict()` / `toIdentifierFieldError()` — decided on `ApiError.status`, never on text                                                               | [`api-keys.logic.ts:17`](../../apps/admin/src/features/api-keys/api-keys.logic.ts:17)                                                                                |
| Date helpers                | `toExpiryIso(dateInput)` (`undefined` for empty, `RangeError` for invalid) / `formatExpiry(iso \| null)`                                                          | [`date.ts:42`](../../apps/admin/src/lib/date.ts:42)                                                                                                                  |
| Error text                  | `toErrorMessage(error)` — status-driven, Hungarian sentences                                                                                                      | [`error-message.ts:53`](../../apps/admin/src/lib/error-message.ts:53)                                                                                                |
| UI primitives               | `Button`, `Input` (`label`/`error`/`hint`), `Card`, `Table`+`Table*` cells, `Badge`, `Alert` (`title`, variants), `cn`                                            | [`packages/ui/src/index.ts:6`](../../packages/ui/src/index.ts:6)                                                                                                     |
| **Missing primitive**       | there is **no multi-line input** — `description` is a 2000-char free text                                                                                         | `packages/ui/src/components/` listing                                                                                                                                |
| Admin deps                  | `@callback/{shared,api-client,ui}`, `@tanstack/react-query`, `react-router-dom`; **`react-hook-form`, `zod`, `@hookform/resolvers` are not installed**            | [`apps/admin/package.json:18`](../../apps/admin/package.json:18)                                                                                                     |
| Routes                      | `/` → `PlaceholderPage`, `/calls` → inline `<p>`, `*` → not found; nav contains a single "Hívások" link                                                           | [`App.tsx:33`](../../apps/admin/src/App.tsx:33)                                                                                                                      |
| `src/app/`, `src/entities/` | do not exist yet; `entities/api-key/` is created by this ticket                                                                                                   | `apps/admin/src/` listing                                                                                                                                            |
| Test harness                | vitest + RTL + jsdom, `TZ=Europe/Budapest` in setup, doubles live in `src/test/mocks/**`                                                                          | [`setup.ts`](../../apps/admin/src/test/setup.ts:1), [`api-keys.mock.ts:91`](../../apps/admin/src/test/mocks/api-keys.mock.ts:91)                                     |

**Dependency check:** AIS-41 gate was AIS-57. AIS-58 … AIS-63 are all `Done`, so the technical
prerequisite is satisfied even though the AIS-57 story itself is still `To Do` — that story
still needs its own status sync by the reporter.

---

## 2. Scope

**In**

- `react-hook-form` + `@hookform/resolvers` + direct `zod` in `apps/admin`.
- A `Textarea` primitive in `packages/ui` (needed by `description`, see D40).
- `entities/api-key/` view model + pure mapper.
- `pages/api-keys/` page folder: `ApiKeysPage.tsx`, `api-keys.const.ts`, `api-keys.interface.ts`,
  `api-keys.logic.ts`, `ui/ApiKeysTable.tsx`, `ui/ApiKeyForm.tsx`.
- `/api-keys` route + nav entry in `App.tsx`.
- Unit + component tests for all of the above.
- Documentation: `docs/Specs/UI-Architecture.md` (dependency + state table), history, milestone,
  combined-plan status row.

**Out**

- Delete / edit / rotate a key (no endpoint exists).
- Search, filter, sort, pagination, column selection.
- Rendering the `apiKey` value anywhere, reveal/copy affordances.
- Expiry badges or "expiring soon" indicators.
- Admin authentication guard on the API, `zustand` session store.
- Migrating `apps/web` to `packages/ui`, unifying the backend `api-keys.const.ts` with the
  shared limits (already a documented follow-up).

---

## 3. Decisions

Numbering continues from the combined plan (D28 was the last one).

| #   | Decision                                                                                                                                                                                                       | Why                                                                                                                                                                                                                                                                 |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D29 | `react-hook-form`, `@hookform/resolvers` and a **direct** `zod` dependency are added to `apps/admin` in this ticket                                                                                            | the form bucket is RHF by rule; the schema is zod; a transitive `zod` from `@callback/shared` cannot be imported directly. `UI-Architecture.md` already lists all three as “planned — added by AIS-41”, and the dependency table must be updated in the same change |
| D30 | zod stays on **v3** (`zod@^3.24.1`, matching `packages/shared`) and `@hookform/resolvers` on the v3 line                                                                                                       | `packages/shared` already ships schema objects built with zod 3; a second zod major in the admin bundle would create two incompatible schema types at the resolver boundary                                                                                         |
| D31 | Two schemas, one truth: the **wire** payload uses the shared `createApiKeySchema`; the **form** values use a page-local `apiKeyFormSchema` (date input is `YYYY-MM-DD` or empty, texts are trimmed)            | the shared schema validates the _request_ (ISO instant, optional fields); an `<input type="date">` value would never satisfy it. Validation messages stay Hungarian in the page layer                                                                               |
| D32 | Conversion `form values → CreateApiKeyInput` is a pure function in `pages/api-keys/api-keys.logic.ts` (`toCreateApiKeyInput`), and it **omits** empty `description` / `expiresAt`                              | `forbidNonWhitelisted` + `IsISO8601` reject `''` and `null`; `toExpiryIso` returns `undefined` for “no expiry”, which `exactOptionalPropertyTypes`-safe spreading drops                                                                                             |
| D33 | `ApiKeyViewModel` deliberately **has no `apiKey` field**, and the mapper never copies it                                                                                                                       | the token is in the response, but the UI must not hold or render it (combined plan D5). A mapper test asserts the key is absent from the view model                                                                                                                 |
| D34 | The list key is `apiKey.id`; the identifier is only a display value                                                                                                                                            | `id` is the DB-generated uuid; the lookup route uses `identifier` and is not used by this page                                                                                                                                                                      |
| D35 | The page has **no Zustand store**; the only states are the query state and the RHF state                                                                                                                       | there is no page-level UI state (no filters/tabs/sort) — combined plan D9. This row already exists in the `UI-Architecture.md` state table                                                                                                                          |
| D36 | 409 handling: `catch` in the submit handler → `toIdentifierFieldError(error)` → `setError('identifier', …)` when non-null, **otherwise** the page-level `Alert variant="danger"` shows `toErrorMessage(error)` | field problem goes to the field; anything else is page-level. Never message-text matching                                                                                                                                                                           |
| D37 | Success flow: `createApiKey` → hook awaits `invalidateQueries` → `onCreated` → `reset()` + page-level `Alert variant="success"`; the alert is cleared on the next submit and by `mutation.reset()`             | the list must already be fresh when the confirmation appears (hook contract), and a stale “success” banner over a new attempt would be a lie                                                                                                                        |
| D38 | `apiKey` value input is a plain `type="text"` field with `autoComplete="off"` and `spellCheck={false}`, plus a `hint`                                                                                          | explicitly requested by the AIS-41 contract note; masking the value the user is pasting in would make the field unusable                                                                                                                                            |
| D39 | Form labels, hints, empty/error copy are Hungarian, in `pages/api-keys/api-keys.const.ts`; the identifier conflict sentence is reused from `features/api-keys/api-keys.const.ts`                               | the admin UI copy is Hungarian today (`Hívások`, placeholder page) and the conflict message already lives in exactly one place                                                                                                                                      |
| D40 | A `Textarea` primitive is added to `packages/ui` (component + variants + interface + export + test) instead of using a single-line `Input` for `description`                                                   | 2000 characters in a one-line input is not usable; the React rules forbid building a new visual concept inline in a page (§7.4), so it is built once in the kit                                                                                                     |
| D41 | The route is `/api-keys` inside `ProtectedLayout`, with a nav link labelled **“API kulcsok”** placed next to “Hívások”; `/` keeps the placeholder page                                                         | the dashboard does not exist yet; replacing `/` would leave the shell without a landing route and is a different ticket                                                                                                                                             |
| D42 | The table renders `description` through a “—” fallback for `null`/empty and `expiresAt` through `formatExpiry`                                                                                                 | “no expiry” must read as a sentence, not as an empty cell; `null` handling stays in `lib/date.ts`                                                                                                                                                                   |
| D43 | During `isLoading` the table area shows a `Card` loading text; the error state shows an `Alert` **with a retry `Button`** wired to `refetch`                                                                   | all four async states are mandatory; a retry the user cannot trigger is not a retry                                                                                                                                                                                 |
| D44 | Submit button is disabled while `isPending` and shows a pending label                                                                                                                                          | double submit would create two keys — the costliest possible UI bug on this page                                                                                                                                                                                    |

---

## 4. Work items

Order matters only where a file is consumed by the next one.

| #   | File                                                        | Change                                                                                                                                                                   |
| --- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | `apps/admin/package.json`                                   | deps: `react-hook-form`, `@hookform/resolvers`, `zod@^3.24.1`                                                                                                            |
| 2   | `packages/ui/src/components/textarea/textarea.interface.ts` | new: `TextareaProps` (`id`, `label`, `error?`, `hint?`, rows)                                                                                                            |
| 3   | `packages/ui/src/components/textarea/textarea.variants.ts`  | new: sunken-input tokens, focus ring, invalid state (same recipe as `input.variants.ts`)                                                                                 |
| 4   | `packages/ui/src/components/textarea/Textarea.tsx`          | new: label + error + `aria-invalid` + `aria-describedby`, `forwardRef` for RHF                                                                                           |
| 5   | `packages/ui/src/index.ts`                                  | export `Textarea`, `textareaVariants`, `TextareaProps` (explicit, no barrel)                                                                                             |
| 6   | `packages/ui/test/textarea.test.tsx`                        | new: render, label association, error/id wiring, variant classes                                                                                                         |
| 7   | `apps/admin/src/entities/api-key/api-key.interface.ts`      | new: `ApiKeyViewModel` (`id`, `name`, `identifier`, `description`, `expiresAtLabel`) — **no `apiKey`**                                                                   |
| 8   | `apps/admin/src/entities/api-key/api-key.mapper.ts`         | new: `toApiKeyViewModel(dto: ApiKey): ApiKeyViewModel`, pure, uses `formatExpiry`                                                                                        |
| 9   | `apps/admin/src/pages/api-keys/api-keys.interface.ts`       | new: `ApiKeyFormValues`, `ApiKeysTableProps`, `ApiKeyFormProps`                                                                                                          |
| 10  | `apps/admin/src/pages/api-keys/api-keys.const.ts`           | new: form field ids/labels/hints, column headers, empty/loading/error copy, success text, defaults                                                                       |
| 11  | `apps/admin/src/pages/api-keys/api-keys.logic.ts`           | new: `apiKeyFormSchema` (name/identifier/apiKey required, limits from `@callback/shared`, identifier pattern, date `YYYY-MM-DD` or empty), `toCreateApiKeyInput(values)` |
| 12  | `apps/admin/src/pages/api-keys/ui/ApiKeysTable.tsx`         | new: loading / empty / error(+retry) / success branches, `key={id}`, never renders `apiKey`                                                                              |
| 13  | `apps/admin/src/pages/api-keys/ui/ApiKeyForm.tsx`           | new: `useForm<ApiKeyFormValues>` + `zodResolver`, 5 fields, pending state, 409 → `setError`, success/error alerts, `onCreated` → reset                                   |
| 14  | `apps/admin/src/pages/api-keys/ApiKeysPage.tsx`             | new: composition (header → table → form), owns the two hooks, passes `onCreated`                                                                                         |
| 15  | `apps/admin/src/App.tsx`                                    | `<Route path="/api-keys" element={<ApiKeysPage />} />` + nav `<Link to="/api-keys">API kulcsok</Link>`                                                                   |
| 16  | `apps/admin/src/entities/api-key/api-key.mapper.test.ts`    | new                                                                                                                                                                      |
| 17  | `apps/admin/src/pages/api-keys/api-keys.logic.test.ts`      | new                                                                                                                                                                      |
| 18  | `apps/admin/src/pages/api-keys/ui/ApiKeysTable.test.tsx`    | new                                                                                                                                                                      |
| 19  | `apps/admin/src/pages/api-keys/ui/ApiKeyForm.test.tsx`      | new                                                                                                                                                                      |

`apps/admin/src/test/mocks/api-keys.mock.ts` already provides the fixtures and the service double
(`API_KEYS_SERVICE_MOCK`, `resetApiKeysServiceMock`) — extend it only if a new fixture is needed
(e.g. a 409 `ApiError`), never define mocks inside a test file.

---

## 5. Required tests

Every test uses the mocked service at the module boundary (`vi.mock('services/api-client.js')`)
and `src/test/mocks/query-client.mock.tsx` as the provider wrapper — no network, no real timers.

| Level     | File                     | Cases                                                                                                                                                                                                                                                                                                                                                                                      |
| --------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Unit      | `api-key.mapper.test.ts` | maps name/identifier/description/expiry; `null` description → fallback; `null` expiry → “nincs lejárat”; **view model has no `apiKey` key**                                                                                                                                                                                                                                                |
| Unit      | `api-keys.logic.test.ts` | `toCreateApiKeyInput`: trims name/identifier; drops empty description; drops empty expiry; keeps both when filled; converts a date input to an ISO instant (local midnight, `Europe/Budapest`); rejects an invalid date via the schema                                                                                                                                                     |
| Unit      | `api-keys.logic.test.ts` | `apiKeyFormSchema`: missing name / identifier / apiKey; identifier with a space or slash; `name` over 200 chars; `description` over 2000 chars; valid minimal values                                                                                                                                                                                                                       |
| Component | `ApiKeysTable.test.tsx`  | loading state; empty state; error state renders the message **and** calls `refetch` on retry click; success renders one row per fixture with the formatted expiry; the rendered DOM contains **no** fixture `apiKey` value                                                                                                                                                                 |
| Component | `ApiKeyForm.test.tsx`    | submit blocked by empty required fields (no service call); successful submit calls `createMock` with the exact mapped payload, resets the fields and shows the success alert; 409 `ApiError` → message on the **identifier** field and **no** page-level alert; 500 → page-level alert with `toErrorMessage` text; button disabled and labelled as pending while the mutation is in flight |

---

## 6. Verification

```bash
pnpm install
pnpm --filter @callback/ui test
pnpm --filter @callback/admin test
pnpm --filter @callback/admin lint
pnpm --filter @callback/admin build
rg "#[0-9a-fA-F]{3,8}|(bg|text|border|ring|from|to|via)-(slate|gray|zinc|neutral|stone|indigo|red|amber|green|emerald|blue)-[0-9]{2,3}" apps/admin/src packages/ui/src
rg "fetch\(" apps/admin/src
```

Both `rg` runs must return **zero** matches.

Manual checklist (`pnpm dev`, admin on `localhost:5174`, local API + DB up):

1. `/api-keys` → empty state when the table is empty; the seeded keys otherwise.
2. Create a key → 201, list refreshes **with** the new row, form resets, success alert appears.
3. Re-submit the same identifier → the error appears on the **identifier field**, not page-level.
4. Create a key without expiry → the row reads “nincs lejárat”; with a date → the same calendar
   day is shown locally (no ±1 day shift).
5. Browser devtools: the `POST` body contains only `name`, `identifier`, `description?`,
   `apiKey`, `expiresAt?` — never `id`, `createdAt`, `updatedAt`, `null`, or `''`.
6. Inspector: no `sk-…` token value appears anywhere in the table markup.

---

## 7. Risks

| Risk                                                                                       | Mitigation                                                                                                                      |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| A second zod major lands in the bundle and `zodResolver` rejects the shared schema objects | D30 pins zod v3 and `@hookform/resolvers` v3; `pnpm build` fails loudly if the types diverge                                    |
| `expiresAt` shifts by the timezone offset                                                  | D32 reuses `toExpiryIso`; the setup already pins `TZ=Europe/Budapest`; the logic test asserts the round-trip                    |
| The 409 is mapped by message text                                                          | D36 + the `toIdentifierFieldError` unit test; only `ApiError.status === 409` is accepted                                        |
| `apiKey` leaks into the view model or the DOM                                              | D33 + two tests (mapper, table) assert its absence                                                                              |
| Tailwind does not emit the new `Textarea` classes                                          | `packages/ui` is already covered by `@source` in `apps/admin/src/index.css`; the `build` gate plus a manual visual check        |
| `tsc --noEmit` fails on vitest globals in the new test files                               | the admin `tsconfig.json` already includes the test files with vitest types (AIS-62); keep the new tests in the same folders    |
| RHF dev-time `act()` warnings pollute the test output                                      | submit through `userEvent` and `await waitFor` on the observable effect (alert text / service call), not on internal form state |

---

## 8. Documentation obligations (after implementation)

| File                                                                        | Content                                                                                                                                                                                                     |
| --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/history/<YYYY-MM-DD--HH-ii-ss>-ais-41-admin-api-keys-page.md`         | implementation narrative + verification output                                                                                                                                                              |
| `docs/milestones/<YYYY-MM-DD--HH-ii-ss>-admin-api-keys-page.milestone.md`   | decisions D29–D44, changed files, verify steps (multi-file feature → milestone required)                                                                                                                    |
| `docs/Specs/UI-Architecture.md`                                             | dependency table: `react-hook-form`, `zod`, `@hookform/resolvers` → installed; layer map: `pages/api-keys/`, `entities/api-key/` exist; state row already present, adjust wording if the page state changes |
| `docs/plans/2026-10-21--20-40-00-ais-57-ais-41-admin-api-keys-page-plan.md` | §10 row 6 → done                                                                                                                                                                                            |
| this file                                                                   | status → implemented                                                                                                                                                                                        |

---

## 9. Definition of Done (ticket)

- [ ] `/api-keys` lists the stored keys through `useApiKeysQuery` and creates new ones through
      `useCreateApiKeyMutation` — no `fetch` in `apps/admin/src`.
- [ ] After a successful create the list shows the new row without a page reload.
- [ ] All four async states exist for the list, and the form shows field-level, page-level and
      success feedback.
- [ ] A 409 lands on the `identifier` field.
- [ ] `expiresAt` round-trips without a timezone shift; `null` renders as “nincs lejárat”.
- [ ] No color literal / palette utility in `apps/admin/src` and `packages/ui/src`.
- [x] `pnpm --filter @callback/admin test`, `lint`, `build` and `pnpm --filter @callback/ui test`
      are green.
- [x] Tests from §5 exist and cover the error and edge cases (87 admin + 55 ui tests).
- [x] Docs from §8 are updated.

---

## 10. Implementation log (2026-10-21 22:08)

| Gate                                                                 | Result                                                   |
| -------------------------------------------------------------------- | -------------------------------------------------------- |
| `pnpm --filter @callback/ui test`                                    | 8 files, **55** tests green (47 before)                  |
| `pnpm --filter @callback/ui build`                                   | `tsc --noEmit` green                                     |
| `pnpm --filter @callback/admin test`                                 | 10 files, **87** tests green (46 before)                 |
| `pnpm --filter @callback/admin lint`                                 | clean                                                    |
| `pnpm --filter @callback/admin build`                                | `tsc --noEmit` + `vite build` green (142 modules)        |
| palette / colour-literal check (`apps/admin/src`, `packages/ui/src`) | **0** hits                                               |
| direct `fetch(` in `apps/admin/src`                                  | **0** hits (the 2 `refetch(` matches are TanStack's API) |

**Deviations from this plan**

- **D45 — `Input` gained `forwardRef`.** Not listed in §4, but without it react-hook-form cannot
  focus the first invalid field and `Textarea` would have been the only field doing it. Markup,
  classes and props are unchanged; the 7 existing `Input` tests still pass.
- **`api-keys.const.ts` imports only the _type_ `ApiKeyFormValues`**, so the dependency stays
  `logic → const` and never `const → logic`; the form defaults are literals in the const file
  instead of a re-export from the logic module (avoids a runtime import cycle).
- **Prettier is not used as a gate**: `prettier --check` warns on 46 files, most of them untouched
  by this change, so `--write` would produce a large unrelated diff. `eslint` + `tsc` are the gates.
- The manual browser checklist of §6 still needs a running local API + DB; everything that can be
  verified without them is covered by the tests above.
