# AIS-35 ellenőrzés, grant-mátrix szinkronizálás és Jira lezárás

**Dátum:** 2026-10-20
**Jira:** AIS-35 (Subtask) — szülő: AIS-29 — státusz: `In Review` → **`Done`**
**Kapcsolódó:** [`2026-10-19--21-30-00-ais-35-postgres-schemas.md`](2026-10-19--21-30-00-ais-35-postgres-schemas.md),
[`2026-10-19--23-30-00-ais-36-drizzle-schema-first-migration.md`](2026-10-19--23-30-00-ais-36-drizzle-schema-first-migration.md)

## Mi történt

Az AIS-35 implementáció felauditálása során megállapítottuk, hogy a kód és a
`docs/Specs/` doksok helyesek, de a **döntési napló doksok** (history + milestone)
elmaradtak az AIS-36 delta mögött, és a Jira ticket lezáratlan volt.

### Ellenőrzési eredmény

| DoD pont | Kód bizonyíték | Állapot |
|---|---|---|
| `platform` / `callback` / `email` sémák létrehozása | [`infra/postgres/init/02-schemas.sh`](../../infra/postgres/init/02-schemas.sh:54) | ✅ |
| `USAGE` mindhárom sémára, 3 role-nak | [`02-schemas.sh`](../../infra/postgres/init/02-schemas.sh:61) `\gexec` blokk | ✅ |
| `CREATE` jog az app role-nak | [`02-schemas.sh`](../../infra/postgres/init/02-schemas.sh:71) `callback` + `platform` | ✅ |
| Grant a `01-roles.sh`-ban is | [`01-roles.sh`](../../infra/postgres/init/01-roles.sh:77) `pg_namespace`-guarddal | ✅ |
| Idempotencia | [`_postgres-init-schemas-test.sh`](../../scripts/test/_postgres-init-schemas-test.sh:187) 2× re-run | ✅ |
| Smoke ellenőrzés | [`20-cross-service.sh`](../../scripts/test/lib/20-cross-service.sh:112) 3 check (`3` / `9` / `2`) | ✅ |
| Specs frissítve | `Infrastructure-Docker.md` §6.2, `Local-Development.md` §2b, `Database-Local.md` §8 | ✅ |

### Javított doc-drift

| Fájl | Elavult állítás | Javított |
|---|---|---|
| [`milestone`](../../docs/milestones/2026-10-19--21-30-00-postgres-schema-boundary-and-grants.milestone.md:39) | „`CREATE` only in `callback`" | `callback` **és** `platform` (AIS-36 delta), `email` csak `USAGE` |
| [`milestone`](../../docs/milestones/2026-10-19--21-30-00-postgres-schema-boundary-and-grants.milestone.md:51) | mátrix: `platform \| USAGE` | `platform \| USAGE + CREATE` |
| [`milestone`](../../docs/milestones/2026-10-19--21-30-00-postgres-schema-boundary-and-grants.milestone.md:62) | `postgres-schema-create (expects 1)` | `expects 2` |
| [`milestone`](../../docs/milestones/2026-10-19--21-30-00-postgres-schema-boundary-and-grants.milestone.md:77) | `expect PASS: 29` | `PASS: 32` (13 fresh + 8 re-run + 11 post-re-run) |
| [`history`](../../docs/history/2026-10-19--21-30-00-ais-35-postgres-schemas.md:30) | „`CREATE` a `callback`-re **kizárólag**" | `callback` + `platform`, a `platform` indoklással (könyvelő tábla) |
| [`history`](../../docs/history/2026-10-19--21-30-00-ais-35-postgres-schemas.md:44) | `PASS: 23` | AIS-36 utáni aktuális érték (`PASS: 32`) is rögzítve |

## Jira változások

- Komment (id `10656`) a ticketre: változás-lista, a hitelesített grant-mátrix,
  verifikációs parancsok (`PASS: 32`, `3`/`9`/`2` smoke értékek), doksi-hivatkozások,
  és a meglévő volume-okra vonatkozó ismert korlát.
- `transitionJiraIssue` (transition id `41`, `Done`) a státusz `In Review` → `Done`
  léptetéssel.

## Tanulság

A Specs doksik élnek és konzisztensen frissülnek, de a **plan/history/milestone
döntési naplókat** a későbbi, ráépülő taskok (itt: AIS-36) módosításai nem
frissítik vissza. Ha egy későbbi task deltát visz egy korábbi grant-mátrixra,
a szülő task naplóinak „delta" megjegyzéssel javítani kell, különben a
döntési előzmény félrevezető (a kódot nem, csak a történetet).

## Következő lépések (nem AIS-35 hatóköre)

- A droplet `pgdata` és a lokális `pgdata_local` volume-on a sémák kézzel
  érvénybe juttatása (`02-schemas.sh` re-apply vagy `down -v`) — Story 3
  automatizálja a deploy-oldali re-apply-t.