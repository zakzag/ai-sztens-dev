# AIS-83 — plan only (React bindings for `@callback/notifications`)

**Date:** 2026-11-04 23:13 (Europe/Budapest)
**Type:** planning only — no source file changed
**Ticket:** AIS-83 (`packages/notifications: React bindings — provider, useSyncExternalStore hooks, notify facade, NotificationHost + timers`), subtask of AIS-86

## What was done

Read the ticket and the current tree, then wrote the implementation plan:

- [`docs/plans/2026-11-04--23-12-00-ais-83-notifications-react-bindings-plan.md`](../plans/2026-11-04--23-12-00-ais-83-notifications-react-bindings-plan.md)

## What the plan settles

- **Package boundary:** the root export `@callback/notifications` stays framework-free; the React layer
  ships as a second subpath `@callback/notifications/react`. `react`/`react-dom` become peers,
  `@callback/ui` becomes a real dependency.
- **Compile-time core guard:** a second config `tsconfig.core.json` (`lib: ["ES2022"]`, `src/core`) runs
  in `build` next to the widened `tsconfig.json` (`DOM` + `jsx: react-jsx`), so a `window`/`document`
  leak into `src/core` is a compile error, not a review finding.
- **Restore without a flash:** store and storage are built in `useState` lazy initialisers, so
  `storage.load()` runs once, synchronously, before the first paint (AIS-80's reserved seam).
- **Only timers in the host:** 4 s `success`/`info`, 6 s `warning`, sticky `error`/`system`, hover
  pause/restart, `document.hidden` pause. Drawer window (`20` → `+50`) and open/filter state stay in
  `useState` inside `useLogDrawer`, never in the store and never in a global Zustand store.
- **`useSyncExternalStore` correctness:** the hook subscribes to the store's own stable snapshot and
  derives arrays in `useMemo` — never inside `getSnapshot`, which would loop forever.
- **`logNavigation` dropped from AIS-83** (deviation from the ticket's API sketch): router logging needs
  the app's router callbacks, so it moves to AIS-84.
- **Tests:** jsdom opted in per file with `// @vitest-environment jsdom` (the global environment stays
  `node`), fake timers for every TTL, explicit unmount assertions (`vi.getTimerCount() === 0`, listeners
  removed).

## Next

Implement the plan in a follow-up chat; then `docs/history` + milestone + Jira close-out for AIS-83.
