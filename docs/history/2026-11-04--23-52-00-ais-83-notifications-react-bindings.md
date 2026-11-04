# AIS-83 — React bindings for `@callback/notifications`

**Date:** 2026-11-04 23:52 (Europe/Budapest)
**Ticket:** AIS-83 (`packages/notifications: React bindings — provider, useSyncExternalStore hooks, notify facade, NotificationHost + timers`), subtask of AIS-86
**Plan:** [`docs/plans/2026-11-04--23-12-00-ais-83-notifications-react-bindings-plan.md`](../plans/2026-11-04--23-12-00-ais-83-notifications-react-bindings-plan.md)
**Milestone:** [`docs/milestones/2026-11-04--23-52-00-ais-83-notifications-react-bindings.milestone.md`](../milestones/2026-11-04--23-52-00-ais-83-notifications-react-bindings.milestone.md)

## What changed

New React layer in `packages/notifications`, behind a second export `@callback/notifications/react`:

| File | Role |
| ---- | ---- |
| `src/react/notification-react.interface.ts` | `NotificationProviderProps`, `Notifier`, `NotifyOptions`, `LogDrawerController`, `ToastTimerControls`, `AnimationFrameScope`, TTL types |
| `src/react/notification-react.const.ts` | `TOAST_TTL_MS_BY_LEVEL` (4 s / 6 s / sticky), `LOG_INITIAL_PAGE = 20`, `LOG_PAGE_STEP = 50`, default source/locale, runtime error message |
| `src/react/notification-react.logic.ts` | pure helpers: `resolveToastTtl`, `toToastItems`, `filterEntries`, `sliceWindow`, `hasMoreEntries`, `countUnseen`, `toRuntimeDetail`, `createRafScheduler`, `formatDefaultTimestamp` |
| `src/react/notification-react.errors.ts` | `MissingNotificationProviderError` |
| `src/react/notification.context.tsx` | `NotificationProvider` (store + mirror + global listeners) and the internal `useNotificationContext` |
| `src/react/notification.facade.ts` | `createNotifier(store)` (no React) and `useNotifier()` |
| `src/react/use-notifications.ts` | `useToasts`, `useLogDrawer`, `useLogEntries`, `useToastTimers` |
| `src/react/NotificationHost.tsx` | `ToastStack` + `LogDrawer` composition, timers, paging window |
| `src/react/index.ts` | explicit exports of the whole surface |

Supporting changes: `package.json` (`./react` export, `react`/`react-dom` peers, `@callback/ui` dependency,
testing libraries as dev-only, `build` runs two configs), new `tsconfig.core.json` (DOM-free core gate),
widened `tsconfig.json` (`DOM`, `jsx: react-jsx`), `vitest.config.ts` (`test/**/*.test.tsx`, coverage on `.tsx`).

Tests: 62 new (`test/react/*`), 201 total in the package; mocks/fixtures in `test/mocks/react/`
(`createEntry*`, `createRecordingStorage`, `createNotificationWrapper`, event + visibility helpers).

## Decisions worth remembering

- **Subpath export.** The root export stays framework-free; the core cannot regress into React by accident.
- **Two tsconfigs.** `tsconfig.core.json` compiles `src/core` with `lib: ["ES2022"]` only, so a `window`
  reference there is a compile error rather than a review finding.
- **One `storage.load()`.** Store and mirror are created in `useState` lazy initialisers: synchronous
  restore, no loading flash.
- **Derivation in `useMemo`.** `getSnapshot` is the store's own stable snapshot; deriving inside it would
  allocate per call and loop.
- **Timers only in the host.** Pause clears the timer, resume restarts a full TTL, `document.hidden`
  pauses everything.
- **`logNavigation` deliberately deferred** to AIS-84 (needs the app's router callbacks).
- **No module-level `notify` singleton** — it would bind to whichever provider mounted last.

## Verification

```
pnpm --filter @callback/notifications test    # 201 passed
pnpm --filter @callback/notifications build    # tsconfig.core.json + tsconfig.json
pnpm quality:dead-code                         # clean
pnpm quality:tokens                            # 0 violations
```

`pnpm typecheck` fails in `apps/api` (`src/api-keys/api-keys.repository.ts:92`, `TS7053`) — pre-existing,
untouched by this change and unrelated (no lockfile or dependency drift: the lockfile diff is only the
`packages/notifications` importer block).

## Environment note

The sandbox runs pnpm 9.15.4 / Node 20 while the repo pins pnpm 12.16.1 / Node ≥ 24, so `pnpm install`
had to be driven through `node .../corepack/v1/pnpm/12.16.1/bin/pnpm.mjs install` (the corepack shim of
that pnpm version expects `bin/pnpm.cjs`, but pnpm 12 ships `bin/pnpm.mjs`). Worth fixing once, in the
toolchain, not per ticket.
