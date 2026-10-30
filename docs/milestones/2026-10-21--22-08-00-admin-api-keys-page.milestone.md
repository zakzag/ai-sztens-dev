# Milestone — Admin API key page (AIS-41)

**Date:** 2026-10-21 22:08
**Scope:** first real page of `apps/admin` — list + create form for `platform.api_keys`
**Plan:** [`2026-10-21--21-55-00-ais-41-admin-api-keys-page-implementation-plan.md`](../plans/2026-10-21--21-55-00-ais-41-admin-api-keys-page-implementation-plan.md:1)

## 1. Problem / feature

The admin SPA had a route shell, a placeholder page and a fully tested client foundation
(`@callback/api-client`, `@callback/ui`, feature hooks, date/error helpers) but **no page**.
AIS-41 delivers `/api-keys`: a table of the stored keys and a form to create one, with no
direct `fetch` and no colour literal.

## 2. Measured data / evidence

| Gate                                | Before | After               |
| ----------------------------------- | ------ | ------------------- |
| `apps/admin` tests                  | 46     | **87**              |
| `packages/ui` tests                 | 47     | **55**              |
| `tsc --noEmit` + `vite build`       | green  | green (142 modules) |
| `eslint .`                          | clean  | clean               |
| palette / colour-literal hits       | 0      | 0                   |
| direct `fetch(` in `apps/admin/src` | 0      | 0                   |

## 3. Design rationale

| #       | Decision                                                                                                       | Why                                                                                                                                                                          |
| ------- | -------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D29/D30 | `react-hook-form`, `@hookform/resolvers`, direct `zod` added; **zod pinned to v3**                             | the form bucket is RHF by rule; `zodResolver` must accept the zod-3 schema objects `@callback/shared` already exports — a second zod major would split the schema type space |
| D31     | two schemas: shared `createApiKeySchema` guards the _request_, page-local `apiKeyFormSchema` guards the _form_ | an `<input type="date">` produces `YYYY-MM-DD`, never an ISO instant, so one schema cannot serve both                                                                        |
| D32     | `toCreateApiKeyInput` **omits** empty `description`/`expiresAt`                                                | backend `forbidNonWhitelisted` + `IsISO8601` reject `''` and `null`                                                                                                          |
| D33     | `ApiKeyViewModel` has no `apiKey` field                                                                        | the token is in the response but must never reach the DOM; two tests assert its absence                                                                                      |
| D35/D43 | one of loading / error(+retry) / empty / success is always rendered                                            | “never a bare `null`”                                                                                                                                                        |
| D36     | 409 → `setError('identifier')`, everything else → page-level `Alert`                                           | a duplicate identifier is a field problem; decided on `ApiError.status`, never on message text                                                                               |
| D37     | `onCreated` (which the hook calls **after** awaiting `invalidateQueries`) resets the form                      | the list is already fresh when the success alert appears                                                                                                                     |
| D40     | a `Textarea` primitive was added to `packages/ui`                                                              | new visual concepts are built once in the kit, not inline in a page                                                                                                          |
| D41     | `/api-keys` added next to the placeholder `/`                                                                  | the dashboard does not exist yet; replacing `/` is a different ticket                                                                                                        |

Alternative rejected: putting the create form and the table in one component — they would have
mixed server state, form state and page feedback in a single file with no unit-testable logic.
Alternative rejected: `zod@4` — incompatible with the shared package's schemas and with
`@hookform/resolvers` v3.

## 4. Implementation

| Area    | Files                                                                                                                                                                                                                        |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Deps    | `apps/admin/package.json`                                                                                                                                                                                                    |
| UI kit  | `packages/ui/src/components/textarea/{Textarea.tsx,textarea.variants.ts,textarea.interface.ts}`, `packages/ui/src/index.ts`, `packages/ui/test/textarea.test.tsx`, `packages/ui/src/components/input/Input.tsx` (forwardRef) |
| Entity  | `apps/admin/src/entities/api-key/{api-key.interface.ts,api-key.mapper.ts,api-key.const.ts,api-key.mapper.test.ts}`                                                                                                           |
| Page    | `apps/admin/src/pages/api-keys/{ApiKeysPage.tsx,api-keys.const.ts,api-keys.interface.ts,api-keys.logic.ts,api-keys.logic.test.ts}`                                                                                           |
| Page UI | `apps/admin/src/pages/api-keys/ui/{ApiKeysTable.tsx,ApiKeysTable.test.tsx,ApiKeyForm.tsx,ApiKeyForm.test.tsx}`                                                                                                               |
| Routing | `apps/admin/src/App.tsx` (route + nav link)                                                                                                                                                                                  |
| Docs    | `docs/Specs/UI-Architecture.md` (layer map, primitives, state row, dependency table)                                                                                                                                         |

## 5. Outcome and how to verify

`/api-keys` lists the stored keys (name, identifier, description, expiry — “nincs lejárat” for
`null`) and creates new ones; a duplicate identifier lands on the identifier field; the token
value is never rendered.

```bash
pnpm --filter @callback/ui test && pnpm --filter @callback/ui build
pnpm --filter @callback/admin test && pnpm --filter @callback/admin lint && pnpm --filter @callback/admin build
```

Palette check (must print nothing):

```powershell
Get-ChildItem -Recurse -File -Include *.ts,*.tsx apps/admin/src,packages/ui/src |
  Select-String -Pattern '#[0-9a-fA-F]{3,8}','(bg|text|border|ring|from|to|via)-(slate|gray|zinc|neutral|stone|indigo|red|amber|green|emerald|blue)-[0-9]{2,3}'
```

Manual (local stack, admin on `localhost:5174`): open `/api-keys`, create a key, confirm the list
refreshes without a reload and the form resets; resubmit the same identifier and confirm the error
sits on the identifier input; create one key with and one without expiry and confirm the displayed
days match what was typed; in devtools confirm the `POST` body carries no `id`/`createdAt`/
`updatedAt` and no `null`/`''`.

## 6. Follow-ups

- No character counter on the 2000-character description (limit surfaces on submit).
- Delete / edit / rotate and list filtering need backend endpoints first.
- `zustand` is still not installed — the page needed no page-level UI state (D9).
- The AIS-57 story is still `To Do` although AIS-58…AIS-63 are `Done`.
