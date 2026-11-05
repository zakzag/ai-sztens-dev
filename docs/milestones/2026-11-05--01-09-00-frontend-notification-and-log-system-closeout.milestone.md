# Frontend notification + log system — close-out (AIS-85)

**Date:** 2026-11-05 01:09 (Europe/Budapest) · **Tickets:** AIS-85 closing AIS-86 (subtasks AIS-79…AIS-85)

## 1. Problem / feature

The admin app had no user feedback layer beyond ad-hoc `Alert`s inside forms: a successful save was
announced by a state flag that survived neither navigation nor a second save, and a failed request was
either invisible or duplicated. The story built a store-driven notification system (ring buffer of
500, `sessionStorage` mirror of 200, toast stack capped at 3, non-modal log drawer) and a **global
capture** that turns cache and transport events into entries without per-feature code. AIS-85 closes it
by proving the claim on a real form and by fixing the one place where the form and the capture still
spoke at the same time.

## 2. Evidence

| Observation | Before AIS-85 |
| ----------- | ------------- |
| Success feedback | `isSuccess` + inline `Alert` in `ApiKeyForm`: gone on navigation, no history, no log |
| Failure feedback | hand-written `useState(pageError)` + `Alert` + a `setError` loop, all per form |
| `500` on save | capture **toast** *and* page `Alert` with the same sentence (double surface) |
| Ticket's `meta: { notify: 'manual' }` marker | [`useApiMutation`](../../apps/admin/src/features/api/use-api-mutation.ts:37) never forwards `meta`, so the marker would have been a no-op |
| DoD “form uses `FormField`” | [`Input`](../../packages/ui/src/components/input/Input.tsx:42) already renders label/hint/error and overrides `aria-describedby` after `...rest`; wrapping it would duplicate the label and drop the described-by id |

## 3. Root cause / rationale

Two systems decided “who tells the user” independently: the form kept its own error state, and the
capture derived visibility from `toErrorSurface`. For a `field` failure both agreed (log only), for a
`page` failure both spoke. The fix puts the classifier *inside* the pure form mapping
([`toFormErrorPlan`](../../apps/admin/src/features/forms/use-app-form.logic.ts:1) now takes the surface),
so exactly one owner per failure kind exists and it is testable without React.

| Decision | Choice | Rejected alternative |
| -------- | ------ | -------------------- |
| Success owner | the form's `notify` port (`useNotifier()`) | `meta.successMessage` on the mutation — unreachable today and a second path |
| Page failure owner | the capture toast; `formError` stays `null` | the form `Alert` — vanishes on navigation, no history |
| Unaddressed issue of a `field` failure | the form `Alert` (the only case that keeps it) | dropping it — the message would only exist in the log |
| Field primitive | `Input`/`Textarea` directly | `FormField` wrapper — double label, lost `aria-describedby` |

## 4. Solution / implementation

| File | Change |
| ---- | ------ |
| [`use-app-form.logic.ts`](../../apps/admin/src/features/forms/use-app-form.logic.ts:1) | `toFormErrorPlan(mapping, fieldPaths, surface)`; `formMessage` only for `field` |
| [`use-app-form.ts`](../../apps/admin/src/features/forms/use-app-form.ts:79) | passes `toErrorSurface(error)` |
| [`ApiKeyForm.tsx`](../../apps/admin/src/pages/api-keys/ui/ApiKeyForm.tsx:26) | `useAppForm` + `useNotifier()` + `FormActions`; all error/success state deleted |
| [`render-with-providers.tsx`](../../apps/admin/src/test/mocks/render-with-providers.tsx:1), [`query-client.mock.tsx`](../../apps/admin/src/test/mocks/query-client.mock.tsx:1) | host mounted, real capture adapters bound to the test store, harness returned |
| [`ApiKeyForm.test.tsx`](../../apps/admin/src/pages/api-keys/ui/ApiKeyForm.test.tsx:1) | asserts one toast **and** one log entry per submit, `409` field-only, `5xx` toast-only, residue `Alert`, list invalidation |
| [`Forms-and-Validation.md`](../Specs/Forms-and-Validation.md:1), [`UI-Architecture.md`](../Specs/UI-Architecture.md:1) | who-speaks table (§3.1), `Input` vs `FormField`, §4.4/§5 rows |

## 5. Outcome and how to verify

End state: one save = one toast + one log row; a duplicate identifier shows only on its input, focused,
with no toast; a `5xx` shows only the sticky error toast. No form keeps a second error state.

```bash
pnpm --filter @callback/admin exec vitest run   # 388 tests green
pnpm --filter @callback/admin lint
pnpm --filter @callback/admin build             # tsc --noEmit + vite build
pnpm quality:field-errors && pnpm quality:layers && pnpm quality:dead-code
```

Browser checklist on a running stack (`pnpm dev` + `/api-keys`):

1. save a valid key → one toast, one log row, fields cleared, list refreshed;
2. save a duplicate identifier → error under `identifier`, focus on it, **no** toast;
3. force a `500` → exactly one error toast, no inline `Alert`;
4. submit 4 times quickly → at most 3 toasts, the log keeps all four;
5. hover a toast → the timer stops; switch tabs and come back → nothing expired;
6. open the drawer (60+ rows) → 20 rows, “Korábbiak betöltése” +50, then disabled, badge cleared;
7. reload the page → the log is restored (≤200) without toasts;
8. inspect one `api` log row from the failed request → status, URL, duration; no headers, no body.

> Note: `vite build` fails with `Access is denied` while deleting an `esbuild` temp file when `%TEMP%`
> points at the Windows profile. Pointing `TEMP`/`TMP` at a repo-local `.tmp` directory makes it green —
> environment issue, not a code defect.

## 6. Follow-ups

- `ApiKeyEditForm` has no notification port yet: it inherits the surface rule but announces nothing.
- `meta` is not forwarded by `useApiMutation`; if a cache-level success message is ever wanted, that is a
  deliberate two-line change plus a test, not a per-form flag.
- Router navigation logging (`logNavigation`) is still an open ticket.
- No e2e harness for the admin app; the browser checklist above is manual by design.
