# Ügyfél-adatmodell — a mockup kinyerése és a naplózási stratégia javaslata

**Dátum:** 2026-11-15 13:12 (Europe/Budapest)
**Ticket:** nincs (tervezési előkészítés, kód nélkül)
**Típus:** dokumentáció (nulla termékkód, nulla migráció, nulla új dependency)

## Probléma

Az admin „Ügyfelek" mockup ([`docs/temp/12_ugyfelek_admin_mockup.html`](../temp/12_ugyfelek_admin_mockup.html))
nyolc tabon mutatja egy ügyfél teljes életciklusát, de mögötte **nem volt adatmodell**.
Nyitott kérdés volt, hogy a tevékenység- és naplóbejegyzésekhez **cégenként külön
tábla** kell-e, vagy **egy közös tábla** minden cégnek.

Rontotta a helyzetet, hogy a mockup saját adatszerkezete (`tevekenyseg[]`,
`auditNaplo[]` az ügyfél objektum alatt) épp a cégenkénti táblák irányába mutat,
miközben a napló `tabla` mezője (`ugyfel_tevekenyseg`, `szerzodes_elfogadas`)
közös táblákra utal.

## Döntés

**Közös tábla, `customer_id` idegen kulccsal — sem az `activities`, sem az
`audit_logs` táblához nem készül cégenkénti tábla.**

Fő indokok:

1. A séma nem futásidejű dolog; cégenkénti tábla `CREATE TABLE`-t jelentene
   felhasználói műveletre, ami kizárja a migrációs fegyelmet.
2. 5 000 cégnél 10 000 tábla lenne (PK-indexekkel, TOAST-pal együtt 40–60 ezer
   reláció) — katalógus-hízás, lassuló planner és autovacuum, kezelhetetlen `pg_dump`.
3. A kereszt-céges nézetek (ügyféllista „utolsó aktivitás", riportok, globális
   naplókereső) `UNION ALL`-t igényelnének dinamikusan generált SQL-lel.
4. A valódi izolációt nem a táblanév adja: közös tábla + **RLS policy**
   (`customer_id = current_setting(...)`) védi az összes céget; cégenkénti
   tábláknál ez a védelem elveszik.
5. A volumennel szemben a helyes válasz a **havi `RANGE` partíció** az
   `audit_logs`-on, nem a táblák felaprítása.

**A tevékenység és a napló viszont két külön tábla** (`activity.activities` és
`audit.audit_logs`), mindkettő közös: más a keletkezés módja (kézi vs.
automatikus), más a módosíthatóság (javítható vs. csak beszúrás), más a séma
(`body` vs. `before_data`/`after_data` JSON diff), más a hozzáférés és a
visszatartás. Egy esemény szándékosan **mindkettőbe** bekerül (üzleti jelentés +
változás-tény), de ugyanabban a tranzakcióban.

**Nyelvi szabály:** minden adatbázis-azonosító angol (séma, tábla, oszlop, enum,
enum-érték, index- és kényszernév); a magyar csak a felületi szövegben és a
prózában marad. A mockup magyar kulcsai (`adoszam`, `probaVege`, `haviDij`)
kizárólag forrásként, a hozzárendelési táblázatokban szerepelnek.

## Változások

| Fájl | Változás |
| --- | --- |
| [`docs/temp/2026-11-15-ugyfel-adatmodell-es-naplo-terv.md`](../plans/2026-11-15--13-15-00-ugyfel-adatmodell-es-naplo-terv.md) | Új tervezési dokumentum: elnevezési konvenció (0. pont), a mockup kinyert tartalma (mezők, magyar → angol enum-térkép, származtatott értékek, a mockup 10 hibája), a közös-vs-cégenkénti döntés összehasonlítása, a tevékenység/napló szétválasztás indoklása, mezőszintű táblatervek (5 séma, 18 tábla), két mermaid diagram (ER + döntési fa), 8 nyitott kérdés |
| `docs/history/2026-11-15--13-12-00-ugyfel-adatmodell-design.md` | Ez a bejegyzés |

## Nyitott kérdések

A tervezési doksi 8. pontja 8 döntést sorol fel (cég-szintű `note` vs.
tevékenység, számlázási e-mail darabszáma, `operators` vs. `users`, polimorf
szerző hivatkozás, „egy elsődleges kapcsolattartó" kényszerítése, anonimizálás és
a napló, előfizetés-díj pillanatkép, `headcount_range` skála).

## Következő lépés

A döntések lezárása után `apps/api/src/db/schema.ts` kiegészítése a `customer`,
`iam`, `billing`, `activity`, `audit` sémákkal, majd `db:generate` → review →
`db:migrate`. **A milestone-dokumentum akkor készül el**, amikor a döntések
rögzítve vannak és a migráció ténylegesen lemegy — addig a tervezési doksi
hordozza a döntések indoklását.
