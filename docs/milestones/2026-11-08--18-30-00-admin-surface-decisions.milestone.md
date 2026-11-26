# Admin surface decisions — docs follow code, code follows the rule (AIS-174)

**Date:** 2026-11-08 · **Ticket:** AIS-174 (parent AIS-170) · **History:**
[`2026-11-08--18-30-00-ais-174-admin-surface-decisions.md`](../history/2026-11-08--18-30-00-ais-174-admin-surface-decisions.md)

## Problem

AIS-171/172/173 unified the admin page surface in code (`PageShell`, three route-mounted overlays, the
delete inside the read-only window). Three documents still described the opposite, and two pages had no
tests at all. A second entity page would therefore have copied a pattern the code no longer follows.

## Evidence (measured before the change)

| Claim                                                                          | Reality found in the repo                                                                                                                                               |
| ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "the list header action is `Button` + `Button.icon`" (AIS-155 `D9`)            | [`ApiKeysPage.tsx:83`](../../apps/admin/src/pages/api-keys/ApiKeysPage.tsx:83) uses `<Link className={buttonVariants()}>` — the code was right, the decision text wrong |
| "the legacy detail page stays and the delete navigates to it" (AIS-155 `D8`)   | removed by AIS-173; the delete is a local-`useState` `ConfirmDialog` inside the view overlay                                                                            |
| "standard list = `DataTable` + `Pagination` + `EmptyState` **with an action**" | [`ApiKeysTable.tsx:106`](../../apps/admin/src/pages/api-keys/ui/ApiKeysTable.tsx:106) renders copy only — a documented gap, not a bug                                   |
| "`LoginPage` test: invalid authentication → message"                           | [`LoginPage.tsx`](../../apps/admin/src/pages/LoginPage.tsx:1) `return`ed silently on an empty password: no message, no token, no feedback                               |
| page copy can live in a sibling `*.const.ts`                                   | the layer gate rule `no-flat-page-to-page` forbids a flat page from importing anything under `src/pages/`                                                               |

## Rationale

1. **Where the code is justifiably better, the document moves.** A create overlay is a navigation to a
   real URL, so a link is the correct control (open in a new tab, copy the link, middle click).
2. **Where the document is the rule, the code does not get a vote.** The confirmation-dialog exception
   (AIS-173) stays as written; nothing in this change re-opens it.
3. **A missing capability is a decision, not a defect.** No search/filter UI, no per-row action, no
   empty-state CTA — writing the absence down is cheaper than re-discovering it per page.
4. **History is not rewritten.** The AIS-155 plan keeps its text and gains an appended note; dated
   removal sentences stay even though they name a deleted file.

## Implementation

| File                                                                                   | Change                                                                                                                                                                                          |
| -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`LoginPage.tsx`](../../apps/admin/src/pages/LoginPage.tsx:1)                          | exported copy constants in the page module; empty/whitespace password now renders `LOGIN_EMPTY_PASSWORD_MESSAGE` through `Input.error` (`aria-invalid` + `aria-describedby`), cleared on typing |
| [`PlaceholderPage.tsx`](../../apps/admin/src/pages/PlaceholderPage.tsx:1)              | title/subtitle extracted to exported constants                                                                                                                                                  |
| `LoginPage.test.tsx`, `PlaceholderPage.test.tsx`                                       | new: 8 cases total (token written to `sessionStorage`, no write on an empty password, message clears, `h1` + build footer inside the shell)                                                     |
| [`New-Admin-Page.md`](../../docs/Specs/New-Admin-Page.md:1)                            | header entry; standard-list definition (step 11); complete route-path source rule (step 12); documented exception table in _Do not_ + the flat-file copy rule                                   |
| [`UI-Architecture.md`](../../docs/Specs/UI-Architecture.md:1)                          | §4.0 header-action rule (navigable → link, not navigable → button); §4.2 label vs. path split with a pointer; §5 standard list + documented gaps                                                |
| [AIS-155 plan](../plans/2026-11-07--14-46-00-ais-155-entity-dialog-standard-plan.md:1) | appended note superseding `D9`, `D8` and the routes row — no line above it edited                                                                                                               |

## Outcome and how to verify

```bash
pnpm quality            # layers, knip, tokens, themes, field-errors, docs -> 0 violations
pnpm test:quality       # on Node >= 24.9; on Node 20 expand the glob by hand (87 tests)
pnpm typecheck && pnpm -r build && pnpm -r lint && pnpm test
```

- Admin suite: **48 files / 547 tests** (was 46 / 539).
- `Select-String 'ApiKeyDetailPage' docs\Specs` returns only dated removal sentences — no link, no route,
  no instruction; each hit is classified in the history entry.
- Manual: `/login` + empty submit shows the Hungarian message and writes no token; with a password the
  token lands in the tab's `sessionStorage` and the guarded dashboard opens.

## Follow-ups

- Search/filter UI on the list (`useListParams` already parses `search`) — separate ticket.
- Optional `EmptyState` call-to-action on the list, if the product wants two create entry points.
- Demote the second `**Utolsó frissítés:**` block at `UI-Architecture.md:166` (a 2160-character single
  line) to a dated block; deferred because the edit surface is unsafe for one line that long.
- Real authentication (`POST /api/auth/login`, cookie session) — the login page is still a placeholder.
