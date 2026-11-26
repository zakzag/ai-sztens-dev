# Adatbázis-séma diagram generátor (`pnpm db:diagram`)

**Dátum:** 2026-11-22 16:41
**Ág:** AIS-14-company-admin
**Kapcsolódó terv:** nincs külön terv — a feladat közvetlen kérésre indult
**Kapcsolódó milestone:** [`docs/milestones/2026-11-22--16-41-00-db-schema-diagram-generator.milestone.md`](../milestones/2026-11-22--16-41-00-db-schema-diagram-generator.milestone.md)

---

## 1. Kiindulás

A kérés: készüljön a `docs/Specs/` mappába egy Markdown dokumentum, benne Mermaid
diagrammal az **összes tábláról és a köztük levő relációkról**, valamint egy script, ami
ezt a fájlt **bármikor újra tudja generálni**.

A séma forrása egyértelmű: [`apps/api/src/db/schema.ts`](../../apps/api/src/db/schema.ts)
(Drizzle séma-kód, AIS-18-cal 8 tábla, 8 enum, `platform` / `customer` / `iam` séma).

## 2. Mi készült el

| Fájl | Szerep |
| --- | --- |
| [`docs/Specs/Database-Schema.md`](../Specs/Database-Schema.md) | **generált** élő doksi: Mermaid `erDiagram`, táblánkénti oszlop- és megkötés-táblák, relációlista, enum-katalógus, újragenerálási útmutató |
| [`scripts/db/schema-diagram.mjs`](../../scripts/db/schema-diagram.mjs) | CLI: argumentumok, fájl I/O, exit kódok (`0` ok, `1` hiba, `2` elavult `--check` esetén) |
| [`scripts/db/schema-model.logic.mjs`](../../scripts/db/schema-model.logic.mjs) | tiszta parser: forrásszöveg → `{ schemas, enums, tables, relationships }` |
| [`scripts/db/schema-diagram.logic.mjs`](../../scripts/db/schema-diagram.logic.mjs) | tiszta renderer: model → Markdown (Mermaid blokk + táblák) |
| [`scripts/db/schema-diagram.const.mjs`](../../scripts/db/schema-diagram.const.mjs) / [`.errors.mjs`](../../scripts/db/schema-diagram.errors.mjs) | konstansok, illetve `SchemaDiagramError` / `SchemaSourceMissingError` / `SchemaParseError` |
| [`scripts/db/schema-model.logic.test.mjs`](../../scripts/db/schema-model.logic.test.mjs), [`schema-diagram.logic.test.mjs`](../../scripts/db/schema-diagram.logic.test.mjs), [`schema-diagram.cli.test.mjs`](../../scripts/db/schema-diagram.cli.test.mjs) | 37 teszt (parser, renderer, CLI-segédek, valós séma regressziós guard) |
| [`scripts/db/fixtures/schema.sample.ts`](../../scripts/db/fixtures/schema.sample.ts) | fixture: minden konstrukció + két „csapda” (kikommentelt oszlop, kommentben szereplő `references(`) |
| [`scripts/db/README.md`](../../scripts/db/README.md) | a mappa fájlszintű leírása, a parser hatóköre |

Root scriptek: `pnpm db:diagram` (ír) és `pnpm db:diagram:check` (csak ellenőriz, `2`-essel
jelez). A tesztek a `pnpm test:quality` részei (`scripts/db/*.test.mjs`).

Dokumentáció-frissítés: [`scripts/README.md`](../../scripts/README.md) (layout, root script,
mappa-tábla), [`docs/Specs/Database-Local.md`](../Specs/Database-Local.md) (hivatkozás + a
karbantartási szabály kiegészítése: séma-változás → `pnpm db:diagram`).

## 3. Döntések

1. **A generátor a séma-kódból dolgozik, nem futó adatbázisból.** Nincs szükség Postgresre,
   hálózatra vagy migrációs állapotra, és pontosan azt dokumentálja, amiből a migráció
   készül — így a séma-változás és a diagram egy commitba kerülhet.
2. **A parser szándékosan szűk, és inkább dob, mint hogy kihagyon.** Egy csendben kimaradó
   tábla teljesnek látszó, de hibás diagramot adna; ezért ismeretlen konstrukcióra
   `SchemaParseError` jön, és a valós sémára külön regressziós teszt figyeli a
   tábla/reláció/enum számokat.
3. **Mermaid entity-név = `<séma>__<tábla>`.** A Mermaid `erDiagram` entity-neve nem
   tartalmazhat pontot; a leképezés le van írva a doksiban, a táblánkénti szekciókban pedig a
   valódi, pontos név áll.
4. **Oszlopszintű FK-nál a megkötésnév származtatott** (`<tábla>_<oszlop>_<cél>_<oszlop>_fk`,
   a Postgres default nevezése), mert a `.references()` nem nevezi el a constraintet; a
   séma-kódban kiírt nevek (összetett FK-k) változtatás nélkül jelennek meg. A doksi ezt
   csillaggal jelöli.
5. **`--check` a dátum-sort kihagyja az összehasonlításból**, különben egy CI futás minden
   nap „elavultnak” látná a fájlt. A kimenet egyébként determinisztikus (teszt is őrzi).
6. **Builder-factory feloldás.** A `schema.ts` a timestamp-triót `function createdAt() { … }`
   factory-kbe teszi; a parser ezt feloldja, különben `createdAt createdAt` típus/név jelent
   volna meg.
7. **KNIP `ignoreDependencies: ["drizzle-orm"]`.** Az `apps/api` workspace ki van zárva a
   knipből, ezért a csak ott importált `drizzle-orm` a **root** `package.json`-hoz mérve
   mindig „unlisted” lenne. A kizárás oka a `knip.json`-ban, a magyarázat a
   [`UI-Architecture.md`](../Specs/UI-Architecture.md) §9.2 táblájában van.

## 4. Verifikáció

```bash
node scripts/db/schema-diagram.mjs            # [db:diagram] wrote … 8 tables, 8 relationships, 8 enums
node scripts/db/schema-diagram.mjs --check    # [db:diagram] … is up to date   (exit 0)
node --test scripts/db/schema-model.logic.test.mjs \
            scripts/db/schema-diagram.logic.test.mjs \
            scripts/db/schema-diagram.cli.test.mjs   # 37 passed, 0 failed
pnpm quality                                  # layers + knip + tokens + themes + field-errors + docs — mind zöld
```

Megjegyzés: a lokális gép Node **20.19.2**, a repó viszont Node ≥ 24.9-et ír elő, és a
`node --test` csak Node 22-től bontja a globot — ezért futott a teszt explicit fájllistával.
CI-ben (Node 24) a `pnpm test:quality` globja a `scripts/db/*.test.mjs`-t is felveszi.

## 5. Ismert korlátok / következő lépések

- A generátor csak azt a négy konstrukciót ismeri, amit a `schema.ts` használ
  (`pgSchema`, `enum`, `table` oszlopobjektum + constraint-tömb, factory-k). Új Drizzle-minta
  (pl. `$type<>()`, view, sequence) esetén a parser bővítése szükséges — a hibaüzenet
  megmondja, hol.
- `platform.__drizzle_migrations` szándékosan nem szerepel a diagramon (nem a `schema.ts`
  deklarálja) — a doksi külön táblázatban indokolja.
- A `--check` nincs bekötve CI-lépésként; ha kell, a `quality` job egy plusz lépése lehet.
