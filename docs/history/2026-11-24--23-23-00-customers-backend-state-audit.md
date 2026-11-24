# Ügyfél-backend állapot-audit — mi van tényleg meg a kódban

**Dátum:** 2026-11-24 23:23 (Europe/Budapest)
**Vizsgált állapot:** `main` = `de62e41` (PR #12 merge), ág `AIS-14-company-admin` = `5d0e9ab` + 2 lokális commit
**Cél:** annak tételes ellenőrzése git-bizonyítékokkal, hogy a korábban állított változások valóban benne vannak-e a kódban — nem pedig csak a commit üzenetekben.

---

## 1. Módszer

Minden állításhoz egy futtatható parancs és annak tényleges kimenete tartozik. Ahol a helyi munkakönyvtár állapota megtévesztő lehet (pl. deploy közben generált fájl), ott a `git grep`/`git show` a mérvadó, mert az a commitolt tartalmat nézi.

---

## 2. Állítás → bizonyíték

### 2.1 A `responsibleOperatorId` fogalom eltávolítása

| Állítás | Parancs | Eredmény | Ítélet |
| --- | --- | --- | --- |
| A mező sehol nem szerepel a kódban | `git grep -in "responsibleOperator" -- apps/api/src packages/shared/src packages/api-client/src apps/admin/src scripts` | `NINCS_TALALAT_A_KODBAN` | ✅ igaz |
| A `0008` migráció létezik és a helyes műveleteket tartalmazza | `type apps\api\drizzle\0008_fine_vulture.sql` | `DROP CONSTRAINT …_operators_id_fk` + `DROP COLUMN "responsible_operator_id"` | ✅ igaz |
| A lista-séma pontosan három szűrőt tartalmaz | `git grep -n -A6 "customerListQuerySchema = listQuerySchema" -- packages/shared/src` | `sort`, `type`, `status`, `source` — operátor nincs | ✅ igaz |
| A `customers` tábla nem hivatkozik másik táblára | `git grep -n "references no other table" -- apps/api/src/db/schema.spec.ts` | `schema.spec.ts:611` | ✅ igaz |
| A séma-modell regressziós őre 10 kapcsolatot vár | `git grep -n "relationships.length, 10" -- scripts/db` | `schema-model.logic.test.mjs:324` | ✅ igaz |
| A visszavont query-kulcs eldobása tesztelve van | `git grep -n "strips the retired responsibleOperatorId filter" -- packages/shared/test` | `customer-list-query.test.ts:88` | ✅ igaz |

### 2.2 Amit szándékosan **nem** bántottunk

| Állítás | Parancs | Eredmény | Ítélet |
| --- | --- | --- | --- |
| Az aktivitás szerzője (`operatorId`) megmaradt | `git grep -c "operatorId" -- apps/api/src/customers/customers-activities.mapper.ts` | `7` | ✅ igaz |
| A séma `operatorId` hivatkozásai (activity, audit, invited_by) megmaradtak | `git grep -c "operatorId" -- apps/api/src/db/schema.ts` | `5` | ✅ igaz |

### 2.3 CI-javítások

| Állítás | Parancs | Eredmény | Ítélet |
| --- | --- | --- | --- |
| Nincs duplikált pnpm verzió-pin a workflow-ban | `findstr /C:"version: 10" .github\workflows\ci.yml` | nincs találat | ✅ igaz |
| A build a typecheck **előtt** fut | `findstr /N /C:"Build all packages" /C:"Typecheck all packages" ci.yml` | `85: Build all packages`, `97: Typecheck all packages` | ✅ igaz |

### 2.4 Dokumentáció

| Állítás | Parancs | Eredmény | Ítélet |
| --- | --- | --- | --- |
| A docs gate zöld | `pnpm quality:docs` | `OK quality:docs: 0 violations` | ✅ igaz |
| A sémadokumentum naprakész | `pnpm db:diagram:check` | `Database-Schema.md is up to date` | ✅ igaz |
| Nincs link gitignored/generált artefaktra a spec-ekben | `git grep "](../../infra/caddy/Caddyfile.rendered" -- docs/Specs` + `git grep "](.*docs/temp" -- docs/Specs` | csak `docs/milestones/*` (nem gate-elt, történeti) | ✅ igaz |
| A képernyőszerződés deltái benne vannak | `findstr /N /C:"no pager" /C:"authorType ===" /C:"createTag" /C:"creates only the company" /C:"created by AIS-19" docs\Specs\Customers-Admin-Screens.md` | 173–175, 183–184, 263, 278, 70. sor | ✅ igaz |
| A `responsibleOperatorId` már csak changelog-bejegyzésként szerepel | `git grep -in "responsibleOperatorId" -- docs/Specs` | `API-Convention.md:9` (új bejegyzés) és `:17` (2026-11-22 történeti bejegyzés) | ✅ igaz |

### 2.5 Admin felület — **nincs meg** (és nem is kell, hogy meg legyen)

| Állítás | Parancs | Eredmény | Ítélet |
| --- | --- | --- | --- |
| Nincs customers lista oldal | `if exist apps\admin\src\pages\customers` | `NINCS` | ⛔ nem kész |
| Nincs customers feature réteg | `if exist apps\admin\src\features\customers` | `NINCS` | ⛔ nem kész |
| Nincs customer entity réteg | `if exist apps\admin\src\entities\customer` | `NINCS` | ⛔ nem kész |
| Nincs `use-tab-param` hook | `if exist apps\admin\src\features\api\use-tab-param.ts` | `NINCS` | ⛔ nem kész |
| A `zustand` nincs telepítve | `findstr /C:"zustand" package.json apps\admin\package.json` | nincs találat | ⛔ nem kész |

Ez **nem hiba**, hanem a terv szerinti állapot: az `AIS-19` … `AIS-182` szeletek még nem indultak el. A hullámterv §4 `B1`–`B23` lépései hivatkoznak ezekre a fájlokra, tehát a fájltérkép írja le őket, nem a kód.

---

## 3. Amit az audit talált és javított

| Találat | Hely | Javítás |
| --- | --- | --- |
| Elavult szűrőszám a state-plan sorban: „three implemented filters of four" — a kivezetés után nincs negyedik | `docs/Specs/Customers-Admin-Screens.md:294` (§6) | átírva „the three filters (type, status, source)" szövegre |

Ez az egyetlen tényleges eltérés, amit a korábbi állítások és a kód között találtam. A többi állítás igazolható.

---

## 4. Amit ez az audit **nem** tud igazolni

| Nyitott kérdés | Miért | Hogyan lehet lezárni |
| --- | --- | --- |
| A `0008` migráció lefutott-e a **dev / prod** adatbázison | a CI csak a saját Postgres konténerén futtatta | deploy után `\d customer.customers` ellenőrzés, előtte `SELECT count(*) … WHERE responsible_operator_id IS NOT NULL` |
| A Jira státuszok | a tábla külön rendszer | `AIS-189`, `AIS-17`, `AIS-14` → Done; a `Q-1` követő ticket lezárása |
| Hogy a `main`-en a merge **tartalma** a helyes | a PR #12 merge commitja (`de62e41`) a mérvadó; a korábbi #11 merge kiesett a történetből | `git log --oneline origin/main` + `git diff 86446f4..origin/main` |

---

## 5. Következtetés — mi van kész

| Terület | Állapot | Bizonyíték |
| --- | --- | --- |
| Adatmodell (AIS-18/177) | **kész** | 10 tábla, `0005`–`0008` migrációk, `schema.spec.ts` |
| Szerződés (AIS-16), a felelős operátor nélkül | **kész** | `customers.*.ts` a `packages/shared`-ben, 403 shared teszt |
| API (AIS-178) | **kész** | 21 művelet, 1009 API teszt, e2e + OpenAPI gate zöld |
| API-kliens | **kész** | `packages/api-client/customers/`, 296 teszt |
| Képernyőszerződés (AIS-17) | **kész** | `Customers-Admin-Screens.md` `D1`–`D16` + `D-W1`–`D-W6` |
| Felelős operátor kivezetése (AIS-189) | **kész** | `0008` migráció, 0 találat a kódban |
| Admin lista (AIS-19) | **nincs elkezdve** | nincs `pages/customers`, `features/customers`, `zustand` |
| Admin adatlap / szerkesztő (AIS-20, AIS-21) | **nincs elkezdve** | nincs `entities/customer`, nincs `use-tab-param` |
| Kapcsolattartók / felhasználók (AIS-179) | **nincs elkezdve** | — |
| Tevékenység / napló (AIS-181) | **nincs elkezdve** | — |
| Varázsló (AIS-182) | **nincs elkezdve** | — |

**Egy mondatban:** a backend (adatmodell, szerződés, API, kliens) és a teljes dokumentáció kész és zöld, az admin felület viszont **nulla százalékon** áll — az `AIS-19` az első szelet, ami tényleges UI-kódot hoz.
