# AIS-80 — `sessionStorage` mirror for the notification log

**Date:** 2026-11-04 22:25 (Europe/Budapest) · **Ticket:** AIS-80 (subtask of AIS-86)
**Package:** `packages/notifications` (framework-free core, `lib: ["ES2022"]`, zero dependencies)

## Problem / feature

The AIS-79 store keeps notifications and system log entries in memory. A reload (F5, a deploy-induced
refresh, an accidental hard refresh) destroyed that history, so the user could not look back at what
happened before the failure — precisely the moment the log exists for. A `sessionStorage` mirror was
needed: survive a reload, never leak into another tab or a new session, and need no server storage.

## Measured data / evidence

- The memory instance is gone on reload; no persistence existed anywhere in the package (AIS-79 §Out of scope).
- `sessionStorage` quota is per origin and shared with the rest of the app, and every `setItem` is
  synchronous on the main thread — hence a hard cap and coalesced writes rather than "write on every change".
- The package compiles with `lib: ["ES2022"]` only: `pnpm --filter @callback/notifications build` fails on
  any `window` / `sessionStorage` / `requestAnimationFrame` reference, so the browser API cannot be
  reached from inside the package at all.

## Design rationale

| Decision | Alternative considered | Why |
| --- | --- | --- |
| Envelope `{ version: 1, entries }`, key `aisztens.notifications.v1` | Bare `entries` array | The version lives in the key *and* the payload, so a future v2 can coexist instead of guessing what it reads. |
| Only `entries` persisted | Also persist `toasts` | A restored toast would show a card whose timer already expired; AIS-79 already ignores `toasts` in `initialEntries`, so both layers agree. |
| Cap 200 (memory buffer is 500) | One shared cap | The mirror explains the last session, it is not an archive; the cap is enforced on write **and** on restore. |
| All-or-nothing validation, hand-written guards, no `zod` | Validate per entry / add `zod` | One broken entry rejecting everything keeps the history truthful; `zod` would be the package's first runtime dependency for nine field checks. |
| Rejection is a discriminated result, not an exception | Throw a custom error | "Foreign payload" is an expected state (first visit, other tab, cleared storage); the contract is silent degradation, so there is no error to model. |
| Injected `StorageLike` **and** injected write scheduler | `window.sessionStorage` inside the package | The type system forbids it (`lib: ES2022`), and DI is what makes every branch testable in the `node` environment. |
| Microtask default scheduler, rAF injected by AIS-83 | Require rAF | Coalescing works out of the box; the app chooses the animation-frame boundary the ticket asks for. |
| `flush()` added to the minimal API | Rely on the queued tick | A queued rAF never runs on `pagehide`; the last entry before a reload would be lost. |
| Identical payload skipped | Write on every notification | `dismiss` changes no entry, and a redundant synchronous `setItem` per toast dismissal is pure cost. |
| `clear()` cancels the pending write before `removeItem` | Just `removeItem` | A queued flush would immediately resurrect the key the user just cleared. |
| Failed write is not marked as written | Mark as written, drop | The next save must retry; a dropped write would leave storage permanently behind the visible log. |

## Solution / implementation

| File | Change |
| --- | --- |
| `src/core/notification.const.ts` | key, version (typed as `PersistedEnvelopeVersion`), cap 200 |
| `src/core/notification.storage.interface.ts` | `StorageLike`, envelope/result types, scheduler type, options and adapter interface |
| `src/core/notification.storage.logic.ts` | pure `toPersistedEnvelope` / `fromPersistedEnvelope` + `unknown`-narrowing guards |
| `src/core/notification.storage.ts` | `createNotificationStorage`: coalescing, duplicate skip, `flush`, `clear`, try/catch degradation, memory-only mode |
| `src/index.ts` | explicit exports of the new values and types |
| `test/mocks/notification-storage.fixtures.ts` | fake storage with read/write failure switches, manual scheduler, payload builders |
| `test/notification-storage.logic.test.ts`, `test/notification-storage.test.ts` | 45 new cases (25 + 20) |

The adapter is **not** bound to the store: AIS-83 owns the single wiring point (`load()` → `initialEntries`,
`subscribe` → `save`, `pagehide` → `flush`). `docs/Specs/UI-Architecture.md` gained a `sessionStorage`
mirror block; the change narrative is in `docs/history/2026-11-04--22-25-00-ais-80-notifications-session-storage.md`.

## Outcome and how to verify

```powershell
pnpm --filter @callback/notifications build   # tsc --noEmit -> green
pnpm --filter @callback/notifications test    # 139 tests, 5 files -> green
pnpm typecheck                                # all workspaces -> green
pnpm quality:dead-code                        # knip -> green
pnpm quality:tokens                           # 0 violations
pnpm quality:field-errors                     # 0 violations
```

Manual / future E2E check once AIS-83 wires the provider: emit a notification, press F5 — the log drawer
still lists the entry and **no toast** reappears; then clear the log and reload — the log stays empty.

## Follow-ups

- **Two pre-existing red gates in `apps/admin` (AIS-131, unrelated to this ticket):**
  `quality:layers` reports `no-page-to-foreign-feature` for `pages/api-keys/ui/ApiKeyEditForm.tsx` →
  `features/forms/use-app-form.ts`, and `apps/admin`'s `ApiKeyDetailCard.test.tsx:71` finds
  `EXPIRY_NONE_LABEL` twice. `pnpm test` stops at the admin step because of the second one.
- `prettier --check` flags the whole package (AIS-79 files included): `.prettierrc` keeps the default
  `printWidth: 80` while the code is written at ~100 columns. Not a CI gate; worth one dedicated
  `chore(format)` commit rather than reformatting inside a feature ticket.
- Out of scope by design: `version: 2` migration, cross-tab sync, `localStorage`, TTL expiry.
