# API keys list — pager spacing fix

**Date:** 2026-11-08 02:02 (Europe/Budapest)
**Plan:** [`docs/plans/2026-11-08--02-02-00-api-keys-table-pager-spacing-plan.md`](../plans/2026-11-08--02-02-00-api-keys-table-pager-spacing-plan.md)

## What changed

The pager under the stored API keys table had no gap to the table (0 px). The
card's `space-y-4` never reached the table/pager, because
[`Card`](../../packages/ui/src/components/card/Card.tsx:36) wraps its children
in its own element — the spacing classes only saw the `<h2>` and that wrapper.

The table component now

- passes the heading through the `Card` `title` slot (the card owns the
  header → body gap), and
- wraps the table body in a `space-y-4` group, so the table ↔ pager gap follows
  the page's existing 1 rem rhythm.

## Files

| File                                                                                                                     | Change                                                                                                                        |
| ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| [`apps/admin/src/pages/api-keys/ui/ApiKeysTable.tsx`](../../apps/admin/src/pages/api-keys/ui/ApiKeysTable.tsx)           | `Card title=…` + `space-y-4` body group around the table and the pager slot; doc comment records why the spacing lives there. |
| [`apps/admin/src/pages/api-keys/ui/ApiKeysTable.test.tsx`](../../apps/admin/src/pages/api-keys/ui/ApiKeysTable.test.tsx) | New regression test: the pager must be inside the table's `.space-y-4` group.                                                 |

## Gates

- `pnpm --filter @callback/admin exec vitest run src/pages/api-keys` — 110 tests pass.
- `pnpm --filter @callback/admin typecheck` — clean.
- `pnpm --filter @callback/admin lint` — clean.

No token, primitive API or page-state change, so
[`docs/Specs/UI-Architecture.md`](../Specs/UI-Architecture.md) needs no update.
