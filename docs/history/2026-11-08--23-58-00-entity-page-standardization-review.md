# Entity page standardization — review

**Dátum:** 2026-11-08 23:58
**Típus:** review + plan (nem történt kódváltozás)
**Kapcsolódó plan:** [`2026-11-08--23-58-00-entity-page-standardization-plan.md`](../plans/2026-11-08--23-58-00-entity-page-standardization-plan.md)
**Milestone:** [`2026-11-08--23-58-00-entity-page-standardization-decisions.milestone.md`](../milestones/2026-11-08--23-58-00-entity-page-standardization-decisions.milestone.md)

---

## Mit vizsgáltunk

Az `api-keys` referencia-szelet és a mögötte lévő infrastruktúra átvizsgálása abból a
szempontból, hogy egy **új entitás-oldal** esetén mi már újrahasználható, és mi az, amit
még mindig másolni kell.

Érintett fájlok (olvasás, nem módosítás):

- `apps/admin/src/pages/api-keys/**` — `ApiKeysPage`, `api-keys.const.ts`,
  `api-keys.logic.ts`, `api-keys.interface.ts`, `ui/ApiKeysTable`, `ui/ApiKeyCreateDialog`,
  `ui/ApiKeyViewDialog`, `ui/ApiKeyEditDialog`, `ui/ApiKeyEditDialogForm`,
  `ui/ApiKeyFormFields`, `ui/ApiKeyDetailFields`
- `apps/admin/src/features/**` — `api/use-api-list`, `use-api-detail`, `use-api-mutation`,
  `use-list-params`, `api-hooks.logic`, `api-keys/**`, `entity-dialog/use-entity-dialog`,
  `forms/use-app-form.interface`
- `apps/admin/src/app/**` — `router/route-registry.tsx`, `app.const.ts`
- `apps/admin/src/lib/error-surface.logic.ts`
- `packages/api-client/src/**` — `api-keys/api-keys.service.ts`, `api-keys.path.ts`,
  `endpoint-path.ts`
- `packages/ui/src/**` — `index.ts`, `entity-dialog.interface.ts`, `page-shell.interface.ts`
- `scripts/quality/field-error-gate.const.mjs`, `package.json` scripts

## Eredmény

**Az architektúra szabványos, az entitásonkénti kód nem.**

Ami készen van és nem kell újra megírni entitásonként: `EntityDialog`/`ConfirmDialog`
ablakok, `PageShell`, `DataTable`/`Pagination`/`EmptyState`/`DescriptionList`/`StatusBadge`,
a route-registry + nav + breadcrumb hármas, `useListParams` (URL), a teljes
notifikációs lánc, az error-surface rétegzés, és a contract → api-client → generic hookok
API-útvonal.

Ami entitásonként **másolódik** (14 finding, F1–F14 a planben): a négyállapotú overlay-body
(F1), a `errorSurface === 'page'` vetítés (F2), a három registry-child (F3), a négy
sort/route segédfüggvény (F4, F5), az öt hook adapter (F6), a query-key factory (F7), a
`<form>` + `Alert` blokk (F8), a duplikált mező-feliratok (F9), a két list-path literál
(F10), valamint négy housekeeping-tétel (F11–F14).

## Gate-állapot

Nem találtunk szabálysértést. A keresések (`fetch`, nyers `useForm`, `any`, default export,
`history.back()`, színliterál, palette class) nulla találatot adtak `apps/admin/src`-ben; a
`quality:field-errors` gate a maga allowlistjével szintén tiszta. A dokumentált kivételek
(login, placeholder, not-found, calls, AIS-173 megerősítő ablak) helyben vannak.

## Következmény

A plan 16 standardizációs tételt (S1–S16) javasol, sorrendezve: S7 → S2/S8 → S1 → S4 → S6
→ S3 → S9/S10 → S5 → S11–S16 → S12/S15. Egyik tétel sem igényel új fogalmat — mindegyik
meglévő, már helyesen működő kód áthelyezése vagy paraméterezése.
