# AIS-82 — `LogDrawer` + `LogEntryRow` primitives

**Date:** 2026-11-04 · **Ticket:** AIS-82 (subtask of AIS-86) · **Area:** `packages/ui`

## 1. Feature

The UI kit needed the presentation layer of the session log: a narrow tab on the right edge that
expands into a panel listing every notification and system entry of the session, newest first, with
level filters, a clear action and a "load older entries" control. The data, the filter state and the
paging window live elsewhere (store AIS-79/AIS-80, host AIS-83) — this ticket ships only the view.

## 2. Evidence that drove the design

| Constraint | Consequence |
| ---------- | ----------- |
| The store (`@callback/notifications`) is framework-free and `packages/ui` must not import it | `LogEntryItem` is **structurally typed**; `NotificationEntry` is assignable with no mapper |
| The panel is a diagnostics side view, not a dialog | Non-modal: no overlay, no focus trap, page stays scrollable |
| The store emits five levels, including `success` | Six filter chips: `Mind` / `Siker` / `Hiba` / `Figyelmeztetés` / `Info` / `Rendszer` |
| A toast must stay above every panel; a dialog must cover the log | `LOG_DRAWER_Z_INDEX = 'z-40'` (dialog `z-50`, toasts `z-60`) |
| `packages/ui` must stay free of app date helpers | `formatTimestamp` is injected |
| `Escape` must work even when focus is outside the panel | The only `useEffect` in the package: a `document` `keydown` listener, active only while open |

## 3. Design rationale

**Alternatives considered.**

1. *Reuse `Drawer`/`OverlayShell` (Radix dialog).* Rejected: it traps focus, renders an overlay and
   locks scrolling — wrong for a non-blocking log. Duplicating a modal shell would also make the
   panel feel like a task interruption.
2. *Unmount the panel when closed.* Rejected: the tab's `aria-controls` would then reference a
   missing id (axe flags dangling IDREFs) and no exit animation is possible.
3. *Mount the panel always, content always.* Rejected: hidden controls stay tabbable.
4. **Chosen: panel element mounted, content conditional.** `translate-x` drives both directions; the
   children render only while open, so nothing hidden is focusable and the id reference stays valid.

**Colour is never the only signal.** Each row renders a glyph chip *and* the level as text, and the
accent border uses the same state tokens as `Alert`/`Toast`.

**Parity with toasts.** `LogEntryRow` imports `toastLevelChipVariants` and `TOAST_LEVEL_GLYPHS`
instead of redeclaring them, so a toast and its log row cannot drift apart.

## 4. Implementation

| File | Change |
| ---- | ------ |
| `packages/ui/src/components/log-drawer/log-drawer.interface.ts` | `LogEntryItem`, `LogLevelFilter`, `LogDrawerProps`, `LogEntryRowProps` |
| `packages/ui/src/components/log-drawer/log-drawer.const.ts` | labels, filter and level vocabularies, `LOG_DRAWER_Z_INDEX`, panel-id suffix |
| `packages/ui/src/components/log-drawer/log-drawer.logic.ts` | `toLogDrawerTabLabel` (pure; embeds the unseen count in the accessible name) |
| `packages/ui/src/components/log-drawer/log-drawer.variants.ts` | tab / panel / header / list / footer / chip / row recipes, tokens only |
| `packages/ui/src/components/log-drawer/LogEntryRow.tsx` | one row: glyph, level text, injected timestamp, message, optional detail |
| `packages/ui/src/components/log-drawer/LogDrawer.tsx` | tab + panel, filter chips, clear/close, load-more, `Escape` listener |
| `packages/ui/src/index.ts` | explicit exports (components, recipes, constants, types) |
| `packages/ui/test/log-drawer.test.tsx` | 17 behaviour tests |
| `packages/ui/test/log-entry-row.test.tsx` | 5 row tests |
| `packages/ui/test/mocks/log-entries.mock.ts` | entry fixtures + `stubFormatTimestamp` |
| `docs/Specs/UI-Architecture.md` | two primitives-table rows, changelog entry, design paragraph |

## 5. Outcome and verification

Both components are exported from `@callback/ui`; the host (AIS-83) can compose them without any
extra plumbing. Verified with:

```bash
pnpm --filter @callback/ui test          # 41 files / 337 tests passed
pnpm --filter @callback/ui build         # tsc --noEmit clean
pnpm quality:tokens                      # 0 palette violations
pnpm quality:dead-code                   # knip clean
```

Manual check: render `<LogDrawer>` with `isOpen={false}` → only the tab is visible; toggle it → the
panel slides in, chips filter via the callback, `Escape` and the header ✕ both close.

## 6. Follow-ups

- The `Siker` chip is an intentional deviation from the ticket's five-filter list — worth a ticket
  comment so the acceptance text matches the shipped UI.
- `NotificationHost`, the `notify` facade and the real 20/50 entry window remain in AIS-83; the
  drawer still receives an already-sliced list.
- Virtualisation was not needed at 500 entries; revisit only if the render cost shows up in practice.
