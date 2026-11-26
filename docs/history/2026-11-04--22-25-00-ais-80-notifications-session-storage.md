# AIS-80 — `packages/notifications`: sessionStorage persistence (change summary)

**Date:** 2026-11-04 22:25 (Europe/Budapest)
**Ticket:** AIS-80 (subtask of AIS-86) · **Plan:** [`2026-11-04--22-14-17-ais-80-notifications-session-storage-persistence-plan.md`](../plans/2026-11-04--22-14-17-ais-80-notifications-session-storage-persistence-plan.md:1)
**Predecessor:** AIS-79 (core store) — the store already exposed `initialEntries`, so it was **not modified**.

## What was added

The log produced by `createNotificationStore` now has a `sessionStorage` mirror: an F5 keeps the
history, a new tab or a new session does not inherit it, and no server-side storage is involved.
The adapter is deliberately **not** bound to the store — AIS-83 composes `load()` → `initialEntries`,
`store.subscribe` → `save()`, `pagehide` → `flush()` in the React provider.

| File                                                                                                     | Change                                                                                                                   |
| -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| [`src/core/notification.const.ts`](../../packages/notifications/src/core/notification.const.ts:57)        | **changed** — `NOTIFICATION_STORAGE_KEY` = `aisztens.notifications.v1`, `NOTIFICATION_STORAGE_VERSION` (typed `1`), `NOTIFICATION_STORAGE_MAX_ENTRIES` = 200 |
| [`src/core/notification.storage.interface.ts`](../../packages/notifications/src/core/notification.storage.interface.ts:1) | **new** — `StorageLike`, `PersistedNotificationLog`, `PersistedEnvelopeReadResult` / `…Accepted` / `…Rejected`, `PersistedEnvelopeRejection`, `NotificationWriteScheduler` / `…Cancel`, `NotificationStorageOptions`, `NotificationStorage` |
| [`src/core/notification.storage.logic.ts`](../../packages/notifications/src/core/notification.storage.logic.ts:1) | **new** — pure `toPersistedEnvelope(entries, cap)`, `fromPersistedEnvelope(raw)`, `isPersistedEntry` and the field guards |
| [`src/core/notification.storage.ts`](../../packages/notifications/src/core/notification.storage.ts:1)    | **new** — `createNotificationStorage`: coalesced writes, skipped duplicate payloads, `flush()`, `clear()`, silent degradation, memory-only mode |
| [`src/index.ts`](../../packages/notifications/src/index.ts:1)                                            | **changed** — explicit value and type exports (no `export *`)                                                              |
| [`test/mocks/notification-storage.fixtures.ts`](../../packages/notifications/test/mocks/notification-storage.fixtures.ts:1) | **new** — `createTestStorage` (read/write failure switches, counters), `createTestScheduler`, payload builders              |
| `test/notification-storage.logic.test.ts`                                                                | **new** — 25 cases: envelope shape, cap, round-trip, `missing` / `malformed-json` / `wrong-version` / `wrong-shape`, per-field rejections, tolerated extras |
| `test/notification-storage.test.ts`                                                                      | **new** — 20 cases: empty load, round-trip, key removal on rejection, throwing read, failing write then retry, one `setItem` per tick, `flush`, duplicate-payload skip, `clear` cancelling the pending write, memory-only, custom key/cap |

Docs: this file, the [milestone](../milestones/2026-11-04--22-25-00-ais-80-notifications-session-storage.milestone.md:1)
and a new `sessionStorage` block plus a header note in [`docs/Specs/UI-Architecture.md`](../Specs/UI-Architecture.md:9).

## Decisions that shaped the code

1. **Validation is a value, not an exception.** `fromPersistedEnvelope` returns
   `{ ok: true, entries } | { ok: false, reason }`; the adapter uses `reason` only to decide whether
   `removeItem` makes sense (`missing` → nothing to remove). Nothing throws, which is why this ticket
   introduces no custom error class — documented deviation from the ts-rules.
2. **All-or-nothing validation.** One broken entry rejects the whole payload (25 lines of hand-written
   guards, no `zod`: the package has zero dependencies and 9 field checks do not justify the first one).
   A partially restored history would silently rewrite what happened.
3. **The cap is enforced twice.** `toPersistedEnvelope` trims on write, `load()` trims again on read —
   a hand-written or older payload may exceed 200. Both reuse `trimEntries`, so the mirror and the
   in-memory ring buffer keep entries in the same order.
4. **Writes are coalesced through an injected scheduler.** The package builds with `lib: ["ES2022"]`,
   so `requestAnimationFrame` is a type error inside it; the default is a microtask, AIS-83 injects the
   rAF-based scheduler. The pending write always holds the **latest** entries.
5. **`flush()` was added to the ticket's minimal API.** A queued rAF does not run on `pagehide`, and the
   last entry before a reload must not be lost.
6. **Duplicate payloads are skipped.** Dismissing a toast notifies the store without changing `entries`;
   without the guard every dismissal would cost a synchronous `setItem`.
7. **`clear()` cancels the pending write first.** Otherwise a queued flush re-creates the key right after
   "Törlés" — the exact opposite of the intent.
8. **Failure is silent and retryable.** A throwing `setItem` leaves the payload *unwritten* (so the next
   save retries) and the app keeps working memory-only; a throwing `getItem` yields `[]` and skips
   `removeItem`, because a storage that throws on read would throw on remove too.

## Verification

```powershell
pnpm --filter @callback/notifications build   # tsc --noEmit, green
pnpm --filter @callback/notifications test    # 139 tests in 5 files, green (45 new)
pnpm typecheck                                # every workspace, green
pnpm quality:dead-code                        # knip, green
pnpm quality:tokens                           # 0 violations
pnpm quality:field-errors                     # 0 violations
```

Boundary check (`findstr /S /R` over `packages/notifications/src`): the only hits for
`window` / `sessionStorage` / `requestAnimationFrame` are **JSDoc comments**; no `export *`, no `: any`.

## Pre-existing red gates, not caused by this ticket

Both come from the AIS-131 slice and reproduce with AIS-80's files reverted (nothing in this change
touches `apps/admin`):

- `pnpm quality:layers` → `no-page-to-foreign-feature`: `pages/api-keys/ui/ApiKeyEditForm.tsx` imports
  `features/forms/use-app-form.ts`, which is not in the rule's allowed list (`features/api`,
  `features/error-surface`, own feature). Needs an AIS-131 decision: extend the allow-list or move the
  form hook.
- `pnpm test` → `apps/admin/src/pages/api-keys/ui/ApiKeyDetailCard.test.tsx:71`,
  `getByText(EXPIRY_NONE_LABEL)` finds two nodes (the label appears in more than one place in the card).

`pnpm test` therefore stops at the admin step; shared, api-client, notifications and ui are green in
that same run.

## Note on formatting

`pnpm exec prettier --check` flags the whole package — the pre-existing AIS-79 files as well — because
`.prettierrc` uses the default `printWidth: 80` while the package is written at ~100 columns. No
format gate runs in CI (`format:check` is not part of `qa:all` or the workflow), so the new files follow
the surrounding style instead of reformatting AIS-79's files inside an AIS-80 commit.

## Follow-ups

- AIS-83: provider wires `load` → `initialEntries`, `subscribe` → `save`, `pagehide` → `flush` with an
  rAF scheduler.
- AIS-84/85: nothing here; capture and `ApiKeyForm` are untouched.
- Optional later: a `PageVisibility`-driven flush, `version: 2` migration, cross-tab sync (all explicitly
  out of scope in phase 1).
