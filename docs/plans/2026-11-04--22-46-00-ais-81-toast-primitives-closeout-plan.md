# AIS-81 — `Toast` + `ToastStack` primitives — close-out plan

**Created:** 2026-11-04 22:46 (Europe/Budapest)
**Ticket:** AIS-81 (subtask of AIS-86) · **Status:** implementation already in the tree, ticket still `To Do`
**Scope:** `packages/ui` (+ doc/Jira close-out). No app, no store, no timer.

---

## 1. Why this is a close-out plan, not a build plan

The feature was implemented against
[`docs/plans/2026-11-04--20-59-00-ais-81-toast-toaststack-plan.md`](2026-11-04--20-59-00-ais-81-toast-toaststack-plan.md)
and its narrative + decision records are already written. Verified present in the tree:

| Artefact | State |
| -------- | ----- |
| `packages/ui/src/components/toast/{Toast,ToastStack}.tsx`, `toast.{const,interface,logic,variants}.ts` | present |
| Explicit exports in [`packages/ui/src/index.ts`](packages/ui/src/index.ts:253) | present |
| `packages/ui/test/{toast,toast-stack,toast.logic}.test.tsx` + `test/mocks/toast-items.mock.ts` | present |
| Rows for `Toast` / `ToastStack` + the AIS-81 paragraph in [`docs/Specs/UI-Architecture.md`](docs/Specs/UI-Architecture.md:215) | present |
| Heritage docs | [`docs/history/2026-11-04--20-25-00-ais-81-toast-toaststack.md`](docs/history/2026-11-04--20-25-00-ais-81-toast-toaststack.md:1), [`docs/milestones/2026-11-04--20-26-00-ais-81-toast-primitives.milestone.md`](docs/milestones/2026-11-04--20-26-00-ais-81-toast-primitives.milestone.md:1) |
| Jira AIS-81 | **`To Do`** — not transitioned |

The DoD of the ticket is therefore *almost* met; two real drifts and the ticket state remain.

---

## 2. Drifts found (must be fixed, not just verified)

**D-A — stale JSDoc claim on `ToastLevel`.**
[`toast.interface.ts`](packages/ui/src/components/toast/toast.interface.ts:7) says AIS-79 *aliases*
`type NotificationLevel = ToastLevel`. AIS-79 did the opposite (decision D1): the core declares its
own union, because importing `@callback/ui` would pull React types into a framework-free package.
The spec and [`notification.interface.ts`](packages/notifications/src/core/notification.interface.ts:4)
already tell the correct story, so only this comment lies.

**D-B — the “pinned on both sides” claim is one-sided.**
Both [`notification.interface.ts`](packages/notifications/src/core/notification.interface.ts:4) and
[`UI-Architecture.md`](docs/Specs/UI-Architecture.md:230) promise that `NOTIFICATION_LEVELS` **and**
the `TOAST_LEVEL_GLYPHS` keys are asserted in tests. `NOTIFICATION_LEVELS` is pinned in
`packages/notifications/test/notification.logic.test.ts`, but no `packages/ui` test pins the five
levels — [`toast.test.tsx`](packages/ui/test/toast.test.tsx:64) only reads one glyph. A typo in the
UI level union would pass the UI suite silently.

**D-C — `TOAST_MAX_VISIBLE = 3` vs `NOTIFICATION_MAX_VISIBLE_TOASTS = 3`.**
Documented as a mirror, nothing pins the two numbers to each other. Optional: pin both numerically
(no cross-package import), so a change on one side fails a test.

---

## 3. Steps

1. **Fix D-A** — rewrite the `ToastLevel` JSDoc: the core declares its own union (AIS-79 D1), the two
   vocabularies are kept in sync by pinned tests, not by a type alias.
2. **Fix D-B** — add one pinned test in `packages/ui/test/toast.test.tsx`
   (`Object.keys(TOAST_LEVEL_GLYPHS)` equals `['success','error','warning','info','system']`), so the
   UI side of the promise is real. Update no other test.
3. **Fix D-C (optional but cheap)** — pin `TOAST_MAX_VISIBLE` to `3` in the same test block, with a
   comment that it mirrors `NOTIFICATION_MAX_VISIBLE_TOASTS`.
4. **Verify the DoD** (all must be green before touching Jira):
   - `pnpm --filter @callback/ui test`
   - `pnpm --filter @callback/ui build`
   - `pnpm quality:tokens` (palette gate) and `pnpm quality:dead-code` (knip)
   - `rg "#[0-9a-fA-F]{3,8}|(bg|text|border|ring|from|to|via)-(slate|gray|zinc|neutral|stone|indigo|red|amber|green|emerald|blue)-[0-9]{2,3}" packages/ui/src` → no match
   - grep the two components for `useState|useEffect|setTimeout|localStorage|@callback/notifications` → no match
5. **Confirm the spec still matches the code** — the two table rows and the AIS-81 paragraph in
   [`docs/Specs/UI-Architecture.md`](docs/Specs/UI-Architecture.md:215); correct only what the D-A fix
   touches.
6. **Close out in Jira** — comment with the verification evidence (test/build/gate results, the D-A/D-B
   fixes) and transition AIS-81 `To Do → In Progress → Done`; then check the parent AIS-86 for the
   now-unblocked follow-up (AIS-83).
7. **Commit** — one commit, title `AIS-81: fix(ui): pin the toast level vocabulary and correct its docs`
   (or `AIS-81: test(ui): …` if a test-only change ends up sufficient).
8. **Docs** — append a short close-out note to the existing history entry
   [`docs/history/2026-11-04--20-25-00-ais-81-toast-toaststack.md`](docs/history/2026-11-04--20-25-00-ais-81-toast-toaststack.md:1)
   (no new milestone: the decision-grade record already exists).

---

## 4. Definition of done

- [ ] `ToastLevel` JSDoc no longer claims a type alias from `@callback/notifications`.
- [ ] `packages/ui` pins the five toast levels in a test; `TOAST_MAX_VISIBLE` pinned to `3`.
- [ ] `test`, `build`, `quality:tokens`, `quality:dead-code` green; palette `rg` empty.
- [ ] No React state, timer, storage or store import in `Toast` / `ToastStack`.
- [ ] History entry updated; spec unchanged apart from the corrected comment reference.
- [ ] AIS-81 `Done` in Jira with the evidence comment.

---

## 5. Out of scope

Timers, `notify` facade, `NotificationHost` (AIS-83); store / cap 500 / sessionStorage (AIS-79,
AIS-80); `LogDrawer` (AIS-82); any app, route or page change.
