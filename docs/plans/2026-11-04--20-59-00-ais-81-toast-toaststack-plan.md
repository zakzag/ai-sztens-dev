# AIS-81 — `packages/ui`: `Toast` + `ToastStack` primitives — implementation plan

**Created:** 2026-11-04 20:59 (Europe/Budapest)
**Ticket:** AIS-81 (subtask of AIS-86) · **Status:** ready for implementation
**Scope:** `packages/ui` only. No app, no store, no timer.
**Predecessors:** none (self-contained UI story). **Successors:** AIS-83 (host + timers), AIS-84/85.

---

## 0. Pre-work — commit the existing working tree grouped by ticket (do this first)

The working tree carries uncommitted changes from earlier tickets. AIS-81 must start from a clean
tree, and each existing change belongs to another Jira key, so they must land as **one commit per
ticket** — never as a single mixed commit.

1. `git status --porcelain=v1 --untracked-files=all` and `git diff --stat` → inventory every path.
2. Map each path to its key and write the mapping out **before** committing:

   | Group | Typical paths | Title shape |
   | ----- | ------------- | ----------- |
   | AIS-111 | `apps/admin/src/lib/api-error-code.const.ts`, `error-message.const.ts`, `field-errors.logic.ts`, `scripts/quality/field-error-gate*`, related spec/history docs | `AIS-111: feat(admin): ...` |
   | AIS-113 / AIS-116 | `packages/ui/src/components/**`, `packages/ui/test/**` | `AIS-113: feat(ui): ...` |
   | AIS-98 / AIS-106 / AIS-118 / AIS-119 | plans, specs, api-client and admin layer files | `AIS-<key>: <type>(<scope>): ...` |
   | this plan | `docs/plans/2026-11-04--20-59-00-ais-81-toast-toaststack-plan.md` | `AIS-81: docs(plans): add Toast and ToastStack primitive plan` |

3. One `git add <paths>` + `git commit` per group. Never `git add -A` across tickets.
4. Nothing is stashed or dropped: every path ends up in a commit and `git status` is clean before
   the first AIS-81 code file is created.
5. Verify: `git log --oneline -n <n>` shows one commit per key, every title matching
   `<KEY>: <type>(<scope>): <summary>` (maximum 72 characters).

Architect mode cannot execute `git` for this workspace (no command tool rooted here), so steps 1–5
run in Code mode before AIS-81 implementation starts.

---

## 1. Goal

Two token-only, state-less presentational primitives:

- `Toast` — one notification card: level accent, message, optional detail, optional repeat counter, dismiss button, pause/resume pointer events.
- `ToastStack` — the fixed bottom-right container: live region, max 3 visible cards, stack-depth styling.

They render props and call callbacks. They never read a store, never start a timer, never touch storage. That belongs to `@callback/notifications` (AIS-79) and its React bindings (AIS-83).

---

## 2. Decisions locked before implementation

| # | Decision | Why |
| - | -------- | --- |
| D1 | `ToastLevel` union lives in `toast.interface.ts` (`success` \| `error` \| `warning` \| `info` \| `system`) | `packages/notifications` does not exist yet (AIS-79). `packages/ui` must not import a non-existent package. AIS-79 will alias it: `type NotificationLevel = ToastLevel`. |
| D2 | Enter animation = Tailwind `starting:` variant + `transition-[transform,opacity]`, **no** `data-mounted`, **no** keyframes, **no** React state | The DoD forbids state inside the primitive; `starting:` needs no state flip. |
| D3 | `ToastStackProps.toasts` is **newest-first**: index `0` is the newest; the stack renders `toasts.slice(0, TOAST_MAX_VISIBLE)` | The store prepends. The contract is documented in the interface JSDoc so AIS-83 cannot guess it. |
| D4 | `ToastItem` is defined here; AIS-83 maps `NotificationEntry → ToastItem` | Keeps `packages/ui` free of store types, same approach as `Pagination` (structural typing, **D1** of AIS-116). |
| D5 | Level accent follows the `Alert` recipe: explicit border colour + `text-text-primary` | Contrast never depends on the accent colour alone. No new visual language. |
| D6 | Stack depth (`scale`/`opacity`) is a CVA `depth` variant set **by `ToastStack`**, not by pages | Layout knowledge stays in one place; pages only pass `ToastItem[]`. |
| D7 | `TOAST_STACK_Z_INDEX = 'z-60'` in `toast.const.ts` | Must sit above the dialog/drawer surface (`DIALOG_CONTENT_Z_INDEX = 'z-50'`, AIS-117 **D5**: z-literal lives in a `.const.ts`). |

---

## 3. Files

```text
packages/ui/src/components/toast/toast.const.ts          constants only
packages/ui/src/components/toast/toast.interface.ts      ToastLevel, ToastItem, ToastProps, ToastStackProps
packages/ui/src/components/toast/toast.variants.ts       toastVariants, toastStackVariants, ToastVariants
packages/ui/src/components/toast/Toast.tsx               one card
packages/ui/src/components/toast/ToastStack.tsx          region + slicing + depth
packages/ui/src/index.ts                                 add the explicit exports
packages/ui/test/toast.test.tsx                           component tests (Toast)
packages/ui/test/toast-stack.test.tsx                     container tests (slicing, region, empty)
docs/Specs/UI-Architecture.md                             primitives table + §4 note
```

No new npm dependency.

---

## 4. API

```ts
export type ToastLevel = 'success' | 'error' | 'warning' | 'info' | 'system';

export interface ToastItem {
  readonly id: string;
  readonly level: ToastLevel;
  readonly message: string;
  readonly detail?: string;
  readonly repeatCount?: number;
}

export interface ToastProps
  extends Omit<HTMLAttributes<HTMLDivElement>, 'onPause'>, ToastVariants {
  readonly message: string;
  readonly detail?: string;
  readonly repeatCount?: number;
  readonly onDismiss: () => void;
  readonly onPause?: () => void;
  readonly onResume?: () => void;
}

export interface ToastStackProps {
  /** Newest first: index 0 is the newest toast (D3). */
  readonly toasts: readonly ToastItem[];
  readonly onDismiss: (id: string) => void;
  readonly onPause?: (id: string) => void;
  readonly onResume?: (id: string) => void;
}
```

`Omit<..., 'onPause'>` is mandatory: the DOM `onPause` media handler would otherwise clash with our signature.

---

## 5. Visual recipe (tokens only)

`toastVariants`

| Part | Classes |
| ---- | ------- |
| base | `pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-card border-strong border-border-hairline bg-surface-overlay px-4 py-3 text-sm text-text-primary shadow-neu-raised transition-[transform,opacity] duration-base ease-neu starting:-translate-y-2 starting:scale-95 starting:opacity-0` |
| `level.success` | `border-success` |
| `level.error` | `border-danger` |
| `level.warning` | `border-warning` |
| `level.info` | `border-info` |
| `level.system` | `border-border-strong` |
| `depth.0` | `scale-100 opacity-100` |
| `depth.1` | `scale-[0.97] opacity-90` |
| `depth.2` | `scale-[0.94] opacity-80` |

Level glyph: `TOAST_LEVEL_GLYPHS: Record<ToastLevel, string>` (`✓ ! ⚠ i •`) rendered `aria-hidden` in a token-coloured chip (`bg-success text-success-foreground`, … , `system` → `bg-surface-sunken text-text-secondary`).

`toastStackVariants`

```text
fixed bottom-4 right-4 flex w-full max-w-sm flex-col items-end gap-2 pointer-events-none z-60
```

`flex-col` + bottom anchor: DOM order is newest-first, so the newest card renders on top and older cards sit below it, while the group stays glued to the bottom edge. `pointer-events-none` on the container + `pointer-events-auto` on the card keeps the empty area click-through.

---

## 6. Behaviour and accessibility

- `Toast` root: `role="alert"` when `level === 'error'`, otherwise `role="status"` (identical to `Alert` / `Banner`).
- Dismiss: real `Button` (`variant="ghost"`, `size="sm"`), `aria-label={TOAST_DISMISS_LABEL}`, glyph `✕` wrapped in `aria-hidden` (same pattern as `Banner`).
- `repeatCount > 1` → `Badge variant="neutral"` showing `×N`; `1`/`undefined` → nothing.
- `detail` → rendered only when present: `mt-1 line-clamp-2 break-words text-xs text-text-secondary` plus `title={detail}`.
- `onPointerEnter` → `onPause?.()`, `onPointerLeave` → `onResume?.()`. No timer logic here.
- `ToastStack`: `null` when empty; container `role="region" aria-live="polite" aria-atomic="false" aria-label={TOAST_STACK_ARIA_LABEL}`; `key={toast.id}`; `depth` = render index (0..2).
- Accessible-name constants (`TOAST_DISMISS_LABEL = 'Bezárás'`, `TOAST_STACK_ARIA_LABEL = 'Értesítések'`, `TOAST_MAX_VISIBLE = 3`, `TOAST_STACK_Z_INDEX`) are exported so tests and AIS-83 assert the same value the component renders.

---

## 7. Tests (`vitest` + RTL, `packages/ui/test`)

`toast.test.tsx`
1. every level maps to its accent class (`it.each`).
2. `error` → `role="alert"`; `success`/`info`/`warning`/`system` → `role="status"`.
3. dismiss click calls `onDismiss` exactly once; the button has the accessible name from `TOAST_DISMISS_LABEL`.
4. `pointerEnter` → `onPause`, `pointerLeave` → `onResume`, one call each.
5. `repeatCount: 3` renders `×3`; `undefined` and `1` render none.
6. `detail` present → text + `title`; absent → no detail node.
7. `depth` 0/1/2 → the matching scale/opacity classes.
8. caller `className` is merged.
9. `vitest-axe` (options from `test/mocks/axe-options.mock.ts`): success and error variants report no violations.

`toast-stack.test.tsx`
10. empty array renders nothing.
11. four items → exactly three cards, the newest present and first in DOM order.
12. newest-first order is preserved (assert text order).
13. `onDismiss` receives the id of the clicked card.
14. region has `aria-live="polite"`, `aria-atomic="false"` and the accessible name.
15. `onPause`/`onResume` are forwarded per id.

Rule: no mock inside the test files — the axe options mock already exists in `test/mocks/`.

---

## 8. Verification (definition of done)

```powershell
pnpm --filter @callback/ui test
pnpm --filter @callback/ui build
pnpm quality:dead-code
pnpm quality:tokens
rg "#[0-9a-fA-F]{3,8}|(bg|text|border|ring|from|to|via)-(slate|gray|zinc|neutral|stone|indigo|red|amber|green|emerald|blue)-[0-9]{2,3}" packages/ui/src
```

- [ ] `pnpm quality:dead-code` clean — the new symbols are exported from `index.ts`, which is the package entry, so knip sees them as used.
- [ ] palette `rg` returns nothing.
- [ ] `Toast`, `ToastStack`, `ToastItem`, `ToastLevel`, `ToastProps`, `ToastStackProps`, `toastVariants`, `toastStackVariants`, `ToastVariants` and the four constants are exported from [`index.ts`](packages/ui/src/index.ts:1) (explicit, no `export *`).
- [ ] No `useState`, `useEffect`, `setTimeout`, `localStorage` or store import in either component.

---

## 9. Documentation deliverables

- `docs/Specs/UI-Architecture.md` — new rows for `Toast` / `ToastStack` in the primitives table (§4), plus a short note that the toast layer is AIS-81 and the timer/host is AIS-83.
- `docs/history/<ts>-ais-81-toast-toaststack.md` — post-implementation summary.
- `docs/milestones/<ts>-ais-81-toast-primitives.milestone.md` — one page: why `ToastLevel` is local (D1), why `starting:` instead of `data-mounted` (D2), why the array is newest-first (D3).

---

## 10. Out of scope

- Timers, auto-dismiss durations, `document.hidden` pausing, duplicate suppression → AIS-83.
- The store, cap 500, sessionStorage → AIS-79 / AIS-80.
- `LogDrawer` / `LogEntryRow` → AIS-82.
- Any app integration, route or page change.

---

## 11. Risks

| Risk | Mitigation |
| ---- | ---------- |
| `starting:` needs Tailwind v4 (present in `apps/admin` and `apps/web`) and a modern engine; jsdom does not evaluate it | The tests never assert computed animation, only classes — behaviour stays verifiable. |
| AIS-83 could pass an oldest-first array | The order is documented on `ToastStackProps.toasts` (D3) and asserted in test 12. |
| Level vocabulary drifting between `packages/ui` and `packages/notifications` | AIS-79 aliases `ToastLevel` instead of re-declaring a union; noted in the milestone. |
| Toast hidden behind the drawer (`z-50`) | `TOAST_STACK_Z_INDEX = 'z-60'`, constant exported and covered by the leak rule of AIS-117 **D5**. |
