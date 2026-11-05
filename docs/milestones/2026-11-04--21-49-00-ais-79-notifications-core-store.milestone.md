# AIS-79 — framework-free notification + log store (`packages/notifications`)

**Date:** 2026-11-04 21:49 (Europe/Budapest) · **Ticket:** AIS-79 (subtask of AIS-86)

## 1. Problem / feature

Every admin form reported its own result (`ApiKeyForm`'s inline `Alert`, `mutation.isSuccess`) and
nothing survived the next render. A toast layer and a live log panel were needed, but both must read
the **same** data — otherwise dismiss/clear has to be kept in sync in two directions. AIS-79 delivers
that single source: a store callable from plain TypeScript (service, hook, guard), with the UI as a
subscriber.

## 2. Evidence

- Before this change `packages/` contained only `api-client`, `shared`, `ui`; there was no
  notification store anywhere.
- The UI kit's `toast/` primitives (AIS-81) were already shipped without a store, so `ToastStack`
  rendered only caller-supplied props.
- No toast library was adopted: the log store is required regardless, and a library would introduce a
  second state to synchronise (base plan, decision N1).

## 3. Root cause / design rationale

| Decision | Alternative rejected | Why |
| -------- | -------------------- | --- |
| Core declares its own `NotificationLevel`; both packages pin the five literals in tests | Alias `ToastLevel` from `@callback/ui` | The UI kit has React as a peer; a type-only import would drag `@types/react` and the DOM lib into a React-free package. |
| `createNotificationStore(options?)` factory | Package-level singleton | The owning app decides the lifetime; two apps or two tests must never share state. |
| Ring buffer of 500 entries, newest first | Unbounded array | Bounded memory and render cost for a whole debugging session; newest-first matches the stack and the drawer. |
| Dedupe: same `level` + `message` within 2 s bumps `repeatCount` | Always append a new entry | A retry loop must not paint 20 identical toasts. |
| `toasts` holds at most 3 ids; the entry stays in the log | Drop the entry with the toast | The log is the debugging record; only the visual layer is capped. |
| Redaction inside the store (`detail` record → redacted → serialised) | Trust every emitter to redact | One forgotten call site would leak a token into a persisted log. |
| `initialEntries` seeds `entries` only | Restore toasts too | A reload must never resurrect a toast that already expired (this keeps AIS-80 adapter-only). |
| Deterministic ids `ntf-<time36>-<seq36>` | `crypto.randomUUID()` | Tests get reproducible ids, and the core needs neither `crypto` nor Node types. |

Two consequences are documented on purpose: dismissing the newest toast does **not** reveal a hidden
fourth one (its entry is log-only), and changing the level vocabulary requires editing two pinned
lists in two packages.

## 4. Solution / implementation

New source-only workspace package `@callback/notifications` (Node-environment vitest, lcov →
`coverage/notifications`).

| File | Change |
| ---- | ------ |
| [`packages/notifications/package.json`](../../packages/notifications/package.json:1) | package skeleton, `exports` → `src/index.ts`, `build` = `tsc --noEmit` |
| [`tsconfig.json`](../../packages/notifications/tsconfig.json:1) | `lib: ES2022` only — a `window`/`document` reference fails the build |
| [`src/core/notification.interface.ts`](../../packages/notifications/src/core/notification.interface.ts:1) | types: entry, state, emit input, store contract, options |
| [`src/core/notification.const.ts`](../../packages/notifications/src/core/notification.const.ts:1) | caps, dedupe window, level/source mirrors, redaction pattern, frozen empty state |
| [`src/core/notification.logic.ts`](../../packages/notifications/src/core/notification.logic.ts:1) | pure helpers: id, trimming, duplicate lookup, bump, mark-read, redaction |
| [`src/core/notification.store.ts`](../../packages/notifications/src/core/notification.store.ts:1) | `createNotificationStore` — closure state, stable snapshots, isolated listener errors |
| [`src/core/notification-event.const.ts`](../../packages/notifications/src/core/notification-event.const.ts:1) | event kinds + default `level`/`source`/`toast`, no user-facing copy |
| [`src/index.ts`](../../packages/notifications/src/index.ts:1) | explicit exports, no `export *` |
| `test/**` (3 suites + fixtures) | every branch: caps, dedupe boundaries, snapshot identity, redaction, restored entries |
| [`package.json`](../../package.json:26), [`knip.json`](../../knip.json:15), [`sonar-project.properties`](../../sonar-project.properties:16) | package added to `test`, `sonar:coverage`, knip and Sonar sources/tests |
| [`docs/Specs/UI-Architecture.md`](../Specs/UI-Architecture.md:221) | toast note corrected (no alias) + new core subsection + dependency row |

## 5. Outcome and how to verify

`createNotificationStore()` yields a store with `emit` / `dismiss` / `markAllRead` / `clear` /
`subscribe` / `getSnapshot` / `getServerSnapshot`; `getSnapshot()` is referentially stable while
nothing changes, which is what `useSyncExternalStore` will need in AIS-83.

```powershell
pnpm install
pnpm --filter @callback/notifications build
pnpm --filter @callback/notifications test
Select-String -Path packages/notifications/src/core/*.ts -Pattern 'react|@callback/ui|window|document|localStorage'   # must be empty
Select-String -Path packages/notifications/src/index.ts -Pattern 'export \*'                                          # must be empty
pnpm typecheck
pnpm quality
```

## 6. Follow-ups

- AIS-80 — `sessionStorage` adapter (versioned envelope, cap 200, injected `StorageLike`); it needs no
  store change because `initialEntries` already exists.
- AIS-83 — React bindings, `notify` facade, `NotificationHost` and the auto-dismiss timers.
- AIS-84/85 — admin capture (query/mutation cache, `HttpEvent`) and the `ApiKeyForm` retrofit.
- A parity guard between `NOTIFICATION_LEVELS` and `packages/ui`'s `ToastLevel` is test-level only; a
   shared vocabulary package would remove the duplication if a third consumer appears.
