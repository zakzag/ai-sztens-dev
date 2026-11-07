# Milestone — structured log entry details (`details` on `NotificationEntry`)

**Date:** 2026-11-07 · **Ticket:** AIS-151 (parent AIS-143) · **Package:** `@callback/notifications` (core)

## 1. Problem

A log entry carried one flat `detail: string` (`"status=422 · code=VALIDATION · requestId=…"`). The
expandable log row planned in AIS-143 needs key–value pairs, and neither transport (AIS-152) nor UI
(AIS-153) can produce them without a structured field on the entry itself.

## 2. Evidence

- Before: `NotificationEntry.detail?: string`; every emitter flattened its context into that single string.
- Persisted mirror: 200 entries in `sessionStorage`, quota shared with the rest of the admin app.
- After: 270 tests green in the package (10 files); `typecheck` clean.

## 3. Design rationale

| Decision | Choice | Why |
| -------- | ------ | --- |
| A | record → fields keeps the emitter's **insertion order** | the row reads exactly as the caller composed it; JS own-key order is specified, so it stays testable |
| B | `clampDetailFields` redacts by `label` too | an emitter could otherwise bypass redaction by pre-building the array, breaking AIS-79 D9 |
| C | repeat with new fields replaces them; repeat without fields keeps the previous ones | a retry must not silently erase the context that explains the first failure |
| D | `detail: string` stays | `Toast` accepts `detail?: string`, and the collapsed row shows it; `details` complements, never replaces |
| E | empty result → `undefined` | an empty array would inflate both the snapshot and the persisted payload |
| F | limits come from constants (20 fields / 40 label / 2000 value / `…`) | 200 persisted entries × long stack traces would blow the `sessionStorage` quota |

Rejected alternatives: sorting fields alphabetically (unstable reading order); a nested/dynamic value
type (a `string` is all the UI renders, and richer values would need their own redaction walk).

## 4. Implementation

| File | Change |
| ---- | ------ |
| [`notification.interface.ts`](../../packages/notifications/src/core/notification.interface.ts:1) | `NotificationDetailField { label, value, mono? }`, `NotificationEntry.details?`, `EmitNotificationInput.details?` (field list **or** record) |
| [`notification.const.ts`](../../packages/notifications/src/core/notification.const.ts:1) | `NOTIFICATION_DETAIL_MAX_FIELDS`, `..._LABEL_MAX_LENGTH`, `..._VALUE_MAX_LENGTH`, `..._TRUNCATION_SUFFIX`, `NOTIFICATION_DETAILS_INVALID_PLACEHOLDER` |
| [`notification.logic.ts`](../../packages/notifications/src/core/notification.logic.ts:1) | `toDetailFields`, `clampDetailFields`, internal serialise/truncate helpers; `bumpEntry(entry, now, details?)`; `toRedactedDetail` untouched |
| [`notification.store.ts`](../../packages/notifications/src/core/notification.store.ts:1) | `normalizeDetails` (empty → `undefined`), wired into `createEntry` and `emit` |
| [`notification.storage.logic.ts`](../../packages/notifications/src/core/notification.storage.logic.ts:1) | `isDetailField` / `isOptionalDetails` folded into `isPersistedEntry`; all-or-nothing, version stays `1` |
| [`index.ts`](../../packages/notifications/src/index.ts:1) | explicit exports of the type, constants and the two functions |
| `test/**` | fixtures (`createTestDetailField`, `createTestDetailsRecord`) plus 40+ new cases across logic, store and storage guard |
| [`tsconfig.core.json`](../../packages/notifications/tsconfig.core.json:1) | `exclude: ["test/log-drawer-width-storage.test.ts"]` — that React-layer test (added by AIS-150) matched the `test/*.ts` pattern and dragged `@callback/ui` sources into the core program |

## 5. Outcome and verification

Behaviour: `emit({ details: { status: 422, token: 'abc' } })` stores
`[{ label: 'status', value: '422' }, { label: 'token', value: '<redacted>' }]`; an emit without fields
stores `details: undefined`; a pre-AIS-151 `sessionStorage` payload still loads.

```bash
pnpm --filter @callback/notifications test   # 270 tests green
pnpm --filter @callback/notifications build  # tsconfig.core.json + tsconfig.json clean
pnpm typecheck                               # all 8 workspaces clean
pnpm quality:dead-code && pnpm quality:docs  # clean, 0 violations
```

### Side finding: the core build was already red

`tsconfig.core.json` includes `test/*.ts`, and AIS-150 added
`test/log-drawer-width-storage.test.ts`, which imports `src/react/log-drawer-width.storage.ts` →
`@callback/ui`. The core project therefore type-checked `packages/ui` **sources** with `lib: ES2022`
and without `--jsx`, so `build` failed on `HTMLTableCellElement` and ~45 `TS6142` errors before this
ticket touched anything (`git stash` + rerun confirmed). Excluding that single React-layer test from the
core project restored its purpose — proving the core is DOM/React-free — while `tsconfig.json` still
type-checks it.

## 6. Follow-ups

- AIS-152 maps `HttpEvent` → `details`; AIS-153 renders the list. Neither may forward `details` to a toast.
- `clampDetailFields` returns a new array even when nothing had to change; if profiling ever shows it,
  returning the input reference for an already-normalised list is a safe optimisation.
