# 2026-10-21 22:08 — AIS-41 admin API key page implemented

## What was asked

Implement AIS-41: an admin page under `apps/admin/src/pages/` that lists the stored API keys
through `packages/api-client` + a `features/` hook, renders them in a table (name, identifier,
description, expiry) and creates new keys through a form (name, identifier, description, key
value, expiry) using `packages/ui` primitives, with a route/nav entry in `App.tsx`.

Plan: [`docs/plans/2026-10-21--21-55-00-ais-41-admin-api-keys-page-implementation-plan.md`](../plans/2026-10-21--21-55-00-ais-41-admin-api-keys-page-implementation-plan.md:1)
(decisions D29–D44).

## Changes

| #   | File                                                                                                                             | Change                                                                                                                                     |
| --- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | [`apps/admin/package.json`](../../apps/admin/package.json:18)                                                                    | deps: `react-hook-form ^7.54.2`, `@hookform/resolvers ^3.9.1`, `zod ^3.24.1` (v3 line — D29/D30)                                           |
| 2   | [`packages/ui/src/components/textarea/textarea.interface.ts`](../../packages/ui/src/components/textarea/textarea.interface.ts:1) | new: `TextareaProps` (`id`, `label`, `error?`, `hint?` + native attrs, `rows`)                                                             |
| 3   | [`packages/ui/src/components/textarea/textarea.variants.ts`](../../packages/ui/src/components/textarea/textarea.variants.ts:1)   | new: CVA recipe — same sunken surface as `Input`, `resize-y`, `invalid` variant                                                            |
| 4   | [`packages/ui/src/components/textarea/Textarea.tsx`](../../packages/ui/src/components/textarea/Textarea.tsx:1)                   | new: label + error/hint + `aria-invalid`/`aria-describedby`, ref forwarded (D40)                                                           |
| 5   | [`packages/ui/src/components/input/Input.tsx`](../../packages/ui/src/components/input/Input.tsx:1)                               | now a `forwardRef` component, so react-hook-form can focus the first invalid field (behaviour and markup unchanged)                        |
| 6   | [`packages/ui/src/index.ts`](../../packages/ui/src/index.ts:21)                                                                  | exports `Textarea`, `textareaVariants`, `TextareaProps`, `TextareaVariants`                                                                |
| 7   | [`packages/ui/test/textarea.test.tsx`](../../packages/ui/test/textarea.test.tsx:1)                                               | new: 8 tests (label, typing, hint, error, aria omissions, `invalid`, rows, disabled)                                                       |
| 8   | [`apps/admin/src/entities/api-key/api-key.interface.ts`](../../apps/admin/src/entities/api-key/api-key.interface.ts:1)           | new: `ApiKeyViewModel` — **no `apiKey` field** (D33)                                                                                       |
| 9   | [`apps/admin/src/entities/api-key/api-key.const.ts`](../../apps/admin/src/entities/api-key/api-key.const.ts:1)                   | new: `EMPTY_VALUE_LABEL` (`—`)                                                                                                             |
| 10  | [`apps/admin/src/entities/api-key/api-key.mapper.ts`](../../apps/admin/src/entities/api-key/api-key.mapper.ts:1)                 | new: `toApiKeyViewModel`, `toApiKeyViewModels` — drops the token, formats expiry via `lib/date.ts`                                         |
| 11  | [`apps/admin/src/entities/api-key/api-key.mapper.test.ts`](../../apps/admin/src/entities/api-key/api-key.mapper.test.ts:1)       | new: 7 tests, including “the token never survives the mapping”                                                                             |
| 12  | [`apps/admin/src/pages/api-keys/api-keys.const.ts`](../../apps/admin/src/pages/api-keys/api-keys.const.ts:1)                     | new: page/table/form copy, field ids, labels, hints, validation messages, form defaults                                                    |
| 13  | [`apps/admin/src/pages/api-keys/api-keys.interface.ts`](../../apps/admin/src/pages/api-keys/api-keys.interface.ts:1)             | new: `ApiKeyFormValues`, `ApiKeysTableProps`                                                                                               |
| 14  | [`apps/admin/src/pages/api-keys/api-keys.logic.ts`](../../apps/admin/src/pages/api-keys/api-keys.logic.ts:1)                     | new: `apiKeyFormSchema` (limits from `@callback/shared`), `toCreateApiKeyInput` (omits empty optional fields — D31/D32)                    |
| 15  | [`apps/admin/src/pages/api-keys/api-keys.logic.test.ts`](../../apps/admin/src/pages/api-keys/api-keys.logic.test.ts:1)           | new: 21 tests (schema edge cases + payload shape + date conversion)                                                                        |
| 16  | [`apps/admin/src/pages/api-keys/ui/ApiKeysTable.tsx`](../../apps/admin/src/pages/api-keys/ui/ApiKeysTable.tsx:1)                 | new: loading / error(+retry) / empty / success branches (D35/D43), never renders the token                                                 |
| 17  | [`apps/admin/src/pages/api-keys/ui/ApiKeysTable.test.tsx`](../../apps/admin/src/pages/api-keys/ui/ApiKeysTable.test.tsx:1)       | new: 6 tests incl. the retry call and the “no token in the DOM” assertion                                                                  |
| 18  | [`apps/admin/src/pages/api-keys/ui/ApiKeyForm.tsx`](../../apps/admin/src/pages/api-keys/ui/ApiKeyForm.tsx:1)                     | new: RHF + `zodResolver`, 5 fields, 409 → `setError('identifier')`, page-level `Alert`, `onCreated` → `reset`, pending label (D36/D37/D44) |
| 19  | [`apps/admin/src/pages/api-keys/ui/ApiKeyForm.test.tsx`](../../apps/admin/src/pages/api-keys/ui/ApiKeyForm.test.tsx:1)           | new: 7 tests (blocked submit, exact payload, reset, description+expiry, 409 field error, 5xx page error, pending)                          |
| 20  | [`apps/admin/src/pages/api-keys/ApiKeysPage.tsx`](../../apps/admin/src/pages/api-keys/ApiKeysPage.tsx:1)                         | new: composition — query hook, memoised view models, table + form                                                                          |
| 21  | [`apps/admin/src/App.tsx`](../../apps/admin/src/App.tsx:37)                                                                      | `/api-keys` route inside `ProtectedLayout` + “API kulcsok” nav link (D41)                                                                  |

## Verification (all run locally)

```text
pnpm install                                        → +3 packages (zod 3.25.76, RHF 7.90.0, resolvers 3.10.0)
pnpm --filter @callback/ui test                     → 8 files, 55 tests passed
pnpm --filter @callback/ui build                    → tsc --noEmit OK
pnpm --filter @callback/admin test                  → 10 files, 87 tests passed
pnpm --filter @callback/admin lint                  → eslint . clean
pnpm --filter @callback/admin build                 → tsc --noEmit + vite build OK (142 modules)
palette check (apps/admin/src, packages/ui/src)     → 0 hits
direct fetch( in apps/admin/src                   → 0 hits (2 `refetch(` matches are the TanStack API)
```

Test growth: admin went from 46 to 87 tests, `packages/ui` from 47 to 55.

## Notes and deviations

- **`Input` gained `forwardRef`.** Not in the plan's file list, but without it react-hook-form
  cannot focus the first invalid field, and `Textarea` would have been the only field with that
  behaviour. Markup, classes and props are unchanged; the existing 7 `Input` tests still pass.
- **Two `refetch(` hits in the `fetch(` grep.** They are `query.refetch()` in the feature hook and
  its test — the intended TanStack call, not a network access.
- **Prettier is not a gate here.** `prettier --check` warns on 46 files including ones this change
  never touched (`alert.interface.ts`, `Table.tsx`, …), so running `--write` would have produced a
  large unrelated diff. Lint + `tsc` are the enforced gates.
- Circular-import avoidance: `pages/api-keys/api-keys.const.ts` imports only the _type_ from
  `api-keys.interface.ts`, so the dependency stays `logic → const` and never `const → logic`.

## Follow-ups

- Manual browser verification (empty state, create, duplicate → 409 on the field, expiry
  round-trip) still needs a running local API + DB — see §6 of the plan.
- `description` is a `Textarea` now, but there is still no character counter; the 2000-char limit
  is only reported after submit.
- Delete/edit/rotate and list filtering remain out of scope (no backend endpoints yet).
- AIS-57 story status still reads `To Do` although all its subtasks are `Done`.
