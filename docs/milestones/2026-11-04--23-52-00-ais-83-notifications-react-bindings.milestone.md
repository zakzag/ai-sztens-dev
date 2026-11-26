# AIS-83 — Notification React bindings: provider, hooks and host

**Date:** 2026-11-04 23:52 (Europe/Budapest) · **Ticket:** AIS-83 (subtask of AIS-86)
**Related:** AIS-79 (store), AIS-80 (storage mirror), AIS-81 (`Toast`/`ToastStack`), AIS-82 (`LogDrawer`)

## 1. Problem / feature

The notification subsystem was complete but unusable: a framework-free store (AIS-79), a
`sessionStorage` mirror (AIS-80) and two dumb presentational primitives (AIS-81, AIS-82) existed,
while every *decision* — when a toast expires, how many log rows a panel shows, who registers the
global error listeners, when read state is cleared — had no owner. Mounting it required an app to
write that policy itself, per app.

AIS-83 adds the binding layer: `<NotificationProvider>` + `<NotificationHost />`, four hooks, a
`notify` facade, and the timer/paging policy in exactly one place.

## 2. Measured data / evidence

| Fact | Value |
| ---- | ----- |
| Package tests before / after | 139 → **201** (62 new, all green) |
| New source files | 8 in `src/react/` |
| `tsconfig` boundary | `src/core` compiles under `lib: ["ES2022"]` (no DOM, no JSX) **and** the whole tree under `DOM` + `react-jsx` |
| Timer table | `success`/`info` 4 000 ms, `warning` 6 000 ms, `error`/`system` `null` (sticky) |
| Paging | 20 rows on open, +50 per "Korábbiak betöltése", cap = filtered buffer |
| Lockfile delta | +25 lines, only the `packages/notifications` importer block — no version drift |

## 3. Design rationale

**Why a second export instead of one barrel.** `@callback/notifications` must stay importable from a
Node service or a framework-free test; making the root export re-export React would silently drag
React types into every consumer. Hence `"."` = core, `"./react"` = bindings, and `tsconfig.core.json`
compiles only `src/core` so the boundary is enforced by the compiler and not by review.

**Why the store and mirror are created in `useState` initialisers.** `sessionStorage` reads are
synchronous; doing the restore in an effect would render an empty log first and flash the restored
entries one frame later. Lazy initialisers give one `load()` per mount, before the first paint.

**Why derivation lives in `useMemo`, never in `getSnapshot`.** `useSyncExternalStore` compares the
snapshot by reference. A `getSnapshot` that builds a filtered array allocates on every call and
re-renders forever. Subscribing to the store's own stable snapshot and projecting in `useMemo` is the
only shape that both stays correct and stays cheap.

**Why timers belong to the host.** `Toast` gets `onPause`/`onResume` and nothing else; the host keeps a
`Map<id, timeout>`. Pausing clears the timer and resuming restarts a **full** TTL — remaining-time
bookkeeping needs a second clock and buys nothing, because a toast the user is hovering must not
vanish anyway. `document.hidden` clears every timer; becoming visible restarts what is still on screen.

**Why the drawer window is `useState`.** It is transient page UI: not server data, not linkable, not
shared. Putting it in the store would make the store own layout; putting it in a global Zustand store
would be a dependency for no reason (the rule in `.roo/rules/react.coding-standards.md` §6).

**Why `logNavigation` was dropped.** Router logging needs the app's `react-router` callbacks; the
package would have accepted a prop it could not honour. Deferred to AIS-84 where the router lives.

**Alternatives rejected:** (a) a module-level `notify` singleton — binds to whichever provider mounted
last, wrong for two apps or two tests; (b) exporting the context object — lets a component copy state
out of the single subscription; (c) putting the TTLs in `packages/ui` — the primitives must stay dumb.

## 4. Implementation

```text
packages/notifications/src/react/
  notification-react.interface.ts   provider props, Notifier, LogDrawerController, timer/scope types
  notification-react.const.ts       TTL table, page sizes, default source/locale, runtime message
  notification-react.logic.ts       9 pure helpers (TTL, projection, filter/window, capture, rAF)
  notification-react.errors.ts      MissingNotificationProviderError
  notification.context.tsx          provider: lazy store+mirror, save/pagehide, error capture
  notification.facade.ts            createNotifier(store), useNotifier()
  use-notifications.ts              useToasts, useLogDrawer, useLogEntries, useToastTimers
  NotificationHost.tsx              ToastStack + LogDrawer composition
  index.ts                          explicit exports
packages/notifications/{package.json,tsconfig.json,tsconfig.core.json,vitest.config.ts}
docs/Specs/UI-Architecture.md       AIS-83 changelog block, §4 binding table, §7 dependency row
```

Tests live in `test/react/` (logic, facade, hooks with fake timers, host render) with every fixture,
storage double and DOM helper in `test/mocks/react/`.

## 5. Outcome and how to verify

An app mounts one pair and gets toasts, a log panel, restored history, global error capture and a
React-free notifier:

```tsx
<NotificationProvider includeDetails={import.meta.env.DEV}>
  <App />
  <NotificationHost />
</NotificationProvider>
```

```bash
pnpm --filter @callback/notifications test    # 201 passed
pnpm --filter @callback/notifications build    # core config first, then DOM+JSX
pnpm quality:dead-code && pnpm quality:tokens  # both clean
```

Manual check: emit four `notify.info(...)` calls in a browser — three cards appear, newest first, the
oldest id is dropped from the *stack* while its log entry survives; an `error` card never expires on
its own; the edge tab shows an unseen badge that clears when the panel opens.

## 6. Follow-ups

- **AIS-84:** admin wiring (`main.tsx` / providers), `QueryCache` + `MutationCache` callbacks, the
  `HttpClient` `onEvent` hook, router navigation logging behind `logNavigation`.
- **`pnpm typecheck` is red in `apps/api`** (`api-keys.repository.ts:92`, `TS7053`) — pre-existing and
  unrelated; needs its own ticket.
- **Toolchain:** the sandbox's pnpm 9 cannot read the pnpm-12 lockfile and corepack 0.31 cannot launch
  pnpm 12 (`bin/pnpm.cjs` vs `bin/pnpm.mjs`); installs currently go through
  `node .../pnpm/12.16.1/bin/pnpm.mjs`. Fix once at the toolchain level.
