# AIS-79 — `packages/notifications` core store

**Date:** 2026-11-04 21:49 (Europe/Budapest)
**Ticket:** AIS-79 (subtask of AIS-86) · **Plan:** [`2026-11-04--21-33-00-ais-79-notifications-core-store-plan.md`](../plans/2026-11-04--21-33-00-ais-79-notifications-core-store-plan.md:1)

## What was requested

A framework-independent store that keeps notifications **and** system log entries in one source,
callable from plain TypeScript, with the UI as a mere subscriber. Observer store, ring buffer,
dedupe, redaction, store factory — no React, no DOM, no persistence in this ticket.

## What was built

New workspace package [`packages/notifications`](../../packages/notifications/package.json:1), source-only
(`exports` → `src/index.ts`, `build` = `tsc --noEmit`), Node environment tests, no runtime dependency.

| File | Content |
| ---- | ------- |
| [`notification.interface.ts`](../../packages/notifications/src/core/notification.interface.ts:1) | `NotificationLevel`, `NotificationSource`, `NotificationEntry`, `NotificationState`, `NotificationIdentity`, `EmitNotificationInput`, `NotificationStoreOptions`, `NotificationStore`, `NotificationEventKind`, `NotificationEventDefaults` |
| [`notification.const.ts`](../../packages/notifications/src/core/notification.const.ts:1) | `NOTIFICATION_MAX_ENTRIES = 500`, `NOTIFICATION_MAX_VISIBLE_TOASTS = 3`, `NOTIFICATION_DEDUPE_WINDOW_MS = 2000`, the level/source runtime mirrors, the redaction pattern and placeholder, the frozen `EMPTY_NOTIFICATION_STATE` |
| [`notification.logic.ts`](../../packages/notifications/src/core/notification.logic.ts:1) | `createNotificationId`, `trimEntries`, `trimToastIds`, `findDuplicate`, `bumpEntry`, `markEntriesRead`, `redactValue`, `redactRecord`, `toRedactedDetail` |
| [`notification.store.ts`](../../packages/notifications/src/core/notification.store.ts:1) | `createNotificationStore` — closure state, `emit` / `dismiss` / `markAllRead` / `clear` / `subscribe` / `getSnapshot` / `getServerSnapshot` |
| [`notification-event.const.ts`](../../packages/notifications/src/core/notification-event.const.ts:1) | event kinds plus their default `level` / `source` / `toast`, deliberately without any user-facing copy |
| [`src/index.ts`](../../packages/notifications/src/index.ts:1) | explicit value exports and `export type` — no `export *` |
| `test/**` | 3 suites + [`test/mocks/notification.fixtures.ts`](../../packages/notifications/test/mocks/notification.fixtures.ts:1) (fake clock, entry fixture) |

Repo wiring: [`package.json`](../../package.json:26) (`test` and `sonar:coverage` now include the package),
[`knip.json`](../../knip.json:15), [`sonar-project.properties`](../../sonar-project.properties:16).

## Decisions worth remembering

1. **The core declares its own `NotificationLevel`.** AIS-81's JSDoc and the spec claimed AIS-79 would
   alias `ToastLevel` from `@callback/ui`; that would pull React types and a DOM lib into a
   React-free package. Instead both packages pin the same five literals (`NOTIFICATION_LEVELS` here,
   `TOAST_LEVEL_GLYPHS` keys in the UI kit), each asserted by a test — a change on one side fails a
   suite instead of drifting silently. Same reasoning for `NOTIFICATION_MAX_VISIBLE_TOASTS` vs
   `TOAST_MAX_VISIBLE`.
2. **`toasts` holds at most three ids** (ticket decision 5), so a fourth toast drops the oldest *id*
   while its entry stays in the log. Consequence: dismissing the newest toast does not reveal a
   hidden fourth one.
3. **Both lists are newest-first**; `trimEntries` therefore drops from the end, matching
   `ToastStackProps.toasts` (AIS-81 D3).
4. **Dedupe window is inclusive** (`now - createdAt <= 2000`), which is the only rule that makes the
   2.0 s boundary testable without a tie-break; a bump refreshes `createdAt`, resets `read` and moves
   the toast id to the front.
5. **No snapshots without change**: `dismiss` of an unknown id, a second `markAllRead` and `clear` on
   an empty store return the same reference and notify nobody — required by `useSyncExternalStore`.
6. **`initialEntries` seeds `entries` only.** `toasts` always starts empty, which encodes "a reload
   must not resurrect an expired toast" inside AIS-79, so AIS-80 stays adapter-only and AIS-83 needs
   no store change.
7. **Redaction is owned by the store**: `emit` accepts `detail` as a string or a record, and a record
   is redacted and then serialised (`<redacted>` for `authorization`, `token`, `password`, `apiKey`,
   `api_key`, `secret`, …; `<unserializable detail>` when JSON cannot express it).
8. **Listener errors are isolated per subscriber** and forwarded to an injected `onListenerError`
   (default `console.error` reached through a tiny local `ConsoleLike` guard, so the package needs
   neither DOM nor Node types).

## Verification status

- Test suites and the pure helpers are covered case by case (level/source parity, dedupe at
  1900/2000/2001 ms, ring-buffer and toast caps, snapshot identity, server snapshot, restored
  entries, redaction of every forbidden key, circular detail).
- **Not yet executed in this session**: the VS Code terminal reported no output/completion for any
  command (no shell integration), and a probe file write produced nothing, so
  `pnpm install`, `pnpm --filter @callback/notifications build|test`, `pnpm typecheck`,
  `pnpm quality` and `pnpm test` must be run before the change is considered green.

## Follow-ups

- AIS-80: `StorageLike` adapter (`load` / `save` / `clear`, versioned envelope, cap 200).
- AIS-83: `useSyncExternalStore` hooks, `notify` facade, `NotificationHost` + timers.
- AIS-84/85: admin wiring (query/mutation cache, `HttpEvent`) and the `ApiKeyForm` retrofit.
