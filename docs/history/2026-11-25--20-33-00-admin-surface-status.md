# Az admin felület állapota az AIS-181 után

**Dátum:** 2026-11-25
**Kontextus:** az [AIS-181](../milestones/2026-11-25--18-21-00-url-param-preservation-and-audit-rows.milestone.md:1)
leszállítása után készült helyzetkép: mit tud ma az `apps/admin`, és mi hiányzik még a felületről.
**Kapcsolódó:** [AIS-181 terv](../plans/2026-11-25--17-38-00-ais-181-customer-activity-and-audit-tabs-plan.md:1),
[`Customers-Admin-Screens.md`](../Specs/Customers-Admin-Screens.md:1), [`UI-Architecture.md`](../Specs/UI-Architecture.md:1)

---

## 1. Amit ma tud az admin

Az útvonalak egyetlen forrása a
[`route-registry.tsx`](../../apps/admin/src/app/router/route-registry.tsx:1).

| Útvonal | Mit tud |
| --- | --- |
| `/login` | Belépő oldal. A session **kliensoldali** (`sessionStorage` + `SessionProvider`), szerveroldali auth és szerepkör még nincs |
| `/` | Placeholder (nincs valódi irányítópult) |
| `/customers` | Keresés (`q`), három szerződéses szűrő (`type`, `status`, `source`), rendezhető oszlopok, lapozás + oldalméret — mind az URL-ben; soronként *Szerkesztés* és *Archiválás* (megerősítéssel, soft delete); üres állapot CTA-val; lista-hiba retry-jal |
| `/customers/new` | A varázsló **shellje**: lépésjelző + **csak az 1. lépés** (cégetípus) ír a page store-ba |
| `/customers/:id` | Fejléc: név + ügyfélszám + státusz-badge, *Szerkesztés*, *Státusz váltása*, *Archiválás*. Hat fül: **Áttekintés**, **Cégadatok** (négy kártyacsoport), **Kapcsolattartók** (létrehozás/szerkesztés/archiválás overlay route-okon), **Felhasználók** (meghívás/szerkesztés/visszavonás — visszavonás csak `invited` soron), **Tevékenység** (időrendi feed, jegyzetírás a négy írható típussal, inline szerkesztés + soft delete **csak** operátor-soron, lapozás), **Napló** (csak olvasható, négy URL-szűrő, kibontható before → after diff, lapozás, „csak olvasható” figyelmeztetés) |
| `/customers/:id/edit` | Teljes szerkesztő űrlap a szerződésből származtatott sémával, mezőnkénti hibák a `details[].path`-ból, `409 STALE_WRITE` figyelmeztetés újratöltéssel |
| `/api-keys` | Lista + létrehozás, megtekintés (read-only overlay), szerkesztés, törlés — mind külön címen (`/new`, `/:identifier`, `/:identifier/edit`) |
| `/calls` | Placeholder (nincs híváslista) |
| App shell | Nav + breadcrumb, **hét megjelenés** (light / dark / ambient + négy glass), toast + notification log drawer, error boundary + banner, reszponzív elrendezés |

A két AIS-181-es fül a tabváltás során is helyesen viselkedik: a lapozás nem dobja el a `?tab=`-ot, a
tabváltás viszont törli a lapozó kulcsokat.

---

## 2. Ami hiányzik a felületről

### Blokkoló — a felület ma nem tud céget létrehozni

- **Cég-varázsló 2–4. lépése + beküldés** (AIS-182). A
  [`CustomerCreatePage.tsx`](../../apps/admin/src/pages/customers/CustomerCreatePage.tsx:1) léptethető és
  a store-t írja, de a törzs mindig az 1. lépés, és nincs `POST /customers` hívás — új céget **csak
  API-ból** lehet felvenni.

### Funkcionális hiányok a meglévő képernyőkön

- **Címke-chip sáv** a Cégadatok fülön (AIS-193): a `createTag` / `attachTag` / `detachTag` a
  `packages/api-client`-ben már létezik, de nincs rájuk UI (ezért is használatlanok).
- **Kapcsolattartó-lista lapozása**: a fül a detail payloadból olvas (`D-W3`), a `customers.listContacts`
  endpoint létezik, de nincs UI — sok kapcsolattartónál nincs lapozás/keresés.
- **Cég anonimizálás**: a szerződés ismeri az `anonymized` státuszt, de nincs rá művelet (csak
  státuszváltás és archiválás).

### Teljesen hiányzó képernyők

- **Hívások** (`/calls`): híváslista, hívás-részletek (átirat, összefoglaló, felvétel), visszahívás-sor —
  ez a termék magja, ma placeholder (AIS-171).
- **Irányítópult** (`/`): nincs összesítő (mai hívások, lejárt visszahívások, konverzió).
- **Operátor-/személyzet-kezelés**: a szerződésben van `iam.operators` és `operator_role`
  (superadmin / operator), a felületen nincs oldal rá.

### Platform-szintű hiányok

- **Hitelesítés és jogosultság** (AIS-73/74): nincs login API, nincs szerepkör-alapú UI, és a szerver sem
  ellenőrzi a szerzőt — ezért kliensoldali a „saját bejegyzés” szabály (`D-W4`).
- **Felhasználói beállítások**: a fejléc user-menü gombja szándékosan inert (AIS-140 `D4`).
- **Nyelvváltás**: minden felületi copy magyar konstansokban él; a validációs szövegek viszont már
  kétnyelvűek a `@callback/shared`-ben.
- **Bulk műveletek / export**: nincs, és a szerződés sem tartalmazza.

---

## 3. Javasolt sorrend

1. **AIS-182** — a varázsló befejezése; enélkül a felület nem „teljes” egy operátor szemével.
2. **AIS-193** — címkék; kis, önálló szelet, a kliens már készen áll rá.
3. **AIS-73/74** — auth; ettől válnak valódivá a szerepkörök és a szerveroldali szerző-ellenőrzés.
4. **AIS-171 + irányítópult** — híváslista és összesítő, amint a hívás-domain elkészül.

---

## 4. Aktuális minőségi állapot

| Kapu | Eredmény |
| --- | --- |
| `pnpm --filter @callback/admin test` | 82 fájl / 905 teszt zöld |
| `pnpm --filter @callback/ui test` | 49 fájl zöld |
| `pnpm quality` | layers, dead-code, tokens, themes, field-errors, docs — 0 violation |
| `pnpm typecheck` | mind a hét package zöld |
| `pnpm lint` | zöld |
