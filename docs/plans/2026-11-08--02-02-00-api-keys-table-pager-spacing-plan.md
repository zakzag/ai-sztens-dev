# API keys list — pager spacing fix (plan)

**Created:** 2026-11-08 02:02 (Europe/Budapest)
**Scope:** [`apps/admin/src/pages/api-keys/ui/ApiKeysTable.tsx`](../../apps/admin/src/pages/api-keys/ui/ApiKeysTable.tsx)

## Problem

On `/api-keys` the pager (page buttons + page-size selector) sat flush against the
bottom of the keys table — a 0 px gap, so the pager looked glued to the last row.

## Root cause

[`Card`](../../packages/ui/src/components/card/Card.tsx:36) renders its children
inside its own wrapper `<div>`, so a `space-y-*` utility passed to the card only
applies to the card's _direct_ children: the hand-written `<h2>` and that single
wrapper. The table and the pager were both inside the wrapper, where nothing
provided vertical spacing — hence `space-y-4` on the card was a no-op for them.

## Decision

- Use the `Card` `title` slot instead of a hand-written `<h2>`, so the card owns
  the header → body gap (`mt-4`).
- Give the card **body** its own `space-y-4` group; the table and the pager are
  direct children of it, so the table ↔ pager gap is the same 1 rem rhythm the
  rest of the page uses.
- No new primitive, no new token, no spacing literal: only existing Tailwind
  spacing scale utilities.
- Regression test asserts the pager is inside the table's `.space-y-4` group.

## Alternatives rejected

| Option                                                 | Why not                                                                                                       |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| Add `mt-4` to the `Pagination` primitive               | Bakes one page's layout into a shared primitive; every other pager would inherit a margin it did not ask for. |
| Change `Card` so `className` reaches the inner wrapper | Primitive-level behaviour change with unclear blast radius across every card consumer for a one-page fix.     |
| Inline `margin-top` on the pager slot in the page      | Page-level style escape hatch; the group container already expresses the intent.                              |

## Verification

- `pnpm --filter @callback/admin exec vitest run src/pages/api-keys` — 110 tests green.
- `pnpm --filter @callback/admin typecheck` and `lint` — clean.
