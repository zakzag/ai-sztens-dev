# AIS-115 — közös form-minta (`useAppForm`)

**Dátum:** 2026-11-04 16:47 (Europe/Budapest)
**Ticket:** AIS-115 (az AIS-103 sub-taskja) — `admin: közös form-minta (useAppForm — validáció, mezőhiba, submit/toast konvenció egy helyen)`
**Terv:** [`2026-11-04--16-31-00-ais-115-app-form-pattern-plan.md`](../plans/2026-11-04--16-31-00-ais-115-app-form-pattern-plan.md:1)
**Spec:** [`docs/Specs/Forms-and-Validation.md`](../Specs/Forms-and-Validation.md:1) **új** élő dokumentum

## Kiinduló helyzet

Az `ApiKeyForm` ~40 sornyi infrastruktúrát tartott magában, ami semmihez nem kötődött az
API-kulcs domainhez: `useForm` + `zodResolver(…, { errorMap })`, egy `setError` ciklus a
`toFieldErrors` eredményén, egy `useState` az oldalszintű hibának, `reset` a siker után. Egy
második form ugyanezt másolta volna. A notification rendszer (AIS-84) még nem létezett —
`notify`/`toast` szimbólum nincs az `apps/admin/src`-ben.

## Változások

| Fájl                                                       | Változás                                                                                                                                                                                              |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/admin/src/features/forms/use-app-form.interface.ts`  | **új** — `UseAppFormOptions<FV>`, `UseAppFormResult<FV>`, `FormNotifier`, `AppFormState`, `AppFormSubmitHandler`, `FieldPath<FV>`, `FormErrorEntry`, `FormErrorPlan`                                  |
| `apps/admin/src/features/forms/use-app-form.logic.ts`      | **új** — `toFormErrorPlan(mapping, fieldPaths)`: a `fieldPaths` sorrendjében adja a bejegyzéseket, kihagyja az idegen path-eket, megtartja az oldalszintű üzenetet                                    |
| `apps/admin/src/features/forms/use-app-form.const.ts`      | **új** — `APP_FORM_FIELD_ERROR_TYPE = 'server'`                                                                                                                                                       |
| `apps/admin/src/features/forms/use-app-form.ts`            | **új** — a hook: resolver, submit → `reset` → `notify.success` → `onSuccess`, hiba → `toFieldErrors` → `toFormErrorPlan` → `setError`, `formError` állapot, `setServerError`, `clearFormError`        |
| `apps/admin/src/features/forms/use-app-form.logic.test.ts` | **új** — 6 teszt (sorrend, idegen path, oldalszintű üzenet, üres esetek)                                                                                                                              |
| `apps/admin/src/features/forms/use-app-form.test.tsx`      | **új** — 12 teszt (valid submit + reset + notify + `onSuccess`, hiányzó notify, blokkolt submit, pending, 5xx, nem címzett path, default path kódból, fókusz-sorrend, újrapróbálás, `setServerError`) |
| `apps/admin/src/test/mocks/app-form.fixture.ts`            | **új** — domainfüggetlen 3 mezős fixture (séma, defaultok, `fieldPaths`, labelek, copy)                                                                                                               |
| `apps/admin/src/test/mocks/app-form-harness.mock.tsx`      | **új** — fogyasztói harness a valódi `FormField`/`FormActions`/`Alert` primitívekkel                                                                                                                  |
| `apps/admin/src/test/mocks/form-notifier.mock.ts`          | **új** — `createFormNotifierMock()` a notification porthoz                                                                                                                                            |
| `apps/admin/src/test/mocks/deferred.mock.ts`               | **új** — kézzel settle-elhető promise a pending állapotokhoz                                                                                                                                          |
| `docs/Specs/Forms-and-Validation.md`                       | **új** élő spec: a minta, a submit-konvenció, D1–D11, a `FormNotifier` port, a migrációs státusz                                                                                                      |
| `docs/Specs/UI-Architecture.md`                            | fejléc (AIS-115) + **§4.4** új alfejezet + §5 megjegyzés + §6/3. lépés: a form `useAppForm`-mal készül                                                                                                |

Az `ApiKeyForm.tsx`, a `packages/ui` és a service/transport réteg **változatlan** — az `ApiKeyForm`
átállása az AIS-85-tel megy együtt.

## Kulcsdöntések

1. **D1** — a hook nem tud domain-szabályt: sémát, `fieldPaths`-t és submit-ot a hívó adja.
2. **D2** — a `notify` **injektált, opcionális port** (`FormNotifier.success`), `null` esetén a hook csendben marad, így az AIS-84 nem blokkolja.
3. **D3** — determinisztikus fókusz: a **deklarált** `fieldPaths` sorrendben alkalmazódnak a hibák, és **csak az első** kap `shouldFocus: true`-t (a `ApiKeyForm` ciklusa ma mindegyikre kérné — látens hiba).
4. **D4** — mezőre címezhető hiba nem generál notificationt; a `formError` `Alert` az egyetlen hibacsatorna, a `notify.success` az egyetlen hívási pont.
5. **D8** — a submit előtt `formError` + `clearErrors()`, siker után `reset(defaultValues)` → `notify.success` → `onSuccess`.
6. **D11** (a tervhez képest pontosítás) — `handleSubmit` a **kész** submit handler (`<form onSubmit={…}>`), nem a RHF curried függvénye, így egy oldal nem tudja megkerülni a validate → submit → reset → notify sorrendet.

## Ellenőrzés

| Parancs                                                | Eredmény                     |
| ------------------------------------------------------ | ---------------------------- |
| `pnpm --filter @callback/admin test`                   | **285 teszt / 31 fájl** zöld |
| `pnpm --filter @callback/admin lint`                   | tiszta                       |
| `pnpm --filter @callback/admin build` (`tsc --noEmit`) | tiszta                       |
| `pnpm quality` (layers, knip, palette, field-errors)   | 0 violation                  |

A hook nem ágazik el `error.status`/`error.code` alapján (a field-error gate ezt kéri): a döntés a
`lib/field-errors.logic.ts`-ben maradt, a hook csak alkalmazza.
