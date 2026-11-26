# AIS-173 — api-keys: az overlay-be költözött törlés, a legacy detail oldal nyugdíjazása

**Dátum:** 2026-11-08 17:52 · **Ticket:** AIS-173 (parent: AIS-170) · **Plan:**
[`docs/plans/2026-11-08--17-36-00-ais-173-api-keys-delete-in-view-overlay-plan.md`](../plans/2026-11-08--17-36-00-ais-173-api-keys-delete-in-view-overlay-plan.md)

## Miért

A `/api-keys/:identifier` legacy detail oldal az **egyetlen** hely volt, ahol kulcsot törölni lehetett,
ezért nem tűnhetett el addig, amíg a törlésnek nincs új helye. A törlés most a read-only overlay-be
(`/api-keys/:identifier/view`) költözött, és ezzel a régi oldal, a route-ja és a wrapper dialógus
törölhetővé vált.

## Mi változott

| Fájl | Változás |
| ---- | -------- |
| [`ApiKeyViewDialog.tsx`](../../apps/admin/src/pages/api-keys/ui/ApiKeyViewDialog.tsx:1) | `useState` megerősítés-flag, `useDeleteApiKeyMutation(identifier, { onDeleted: closeDialog })`, footer bal oldalán `Kulcs törlése` (`variant="danger"`) + a `Módosítás` link egy csoportban, közvetlenül renderelt `ConfirmDialog` (a hiba a dialógus leírása, siker után `replace` navigáció). A footer akciók csak akkor jelennek meg, ha van betöltött sor. |
| `ui/ApiKeyDeleteDialog.tsx` | **Törölve** — a wrapper beolvadt a view overlay-be (42 sor, egy használat). |
| `ApiKeyDetailPage.tsx` + `.test.tsx` | **Törölve** — a 404-ág, a page-error és a három törlés-eset átköltözött a view overlay tesztjébe. |
| `ui/ApiKeyDetailCard.tsx` + `.test.tsx` | **Törölve** — a legacy oldal után hivatkozás nélkül maradt (knip), a mezőlista (`ApiKeyDetailFields`) marad. |
| [`api-keys.const.ts`](../../apps/admin/src/pages/api-keys/api-keys.const.ts:1) | `API_KEY_DETAIL_ROUTE_PATH`, `API_KEY_DETAIL_TITLE`, `API_KEY_DETAIL_SUBTITLE`, `API_KEY_DETAIL_BACK_ARIA_LABEL` törölve; a maradó konstansok JSDoc-ja a view overlay-re mutat. |
| [`api-keys.interface.ts`](../../apps/admin/src/pages/api-keys/api-keys.interface.ts:1) | `ApiKeyDetailCardProps` és `ApiKeyDeleteDialogProps` törölve. |
| [`route-registry.tsx`](../../apps/admin/src/app/router/route-registry.tsx:1) | A `/api-keys/:identifier` entry és az `ApiKeyDetailPage` import törölve; a `:identifier` paraméter már csak a `view` és `edit` child-on él. |
| [`ApiKeyViewDialog.test.tsx`](../../apps/admin/src/pages/api-keys/ui/ApiKeyViewDialog.test.tsx:1) | Új `delete (AIS-173)` blokk: megerősítés megnyitása hívás nélkül, sikeres törlés + `replace` navigáció, „Mégsem" hívás nélkül, hiba a dialógusban (nem navigál), pending állapotban mindkét gomb tiltva; a 404/página-hiba ág most azt is állítja, hogy nincs törlés-akció. |
| `test/mocks/handlers/api-keys.handlers.ts` | Új `apiKeysDeletePending` handler (`delay('infinite')`) a pending-állítás tesztjéhez. |
| [`route-registry.test.ts`](../../apps/admin/src/app/router/route-registry.test.ts:1) | A detail-entry invariant helyére „a `:identifier` csak overlay-child" teszt lépett (view + edit, resolverrel); a view overlay crumb-tesztje váltotta a detail-oldalét. |
| `docs/Specs/UI-Architecture.md` §5 | A legacy sor törölve, a §5 overlay-tábla új sorai (törlés, siker utáni navigáció) és a **megerősítő ablak kivétel** bekezdése; a header `Utolsó frissítés` dátum frissítve. |
| `docs/Specs/New-Admin-Page.md` | 12b lépés: a read-only overlay a destruktív akció helye is, megerősítő ablak lokális flaggel; anti-pattern sor kivétellel; header dátum frissítve. |
| [`.roo/rules/react.coding-standards.md`](../../.roo/rules/react.coding-standards.md:184) §6.3 | Új szabály-mondat: a **nem navigálható** megerősítő dialógus nyitottsága lokális `useState`. |

## Drift a tickethez képest

- `toApiKeyDetailRoute()` **nem létezett** a `api-keys.logic.ts`-ben (a tábla `toApiKeyViewRoute`-tal
  linkel), így nem volt mit törölni; csak a `api-keys.logic.test.ts` `API_KEY_DETAIL_ROUTE_PATH`
  állítása esett ki.
- `API_KEY_VIEW_DELETE_LINK_LABEL` konstans sincs; a `Módosítás` link (`API_KEY_VIEW_EDIT_LINK_LABEL`)
  **marad**.
- A ticket nem írt a `ApiKeyDetailCard`-ról, de a legacy oldal törlésével hivatkozás nélkül maradt
  (knip/dead-code), ezért törölve — erről egyeztetés történt a feladóval.

## Ellenőrzés

- `pnpm --filter @callback/admin test` → 46 fájl, 539 teszt zöld.
- `pnpm typecheck`, `pnpm lint`, `pnpm quality` (layers, knip, palette, themes, field-errors, docs) → zöld.
- `rg "ApiKeyDetailPage|ApiKeyDeleteDialog|ApiKeyDetailCard" apps/admin/src` → csak a „honnan költözött"
  magyarázó kommentekben fordul elő, hivatkozás nincs.
