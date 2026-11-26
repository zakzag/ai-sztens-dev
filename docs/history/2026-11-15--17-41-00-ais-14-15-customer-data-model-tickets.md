# AIS-14 / AIS-15 kiegészítése az ügyfél-adatmodell tervvel

**Dátum:** 2026-11-15 17:41
**Forrás dokumentum:** [`docs/temp/2026-11-15-ugyfel-adatmodell-es-naplo-terv.md`](../plans/2026-11-15--13-15-00-ugyfel-adatmodell-es-naplo-terv.md)
**Jira:** [AIS-14](https://zakzag.atlassian.net/browse/AIS-14) (adatbázis) · [AIS-15](https://zakzag.atlassian.net/browse/AIS-15) (felület)

## Mit tettünk

A két meglévő story a korábbi, vázlatos leírás helyett a 2026-11-15-i
adatmodell-tervből származó döntéseket és sorrendet tartalmazza.

| Ticket | Változás |
| --- | --- |
| AIS-14 | Adatmodell-szekció (5 Postgres séma, legfontosabb mezők), rögzített döntések (közös `activities` / `audit_logs` tábla, cégenkénti `customer_users`, nincs számlázási adat, származtatott értékek), frissített subtask-tábla, **készítési sorrend**, bővített DoD (409 esetek, audit, tesztek), „nem része" szekció |
| AIS-15 | Hét tabos adatlap leírása, döntések (egyszerű Áttekintés, csak olvasható Napló, díj nélküli Szolgáltatások), **készítési sorrend**, DoD, blokkoltság az AIS-14-re |
| AIS-16 | D1–D8 döntések lezárva a terv alapján, enum-lista, származtatott értékek, DoD pontosítva |
| AIS-18 | `customer` + `iam` sémák tételes táblalistája, kényszerek, indexek, naming döntés (`platform.companies` → `customer.customers`) |

## Új subtaskok

| Ticket | Parent | Tartalom |
| --- | --- | --- |
| AIS-176 | AIS-14 | `service` sémák: `modules`, `plans`, `subscriptions`, `subscription_resources` — árazás nélkül |
| AIS-177 | AIS-14 | `activity` + `audit` sémák, `AuditWriter`, napló írási tilalma |
| AIS-178 | AIS-14 | ügyfél API és kapcsolódó erőforrások (contacts, tags, users, subscriptions, activities, audit) |
| AIS-179 | AIS-15 | adatlap — Kapcsolattartók és felhasználók tabok |
| AIS-180 | AIS-15 | adatlap — Szolgáltatások tab |
| AIS-181 | AIS-15 | adatlap — Tevékenység és Napló tabok |
| AIS-182 | AIS-15 | új ügyfél varázsló |

## Sorrend (rögzítve a szülőkben)

1. AIS-16 (terv) → AIS-18 (`customer`, `iam`) → AIS-176 (`service`) → AIS-177 (`activity`, `audit`) → AIS-178 (API) → AIS-14 kész.
2. AIS-17 (terv) → AIS-19 (lista) → AIS-20 (adatlap váz + Áttekintés, Cégadatok) → AIS-21 (módosítás) → AIS-179 / AIS-180 / AIS-181 (tabok) → AIS-182 (varázsló).

## Döntések (a felmerült kérdésekre adott válaszok után)

| Kérdés | Döntés | Hatás |
| --- | --- | --- |
| API erőforrás neve | **végig `customers`** | `/api/admin/customers`, `contract/customers/`, `apps/api/src/customers/`, `api-client/customers/`, `apps/admin/src/{features,entities,pages}/customers/` — AIS-14, AIS-15, AIS-16, AIS-178, AIS-179, AIS-182 átírva |
| Séma-elhelyezés | `customer` séma (nem `platform`) | a `platform` marad az infrastruktúrának (`api_keys`); AIS-18 |
| `customers.note` | **marad** rövid cég-szintű megjegyzés | AIS-14 döntés |
| Anonimizálás | **csak a `customers` sor**; az `audit_logs` JSON érintetlen | AIS-14, AIS-177 |
| `headcount_range` | **3 érték**: `sole`, `2_5`, `6_20` | AIS-16 |
| Előfizetés / szolgáltatás | **kikerült a scope-ból**, későbbi ütem | AIS-176 (Task), AIS-180 (subtask alatta), AIS-14, AIS-15, AIS-178, AIS-182 |
| Varázsló lépései | 4 lépés (típus → cégadatok → kapcsolattartó → összegzés) | AIS-182 |

## Átszervezés

- **AIS-176** átalakítva: `Subtask` (AIS-14 alatt) → **`Task`**, „Admin - később: előfizetések és
  szolgáltatások (halasztott)" — a `service` séma, az API és a felületi tab együtt.
  Az átalakítás Jira Move-zal történt; az issue kulcsa és státusza (`To Do`) nem változott,
  csak a „Status category" mező mapping esett el.
- **AIS-180** átnevezve („Admin - később: Szolgáltatások tab") és **átparentál­va** az AIS-176 alá,
  így nem blokkolja az AIS-15 lezárását.
- **AIS-14** subtask-táblája és készítési sorrendje ennek megfelelően szűkült
  (AIS-16 → AIS-18 → AIS-177 → AIS-178); az AIS-15 hat tabot tartalmaz.

## A terv 5. pontjának (nyitott kérdések) lezárása

A terv dokumentum 5. fejezete „Döntések" fejezetté alakult, és a séma is ehhez igazodott:

| # | Döntés | Hol látszik |
| --- | --- | --- |
| 1 | **Nincs `customers.note`** — minden megjegyzés `activities` bejegyzés | terv 2.3 / 3.2 / 5., AIS-14, AIS-16 (D9), AIS-18, AIS-177, AIS-15 |
| 2 | Két külön tábla: `iam.operators` és `iam.customer_users` (nem volt valódi nyitott kérdés, csak a terv kérdezett rá) | terv 5., AIS-14 |
| 3 | Szerző: **két FK oszlop** (`operator_id`, `customer_user_id`) + `CHECK`, nincs FK nélküli `author_id` | terv 3.2 / 5., AIS-14, AIS-16 (D10), AIS-177 |
| 4 | Elsődleges kapcsolattartó: **(a)** — `customer_id` denormalizálva a `contact_roles`-ba + `CHECK` | terv 3.2 / 5., AIS-16 (D11), AIS-18 |
| 5 | Anonimizálás: **csak a `customers` sor** | terv 5., AIS-14, AIS-16 (D12), AIS-177 |
| 6 | `headcount_range`: **3 érték** (`sole`, `2_5`, `6_20`) | terv 5., AIS-16, AIS-18 |

Emellett a `customer` séma döntése minden érintett ticketben szerepel (AIS-14, AIS-16, AIS-18),
és a terv 6. pontja már a `service` sémát későbbi ütemként jelöli.

## Utólagos naming-egységesítés (minden ticket)

A korábban készült felületi subtaskok még a régi `companies` nevet használták, ezeket átírtuk:

| Ticket | Változás |
| --- | --- |
| AIS-17 | „terv: admin oldal (lista, adatlap)” — `customers` utak, tab-keret, **D1–D6 döntések kitöltve** (lista oszlopok modul/díj nélkül, szerveroldali keresés, sor-akciók, két route, `useApiDetail`) |
| AIS-19 | `packages/api-client/src/customers/`, `features/customers/`, `pages/customers/`; oszloplista a D1 szerint |
| AIS-20 | „cég adatlap (megjelenítés)” — adatlap váz + tab-keret + Áttekintés / Cégadatok tab |
| AIS-21 | „cég adatlap (módosítás)” — `customers` utak, mezők AIS-16 szerint, **nincs megjegyzés mező**, státuszváltás külön akció |

Emellett az **AIS-22** (emailek feldolgozása gomb) hivatkozásait kivettük az AIS-15-ből, mert a
ticket már nem létezik; a funkció a „Nem része ennek a storynak” szekcióba került.

## Scope-ábra (SVG)

Készült egy wireframe a megvalósítandó képernyőkről:
[`docs/temp/2026-11-15-ugyfelek-admin-scope.svg`](../temp/2026-11-15-ugyfelek-admin-scope.svg).

| Rész | Tartalom |
| --- | --- |
| Ügyféllista | kereső + 4 szűrő, 7 oszlop (modul/díj nélkül), státusz-pillek, hiányos adat jelzés, lapozás |
| Cég adatlap | breadcrumb, fejléc status-szal és szerkesztés gombbal, 6 tab (Áttekintés aktív), Áttekintés tartalom, Napló sor-minta |
| Varázsló | 4 lépés (Típus → Cégadatok → Kapcsolattartó → Összegzés), `POST /api/admin/customers` |
| Hatókör | benne van / nincs benne (szerződés, számlázás, előfizetés → AIS-176), adatmodell-sémák |

Az SVG XML-validált (`[xml]` parse zöld), 1440×1060, sima wireframe-stílus (nincs fotó vagy AI-generated
asset), így Jira-hoz csatolható és VS Code-ban/böngészőben megnyitható.

## Nyitott maradt

Nincs nyitott kérdés a ticketekben; a terv dokumentum a `service` sémát (későbbi ütem) továbbra is
leírja, mert az a későbbi AIS-176 alapja.
