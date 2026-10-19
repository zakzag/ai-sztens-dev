# AIS-35 — Per-context Postgres sémák és jogosultságok (implementáció)

**Dátum:** 2026-10-19
**Jira:** AIS-35 (Subtask) — szülő: AIS-29
**Terv:** [`2026-10-19--21-15-00-ais-35-postgres-schemas-plan.md`](2026-10-19--21-15-00-ais-35-postgres-schemas-plan.md)

## Mit kellett megoldani

Az AIS-29 story a visszahívási tárhelyet Postgres-re teszi át, a `callback_requests`
tábla a `callback` sémába kerül. Az init scriptek viszont eddig csak role-okat
hoztak létre — sémát és sémaszintű grantot nem —, így a Drizzle migrációs
runner `permission denied for schema callback`-dal állt volna meg.

## Változások

| Fájl | Változás |
|---|---|
| [`infra/postgres/init/02-schemas.sh`](../../infra/postgres/init/02-schemas.sh) | Új, idempotens init script: `CREATE SCHEMA IF NOT EXISTS` a `platform`, `callback`, `email` sémákra, majd `\gexec`-alapú grantok. Fejléc: `DO $$` tilalom, first-run-only viselkedés, manuális újrafuttatás, grant-mátrix, role-név literálok |
| [`infra/postgres/init/01-roles.sh`](../../infra/postgres/init/01-roles.sh) | `pg_namespace`-re guardolt `GRANT USAGE` (3 séma × 3 role) és `GRANT CREATE ON SCHEMA callback` blokk, plusz fejléc-magyarázat arról, miért no-op ez friss initen |
| [`scripts/test/_postgres-init-schemas-test.sh`](../../scripts/test/_postgres-init-schemas-test.sh) | Új teszt: eldobható `postgres:16-alpine` konténer az init könyvtárral bind-mountolva; friss init ellenőrzés, majd a két script kétszeri újrafuttatása és újraellenőrzés |
| [`scripts/test/lib/20-cross-service.sh`](../../scripts/test/lib/20-cross-service.sh) | Három új smoke check: `postgres-schemas`, `postgres-schema-usage` (9 sor = 3 séma × 3 role), `postgres-schema-create` (csak `aisztens`) |
| [`docs/Specs/Infrastructure-Docker.md`](../../docs/Specs/Infrastructure-Docker.md) | §6.2: mindkét init script, séma↔kontextus mapping, grant-mátrix, manuális újrafuttatás, a tesztek hivatkozása; service-tábla és `Utolsó frissítés` frissítve |
| [`docs/Specs/Local-Development.md`](../../docs/Specs/Local-Development.md) | §2b: a két init script táblázata, a meglévő `pgdata_local` volume következménye, re-apply és `down -v` recept |

## Döntések

- **Séma DDL külön scriptben (`02-schemas.sh`)** — alfabetikusan a `01-roles.sh`
  után fut, és önállóan újrafuttatható meglévő volume-on.
- **Grant-mátrix**: `USAGE` mindhárom sémára az `aisztens`, `tkovari` és `krak`
  role-nak; `CREATE` a `callback`-re **kizárólag** az `aisztens` role-nak.
  Az operátorok jogosultsága olvasási célú, object-létrehozáshoz nem elég.
- **A grantok a `01-roles.sh`-ban is szerepelnek**, `pg_namespace`-re guardolva:
  a ticket ott kéri őket, a guard miatt a fájl sorrend-független és idempotens
  marad (friss initen no-op).
- **Séma-tulajdonos a bootstrap superuser** marad, nincs `ALTER SCHEMA ... OWNER`.
- **A `drizzle` bookkeeping séma nem része ennek a tasknak**: az `aisztens` a
  database tulajdonosa, így a migrátor létre tudja hozni (AIS-36/38 igazolja).

## Bizonyíték / verifikáció

`bash scripts/test/_postgres-init-schemas-test.sh` → **PASS: 23  FAIL: 0**

- friss init (entrypoint futtatta a `01`-et és `02`-t): 3 séma, `aisztens`
  USAGE ×3 + CREATE a `callback`-re, `tkovari`/`krak` USAGE ×3 és CREATE nélkül;
- a két script kétszeri újrafuttatása mindkét körben exit 0 (idempotencia),
  utána ugyanazok az assertek zöldek;
- a smoke suite két aggregált query-je (`9` USAGE sor, `1` CREATE sor) szó
  szerint lefut a tesztben is, így egy elgépelt SQL a gyors tesztben bukik meg,
  nem csak egy élő `pnpm test:stack` futásban.

## Tanulság (teszt-oldali)

A `pg_isready` **hamis pozitív** az init alatt: az entrypoint egy ideiglenes
szerveren futtatja az init scripteket, majd leállítja és indítja a valódit. Az
első futás ezért `FATAL: the database system is shutting down`-nal bukott a
legelső asserten. A teszt ezért két feltételre vár: a logban megjelenő
`PostgreSQL init process complete` markerre **és** egy sikeres valódi query-re.

## Nyitott pont

- Meglévő `pgdata` / `pgdata_local` volume-on az init nem fut le: a sémák
  hiányozhatnak. A kezelés dokumentálva van (re-apply vagy `down -v`), a smoke
  check pedig elkapja a hiányt. A dev szerverre a következő deploy után kézzel
  vagy `down -v`-vel kell érvényre juttatni — ez AIS-36/38 előfeltétele.
