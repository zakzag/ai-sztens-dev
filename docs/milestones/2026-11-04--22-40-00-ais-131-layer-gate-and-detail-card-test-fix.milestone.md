# AIS-131 follow-up — two red gates, two different mistakes

**Date:** 2026-11-04 22:40 (Europe/Budapest) · **Ticket:** AIS-131

## Problem

The AIS-80 close-out discovered that `main` was already red: `pnpm quality:layers` reported one
violation and `pnpm test` stopped in `apps/admin`. Neither was related to AIS-80 — both came from the
AIS-131 reference slice and reproduced with AIS-80's files reverted.

## Evidence

```text
error no-page-to-foreign-feature:
  apps/admin/src/pages/api-keys/ui/ApiKeyEditForm.tsx
  → apps/admin/src/features/forms/use-app-form.ts
x 1 dependency violations (1 errors, 0 warnings). 88 modules, 140 dependencies cruised.
```

```text
src/pages/api-keys/ui/ApiKeyDetailCard.test.tsx:71:19
TestingLibraryElementError: Found multiple elements with the text: nincs lejárat
```

## Root causes

| Symptom | Cause |
| --- | --- |
| Layer violation | `SHARED_FEATURES` (`.dependency-cruiser.rules.cjs`) listed only `api` and `error-surface`. `features/forms` arrived with AIS-115 as the one form pattern every page composes; it is a **hook**, so it cannot live in `lib` (React + RHF) and is not a page's own feature. AIS-131 was the first page to consume it cross-page, so the allow-list — not the import — was stale. |
| Duplicate text | The card renders the expiry verdict **twice on purpose**: a `StatusBadge` (`data-status` + verdict label) and the `expiresAt` row of the `DescriptionList`, which for a key without expiry carries the same sentence. The `active` case passed only because an existing expiry renders a date in the list, so the two nodes never collided. The test used an unqualified `getByText`. |

Rejected alternatives: moving `features/forms` into `lib` (it is React state + RHF, `lib` is pure);
removing the second rendering of the label from the card (badge = verdict, list = data — both are
useful); weakening the rule or the test with `queryAllByText[0]` (hides the ambiguity instead of
naming it).

## Solution

| File | Change |
| --- | --- |
| `.dependency-cruiser.rules.cjs` | `SHARED_FEATURES` → `(?:api|error-surface|forms)` + JSDoc explaining why `forms` is shared infrastructure |
| `apps/admin/src/pages/api-keys/ui/ApiKeyDetailCard.test.tsx` | badge assertions use `getByText(label, { selector: '[data-status]' })`; the no-expiry case also pins `getAllByText(...)` to length 2, documenting the intentional duplication |
| `docs/Specs/UI-Architecture.md` | §9.1 lists the three shared features and the reason `forms` joined; AIS-131 header note updated |

No production component changed.

## Outcome and how to verify

```powershell
pnpm quality:layers                            # 0 violations (88 modules)
node --test scripts/quality/layers.test.mjs    # 3/3 — negative fixture still fails, positive + apps/admin pass
pnpm --filter @callback/admin test             # 34 files / 350 tests
pnpm quality                                   # layers, knip, tokens, field-errors — all green
pnpm test                                      # full matrix green (admin 350, api 433, + shared/api-client/notifications/ui)
```

Gate-integrity check: the negative fixture still fails, so the allow-list extension did not disarm
`no-page-to-foreign-feature`; only one more feature name became legal.

## Follow-ups

- `pnpm test:quality` cannot run on Node 20 locally (glob in `node --test` needs Node ≥ 22); run the
  suites per file there, or use the documented Node 24.
- `prettier --check` still reports the whole `packages/notifications` tree (default `printWidth: 80`
  vs ~100-column code) — a separate `chore(format)` commit.
