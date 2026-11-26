# AIS-155 — Route-alapú `EntityDialog` szabvány + api-keys lista-első oldal

**Dátum:** 2026-11-08 · **Ticket:** AIS-155 (subtaskok AIS-156 … AIS-162) · **Terv:** [`docs/plans/2026-11-07--14-46-00-ais-155-entity-dialog-standard-plan.md`](../plans/2026-11-07--14-46-00-ais-155-entity-dialog-standard-plan.md)

## Mi készült el

Az admin minden entitás-létrehozó/-módosító felülete innentől **egyetlen, route-mountolt overlay**
ablakban nyílik a lista fölött, és az `api-keys` oldal alapból csak a listát mutatja.

## `packages/ui` (AIS-156, AIS-157)

- `PlusIcon`, `CloseIcon` az ikonkészletben (Lucide `plus` / `x`, ISC), exporttal együtt.
- `Button` új `icon` slotja: dekoratív ikon a felirat előtt; `isLoading` esetén a spinner **lecseréli**
  (nem két leading glyph).
- `dialogVariants` új `fit` mérete: `w-auto max-w-[calc(100vw-2rem)] max-h-[calc(100vh-4rem)]`.
- `OverlayShell`: `headerStart` / `headerEnd` slotok, a bezárás SVG `CloseIcon` (a `✕` szöveg-glyph
  helyett), a body a scroll-konténer.
- Új `EntityDialog` primitíva: nincs `open` propja (a mount = nyitva), `submit` opcionális
  (`{ label, formId, pendingLabel?, isSubmitting? }` → footer `type="submit" form={formId}` gomb),
  `submit: null` → read-only, `footerExtras` a bal oldali akcióknak. Routert és entitást nem ismer.

## Admin (AIS-158 … AIS-161)

- `RouteEntry.children` + rekurzív `AppRouter` (`<Outlet/>` alapú overlay); a flat fogyasztók
  (`ALL_ROUTE_ENTRIES`, breadcrumb-matcher) a tiszta `flattenRouteEntries()`-en keresztül látják a fát.
- `features/entity-dialog`: `useEntityDialog(listPath)` → `navigate(listPath, { replace: true })`,
  egyetlen bezárási szabály minden overlay-hez.
- `ApiKeysPage`: lista-első, fejléc-akció „Új API kulcs” (`PlusIcon` + `buttonVariants`), `<Outlet/>`;
  az inline create űrlap eltűnt.
- `/api-keys/new` → `ui/ApiKeyCreateDialog.tsx`: a `useAppForm` itt él, a mezők `ApiKeyFormFields`-ben,
  a footer `Létrehozás` gombja a `form` attribútummal submitol, siker után `onSuccess` zár.
- `/api-keys/:identifier/view` → `ui/ApiKeyViewDialog.tsx`: read-only (`submit: null`), a
  `ApiKeyDetailFields` (a `ApiKeyDetailCard`-ból kiemelve) rendereli, footer-extraként a régi detail
  oldalra visz, ahol a törlés továbbra is elérhető.
- A táblázat sor-linkje a `/view` overlay-re mutat (`toApiKeyViewRoute`).

## Tesztek

- `packages/ui`: 496 teszt zöld (ikonok, `Button` icon slot, `EntityDialog` minden módja).
- `apps/admin`: 516 teszt zöld (`flattenRouteEntries`, registry nested invariánsok, `useEntityDialog`,
  create overlay flow 15 esettel, view overlay 8 esettel, list page + table linkek).

## Döntés, amit érdemes felidézni

- **A bezárás nem `history.back()`**: deep linkből (`/api-keys/new`) nyitott ablakból is a listára kell
  jutni, ezért `navigate(listPath, { replace: true })` — a lezárt overlay nem marad a history-ban.
- **A submit nem a formon belül van**: a footer gombja `form={formId}`-vel submitol, így a `<form>` és a
  `useAppForm` marad az egyetlen submit-út, a pending állapot pedig a formé.
- **Két azonos nevű gomb tilos**: a read-only ablak fejléc-X-e `Bezárás`, a footer gombja
  „Vissza a listához”.
- **`entity-dialog` bekerült a `SHARED_FEATURES` allow-listbe** a layer gate-ben (`forms` mintájára).

## Következő lépés (follow-up)

A régi `/api-keys/:identifier` detail oldal kivezetése, és a törlésnek a view overlay-be emelése —
addig a törlés a footer-extra linken keresztül érhető el.
