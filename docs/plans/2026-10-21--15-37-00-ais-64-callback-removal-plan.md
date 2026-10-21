# AIS-64 — Callback funkció teljes eltávolítása (terv)

**Jira:** AIS-64 (Story) — subtaskok: AIS-65 (API), AIS-66 (DB), AIS-67 (admin), AIS-68 (docs + housekeeping), AIS-69 (web + shared)
**Dátum:** 2026-10-21
**Státusz:** jóváhagyásra vár
**Sorrend:** ez az első implementálandó story — **AIS-56 előtt**

## 1. Kiinduló állapot

| Terület | Tény |
|---|---|
| API HTTP réteg | `CallbackRequestsModule` regisztrálva az [`app.module.ts:45`](../../apps/api/src/app.module.ts:45)-ben, guard nélküli `GET/POST /api/callback-requests` |
| API store | memóriabeli `Map` a [`callback-requests.service.ts:11`](../../apps/api/src/callback-requests/callback-requests.service.ts:11)-ben |
| DB séma | `callback.callback_requests` + `callback.call_status` enum a [`schema.ts:67`](../../apps/api/src/db/schema.ts:67)-ben, alkalmazva a [`0000_pretty_bromley.sql`](../../apps/api/drizzle/0000_pretty_bromley.sql)-lel |
| Repository | [`DrizzleCallbackRequestsRepository`](../../apps/api/src/db/callback-requests.repository.ts:28) — írva és unit tesztelve, **nincs bekötve** (AIS-38 cancelled) |
| Admin | [`DashboardPage.tsx`](../../apps/admin/src/pages/DashboardPage.tsx:1) + [`lib/api.ts`](../../apps/admin/src/lib/api.ts:1) + „Kérések” nav |
| Web | [`CallbackFormPage.tsx`](../../apps/web/src/pages/CallbackFormPage.tsx:1), [`lib/api.ts`](../../apps/web/src/lib/api.ts:1), `/callback` + `/thank-you` route |
| Shared | [`callback-request.schema.ts`](../../packages/shared/src/schemas/callback-request.schema.ts:4), [`callback-request.ts`](../../packages/shared/src/types/callback-request.ts:1), exportok az [`index.ts:1`](../../packages/shared/src/index.ts:1)-ben |
| Infra | `callback` séma a [`01-roles.sh`](../../infra/postgres/init/01-roles.sh:71) és [`02-schemas.sh:55`](../../infra/postgres/init/02-schemas.sh:55) scriptekben; smoke: 3 séma / 9 USAGE / 2 CREATE |
| e2e | az `apps/api/test/*` **nem** érinti a callback endpointokat (0 találat) → nincs e2e törlés |

## 2. Scope

Törlés: API modul + repository + sémaelemek + DB objektumok + admin oldal + web flow + shared sémák + élő dokumentáció hivatkozások.

**Nem scope:** VAPI webhook modul (saját in-memory store-ja van, de nem a callback-táblához kötött), `DatabaseModule` (AIS-56), `api-keys` (AIS-39/40/41), AIS-57 frontend-alap, admin auth, `docs/history/` + `docs/milestones/` (történeti napló), termék-szintű `Functional-Specification.md` / `Kick-off-Meeting.md`.

## 3. Döntések

| # | Döntés | Miért |
|---|---|---|
| D1 | A `schema.ts` marad a séma-mint-kód forrás, callback definíciók nélkül | A `drizzle.config.ts` erre a fájlra mutat; AIS-39 újra feltölti a `platform.apiKeys`-szel |
| D2 | A drop migrációt **`db:generate`** állítja elő, nem kézi SQL | A `meta/` snapshot így konzisztens marad; a review a generált fájlon történik |
| D3 | A generált migráció végére **egy sor** kerül: `DROP SCHEMA IF EXISTS callback CASCADE;` | A `callback` séma kizárólag callback-objektumokat tartalmaz; így a tábla + enum + esetleges indexek egyben tűnnek el, és a séma maga sem marad üresen |
| D4 | A lokális/dev volume-on az init script nem fut újra → a `DROP` a migráció dolga; üres DB-n (`down -v`) az init script 2 sémát hoz létre | Az init csak első inicializáláskor fut |
| D5 | `uuid.ts` + `uuid.spec.ts` **marad** | Az `api-keys` ugyanazt a guardot fogja használni; nem callback-specifikus |
| D6 | `db/test/mocks/callback-requests.mock.ts` és `database.mock.ts` törlődik | Mindkettő kizárólag a callback repository tesztjeit szolgálja; az api-keys saját mockot kap (AIS-40) |
| D7 | Web: `/callback` és `/thank-you` route + form törlése; a `HomePage` CTA is kikerül | A rögzített döntés szerint a publikus flow is megszűnik |
| D8 | Web deps: `react-hook-form`, `@hookform/resolvers`, `zod` eltávolítása a [`apps/web/package.json`](../../apps/web/package.json:17)-ből | Csak a törölt form használta; a `zod` a `packages/shared`-ben marad (AIS-58) |
| D9 | Admin: placeholder oldal a `/` route-on, `BuildInfoFooter` marad | Az admin ne legyen üres; a footer a deploy-verziót mutatja, nem callback-specifikus |
| D10 | Élő Specs frissül, history/milestone nem íródik át | A napló történeti rekord; a Specs a jelen állapotot írja le |

## 4. Fájlok

### Törlés

| Fájl |
|---|
| `apps/api/src/callback-requests/` (controller, service, module, dto, spec) |
| `apps/api/src/db/callback-requests.repository.ts`, `.repository.interface.ts`, `.errors.ts`, `.repository.spec.ts` |
| `apps/api/src/db/schema.spec.ts` |
| `apps/api/src/db/test/mocks/callback-requests.mock.ts`, `database.mock.ts` |
| `apps/admin/src/lib/api.ts`, `apps/admin/src/pages/DashboardPage.tsx` |
| `apps/web/src/pages/CallbackFormPage.tsx`, `apps/web/src/pages/ThankYouPage.tsx`, `apps/web/src/lib/api.ts` |
| `packages/shared/src/schemas/callback-request.schema.ts`, `packages/shared/src/types/callback-request.ts` |

### Módosítás

| Fájl | Változás |
|---|---|
| [`apps/api/src/db/schema.ts`](../../apps/api/src/db/schema.ts:1) | `callbackSchema`, `CALL_STATUS_VALUES`, `callStatusEnum`, `callbackRequests`, `CallbackRequestRow`, `NewCallbackRequestRow` törlése; a fejléc-komment frissítése (2 séma) |
| [`apps/api/src/app.module.ts`](../../apps/api/src/app.module.ts:6) | `CallbackRequestsModule` import + regisztráció törlése |
| [`apps/api/src/main.ts`](../../apps/api/src/main.ts:33) | a `POST /api/callback-requests` példa cseréje semlegesre |
| [`apps/api/src/db/database.interface.ts`](../../apps/api/src/db/database.interface.ts:8) | a `callbackRequests`-re mutató komment cseréje |
| [`apps/admin/src/App.tsx`](../../apps/admin/src/App.tsx:29) | „Kérések” nav + `DashboardPage` route törlése, placeholder route |
| [`apps/web/src/App.tsx`](../../apps/web/src/App.tsx:2) | `CallbackFormPage`/`ThankYouPage` import + route + „Visszahívást kérek” CTA törlése |
| [`apps/web/src/pages/HomePage.tsx`](../../apps/web/src/pages/HomePage.tsx:16) | `/callback` CTA törlése |
| [`packages/shared/src/index.ts`](../../packages/shared/src/index.ts:1) | callback exportok törlése |
| [`apps/web/package.json`](../../apps/web/package.json:17) | D8 szerinti dependency tisztítás |
| [`infra/postgres/init/01-roles.sh`](../../infra/postgres/init/01-roles.sh:71) | `callback` kivétele a grant-mátrixból + komment |
| [`infra/postgres/init/02-schemas.sh`](../../infra/postgres/init/02-schemas.sh:55) | `CREATE SCHEMA callback` + grant sorokból kivétel, fejléc-mátrix frissítése |
| [`scripts/test/_postgres-init-schemas-test.sh`](../../scripts/test/_postgres-init-schemas-test.sh:120) | 3→2 séma, 9→6 USAGE, 2→1 CREATE |
| [`scripts/test/lib/20-cross-service.sh`](../../scripts/test/lib/20-cross-service.sh:112) | ugyanazok a számok + label szövegek |

### Új

| Fájl | Tartalom |
|---|---|
| `apps/api/drizzle/0001_*.sql` + `drizzle/meta/0001_snapshot.json` | generált drop migráció + D3 szerinti `DROP SCHEMA` sor |
| `apps/admin/src/pages/PlaceholderPage.tsx` | „Hamarosan” landing |

## 5. Lépések

1. **API törlés** — modul, service, DTO, repository, errors, mockok, `schema.ts` cleanup; `app.module.ts`, `main.ts`, `database.interface.ts` kommentek.
2. **Migráció** — `pnpm --filter @callback/api db:generate`; a generált SQL review-ja; a `DROP SCHEMA IF EXISTS callback CASCADE;` sor hozzáadása; `db:migrate` lokálisan.
3. **Shared + web + admin** — exportok, oldalak, route-ok, nav, placeholder, `apps/web/package.json`.
4. **Infra + smoke** — init scriptek és a két teszt várt értékei.
5. **Dokumentáció** — `Three-Env-Verification.md` (a `/api/callback-requests` smoke probe-ok cseréje `/healthz`-re), `Database-Local.md` §9, `Infrastructure-Docker.md` §6.2, `Local-Development.md`, `Production-Runbook.md` §7; `Utolsó frissítés` bump.
6. **Jira housekeeping** — AIS-38 cancel (kész), AIS-29 re-scope (kész), AIS-57/58/59/60/61 minta `api-keys` (kész).
7. **Napló** — `docs/history/` bejegyzés + milestone (több réteget érintő, destruktív változás).

## 6. Verifikáció

```bash
pnpm --filter @callback/api db:generate      # 0001 drop migráció
pnpm --filter @callback/api db:migrate       # alkalmazás
pnpm --filter @callback/api test
pnpm --filter @callback/shared test
pnpm --filter @callback/web build
pnpm --filter @callback/admin build
pnpm lint
pnpm build
bash scripts/test/_postgres-init-schemas-test.sh
pnpm test:stack                              # 2 séma / 6 USAGE / 1 CREATE
```

Kereséses ellenőrzés:

```bash
rg -i callback apps/api/src apps/admin/src apps/web/src packages/shared/src
rg -i callback_requests docs/Specs
DC="docker compose --env-file infra/.env.local -f infra/docker-compose.db.yml"
$DC exec -T postgres psql -U postgres -d aisztens_db -At \
  -c "SELECT count(*) FROM pg_namespace WHERE nspname = 'callback'"    # 0
```

Manuális: `pnpm dev` → web `/` betölt CTA nélkül, admin placeholderrel, API `/healthz` 200.

## 7. Kockázatok

| Kockázat | Kezelés |
|---|---|
| `db:generate` üres sémára nem ír ki migrációt | Fallback: kézi `0001_*.sql` + `meta/_journal.json` bejegyzés, throwaway konténeren verifikálva |
| A `DROP SCHEMA ... CASCADE` véletlen adatot visz | A `callback` sémában csak callback-objektumok vannak (ellenőrizve: `\dt callback.*`); adatvesztés elfogadott döntés |
| Meglévő volume nem futtatja újra az init scriptet | A drop a migráció része; üres DB-n a `down -v` + init adja a 2 sémát |
| A `Database` típus üres sémával nem használható `select`-re | AIS-39/40-ig nincs repository, ami query-t futtatna; addig csak a `DatabaseModule` (AIS-56) hozza létre a klienst |
| Smoke teszt számai elavulnak | A 4. lépés egy commitban frissíti a scripteket és a docs-ot |

## 8. As-built (2026-10-21) — eltérés a D3-tól

A D3 (DROP SCHEMA a migrációban) **nem megvalósítható**: a `callback` séma tulajdonosa a
bootstrap superuser (`POSTGRES_USER`), az `aisztens` app role csak `USAGE + CREATE` joggal
rendelkezik, ezért a `DROP SCHEMA` `permission denied`-nel elhasalt, és a drizzle
tranzakcióban az egész `0001` migrációt visszagurította.

Megvalósult megoldás:

* [`drizzle/0001_square_kat_farrell.sql`](../../apps/api/drizzle/0001_square_kat_farrell.sql)
  csak a táblát és az enumot dobja el (`DROP TABLE … CASCADE`, `DROP TYPE …`).
* A megmaradó **üres** `callback` sémát meglévő volume-on egyszeri superuser lépés viszi el:
  `docker exec infra-postgres-1 psql -U postgres -d aisztens_db -c "DROP SCHEMA IF EXISTS callback"`.
* Friss volume-on nincs teendő: a `02-schemas.sh` már csak `platform`-ot és `email`-t hoz létre.

Egyéb as-built pontok: a `uuid.ts` + `uuid.spec.ts` megmaradt (D5), a
`Database` típus üres sémával is fordul, a web csomagból a `react-hook-form`,
`@hookform/resolvers` és `zod` függőség törlődött (D8), az admin placeholder a
[`PlaceholderPage.tsx`](../../apps/admin/src/pages/PlaceholderPage.tsx)-ben él (D9).
