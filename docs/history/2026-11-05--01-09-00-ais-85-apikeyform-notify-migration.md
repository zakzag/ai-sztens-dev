# AIS-85 — `ApiKeyForm` a `notify` porton + a notification story lezárása

**Dátum:** 2026-11-05 01:09 (Europe/Budapest) · **Ticket:** AIS-85 (subtask of AIS-86)
**Terv:** [`2026-11-05--00-58-00-ais-85-apikeyform-notify-migration-closeout-plan.md`](../plans/2026-11-05--00-58-00-ais-85-apikeyform-notify-migration-closeout-plan.md)

## Mit kért a ticket

Az első valós form átállítása a notification rendszerre, és ezzel a notification/log feature lezárása:
acceptance checklist, `docs/Specs/UI-Architecture.md` frissítés, `docs/history/` bejegyzés, milestone.

## Amit a kód a ticket megírása óta meghaladott (a terv ezért tért el)

| Ticket szövege | Mi van a fában | Következmény |
| -------------- | -------------- | ------------ |
| „a mutation kap `meta: { notify: 'manual' }` jelölőt” | [`useApiMutation`](../../apps/admin/src/features/api/use-api-mutation.ts:37) **nem** adja tovább a `meta`-t a `useMutation`-nek, így a cache success-ága nem is tud elsülni | a form `notify` portja az egyetlen success-tulajdonos; nincs szükség új jelölőre (D1) |
| „nem-409 hiba → `notify.error(...)`” | a globális capture `page` surface-re **már** toastol ([`notification-events.logic.ts:279`](../../apps/admin/src/app/notifications/notification-events.logic.ts:279)), `field`-re csak logol | ha a form is szólna, dupla üzenet lenne; a form `formError`-ja csak a `field` hiba **gazdátlan** maradéka (D2) |
| „a form a `FormField` primitívet használja” | [`Input`](../../packages/ui/src/components/input/Input.tsx:42) saját `label`/`hint`/`error`/`aria` wiringot hoz, és `aria-describedby`-t a `...rest` **után** írja felül | `FormField` + `Input` dupla labelt és elveszett `aria-describedby`-t adna → `Input`/`Textarea` közvetlenül, `FormField` csak label nélküli kontrollra (D3) |

## Változások fájlonként

| Fájl | Változás |
| ---- | -------- |
| [`use-app-form.logic.ts`](../../apps/admin/src/features/forms/use-app-form.logic.ts:1) | `toFormErrorPlan(mapping, fieldPaths, surface)` — a `formMessage` csak `field` surface-nél marad meg |
| [`use-app-form.ts`](../../apps/admin/src/features/forms/use-app-form.ts:79) | `applyServerError` átadja a `toErrorSurface(error)` besorolást |
| [`use-app-form.interface.ts`](../../apps/admin/src/features/forms/use-app-form.interface.ts:154) | `FormErrorPlan.formMessage` dokumentációja a surface-szabály szerint |
| [`ApiKeyForm.tsx`](../../apps/admin/src/pages/api-keys/ui/ApiKeyForm.tsx:26) | `useAppForm` + `useNotifier()` + `FormActions`; `pageError` state, success `Alert`, `setError`-loop, `isSuccess`/`reset` törölve |
| [`ApiKeyForm.test.tsx`](../../apps/admin/src/pages/api-keys/ui/ApiKeyForm.test.tsx:1) | új assertion-ök: 1 toast + 1 log bejegyzés, 409 mező-only toast nélkül, 5xx toast-only Alert nélkül, maradék-Alert, invalidáció |
| [`ApiKeyEditForm.test.tsx`](../../apps/admin/src/pages/api-keys/ui/ApiKeyEditForm.test.tsx:131) | a `page` hiba már nem renderel inline `Alert`-ot (D2) |
| [`use-app-form.test.tsx`](../../apps/admin/src/features/forms/use-app-form.test.tsx:228) | a `page` hiba „nincs duplikált Alert”, a retry-teszt a maradék-üzenetet tisztítja |
| [`use-app-form.logic.test.ts`](../../apps/admin/src/features/forms/use-app-form.logic.test.ts:1) | 4 új eset: `page` / `banner` / `silent` elnyomás, `page` mellett is mező-hibák |
| [`query-client.mock.tsx`](../../apps/admin/src/test/mocks/query-client.mock.tsx:1) | opcionális `store` paraméter: a valódi `QueryCache`/`MutationCache` capture adapterek bekötése |
| [`render-with-providers.tsx`](../../apps/admin/src/test/mocks/render-with-providers.tsx:1) | `<NotificationHost />` mountolása (mint az `AdminLayout`) + a harness visszaadása |
| [`UI-Architecture.md`](../Specs/UI-Architecture.md:1) | AIS-85 note, §4.4 (surface-szabály, `Input` vs `FormField`, `useNotifier`), §5 `pages/api-keys` sor |
| [`Forms-and-Validation.md`](../Specs/Forms-and-Validation.md:1) | §1 minta javítva, új §3.1 „ki beszél”, §5 notification port, §6 tesztek, §7 migration status |

## Verifikáció

```bash
pnpm --filter @callback/admin exec vitest run     # 386 → 388 teszt, zöld
pnpm --filter @callback/admin lint                # zöld
pnpm --filter @callback/admin build               # tsc --noEmit + vite build zöld
pnpm quality:field-errors                         # 0 violation
pnpm quality:layers                               # 99 modul, 0 violation
pnpm quality:dead-code                            # knip tiszta
```

Megjegyzés a buildhez: a `vite build` az `esbuild` ideiglenes fájljának törlésekor
`Access is denied` hibát ad, ha a `%TEMP%` a `C:\Users\…\AppData\Local\Temp`. Munkaaránya:
`$env:TEMP`/`$env:TMP` egy repón belüli `.tmp` mappára állítva a build zöld (környezeti, nem kód-hiba).

## Acceptance checklist (a base plan §9-ből)

| Kritérium | Állapot |
| --------- | ------- |
| `notify.*` React tree nélkül | ✅ AIS-83 core tesztjei |
| Egy submit = egy toast + egy log bejegyzés | ✅ [`ApiKeyForm.test.tsx`](../../apps/admin/src/pages/api-keys/ui/ApiKeyForm.test.tsx:178) assertálja (`toasts`/`entries` hossza 1) |
| 4xx/5xx/hálózati hiba → toast **és** `api` log; 2xx → csak log | ✅ capture tesztek (AIS-84) + `field`/`page` szétválasztás a form tesztekben |
| Toast: 3 látható, hover pause, error marad | ✅ `packages/ui` + `packages/notifications` tesztek (AIS-81/83) |
| Drawer: 20, majd +50, szűrő, törlés, `Escape` | ✅ `packages/ui` LogDrawer tesztjei (AIS-82) |
| Reload visszatölti a logot (≤200) toast nélkül, corrupt payload eldobva | ✅ `packages/notifications` storage tesztek (AIS-80) |
| Nincs secret a logban | ✅ `redactValue` tesztek (AIS-79) |
| `packages/ui` nem függ a `@callback/notifications`-tól | ✅ réteg-gate zöld |
| Palette, lint, type-check, tesztek, docs | ✅ fent |

Böngészős manuális kör (a fenti sorok interaktív ellenőrzése a futó stacken) a ticket szerint
elfogadási feltétel; a lépések a milestone „how to verify” szakaszában szerepelnek.

## Tanulság

A notification rendszer akkor lesz „ingyen” minden formnak, ha a **hibáról ki beszél** döntés egy
helyen, tisztán születik meg. Ez most a `toErrorSurface` → `toFormErrorPlan` lánc: a komponens csak
renderel, a policy pedig tesztelhető marad React nélkül.
