# AIS-131 follow-up — layer gate and detail-card test fix

**Date:** 2026-11-04 22:40 (Europe/Budapest) · **Ticket:** AIS-131 (follow-up of the CRUD reference slice)
**Trigger:** the AIS-80 close-out (`f966245`) found `pnpm quality` and `pnpm test` red on `main`, both
inside the AIS-131 slice, both reproducible without any AIS-80 file.

## What was broken

| Gate | Symptom |
| --- | --- |
| `pnpm quality:layers` | `no-page-to-foreign-feature: apps/admin/src/pages/api-keys/ui/ApiKeyEditForm.tsx → apps/admin/src/features/forms/use-app-form.ts` (1 violation, 88 modules) |
| `pnpm test` (admin) | `ApiKeyDetailCard.test.tsx:71` → `getByText(EXPIRY_NONE_LABEL)` threw "Found multiple elements", so `pnpm test` stopped at the admin step |

## Root causes

1. **The gate was right, the allow-list was stale.** `SHARED_FEATURES` in
   [``.dependency-cruiser.rules.cjs`](.dependency-cruiser.rules.cjs:38) still listed only `api` and
   `error-surface`. `features/forms` appeared with AIS-115 as the single form pattern every page
   composes, but its `config` (`useAppForm` + resolver + field-error mapping) is a **hook**, so it
   cannot live in `lib` (React + RHF) and cannot be a page's own feature. AIS-131 was simply the first
   page that consumed it cross-page.
2. **The test asserted on a sentence the card renders twice by design.** `ApiKeyDetailCard` shows the
   expiry verdict twice: `StatusBadge` (`data-status`, label = `EXPIRY_ACTIVE_LABEL` /
   `EXPIRY_NONE_LABEL`) and the `expiresAt` row of the `DescriptionList`
   (`viewModel.expiresAtLabel`, which for a key without expiry is the same `nincs lejárat`). The
   `active` case passed only because a real expiry renders a date in the list, so the two nodes never
   collided there — the test was accidentally green.

## Changes

| File | Change |
| --- | --- |
| [`.dependency-cruiser.rules.cjs`](.dependency-cruiser.rules.cjs:38) | `SHARED_FEATURES` → `(?:api|error-surface|forms)`, with a JSDoc entry explaining why `forms` is shared infrastructure (hook, AIS-115, first consumer AIS-131) |
| [`ApiKeyDetailCard.test.tsx`](apps/admin/src/pages/api-keys/ui/ApiKeyDetailCard.test.tsx:58) | both badge assertions use the `{ selector: '[data-status]' }` option; the no-expiry case additionally asserts `getAllByText(...)` has length **2**, so the intentional duplication is documented instead of hidden |
| [`docs/Specs/UI-Architecture.md`](docs/Specs/UI-Architecture.md:686) | §9.1 lists the three shared features and records why `forms` joined the list; the AIS-131 header block notes the fix |

No production component changed: the card's double rendering is deliberate (badge = verdict, list =
data), only the test and the rule were wrong.

## Verification

```powershell
pnpm quality:layers     # no dependency violations found (88 modules, 140 dependencies)
node --test scripts/quality/layers.test.mjs   # 3/3: negative fixture still red, positive + apps/admin green
pnpm --filter @callback/admin test            # 34 files, 350 tests passed
pnpm quality            # layers + knip + tokens + field-errors, all green
pnpm test               # full matrix green: shared, api-client, notifications, ui, admin (350), api (433)
```

`pnpm test:quality` itself cannot run on this machine (Node 20.19.2): the script calls
`node --test "scripts/quality/*.test.mjs"`, and glob support in `--test` needs Node ≥ 22. The single
layer suite was run per-file as a substitute; the script is unchanged and works on the project's
documented Node 24.

## Follow-ups

- `prettier --check` still flags the notifications package (`printWidth: 80` default vs ~100-column
  code) — a `chore(format)` commit of its own, not part of a feature or fix ticket.
