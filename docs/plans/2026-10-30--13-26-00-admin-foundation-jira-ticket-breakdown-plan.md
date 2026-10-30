# Admin közös alap — Jira ticket-bontás (létrehozásra kész)

**Dátum:** 2026-10-30 13:26 (Europe/Budapest)
**Státusz:** **HELYETTESÍTVE** — a témák szerinti, meglévő ticketeket újrahasznosító változat: [`2026-10-30--13-40-00-admin-foundation-jira-themes-ticket-plan.md`](2026-10-30--13-40-00-admin-foundation-jira-themes-ticket-plan.md:1). Ezt a fájlt csak történeti referenciaként tartjuk meg.
**Alap-terv:** [`2026-10-30--13-06-00-admin-unified-data-flow-and-ui-foundation-plan.md`](2026-10-30--13-06-00-admin-unified-data-flow-and-ui-foundation-plan.md:1)
**Projekt:** `AIS` — javasolt parent epic: `AIS-77 STEP-2` (ha az `AIS-86`/`AIS-87` is ott van), egyébként parent nélküli Story a projekt mintája szerint.

---

## 1. Amit létrehozok

| # | Típus | Cím | Prioritás | Hullám |
|---|---|---|---|---|
| **S1** | Story | Admin + API: egységes adatáramlás, validáció, form- és hibakezelés, UI alap | Highest | — |
| S1-1 | Subtask | shared: közös formátum-sémák és magyar zod üzenetek | Highest | A |
| S1-2 | Subtask | shared: lista- és paginációs szerződés (`ApiResult`, `listQuerySchema`) | Highest | A |
| S1-3 | Subtask | api: generikus paginált lista (`meta.pagination`, query pipe, repo count) | Highest | A |
| S1-4 | Subtask | api: update/delete konvenció (`PATCH`, `DELETE`, stale write, 422 kód) | High | A |
| S1-5 | Subtask | api-client: teljes transport (PUT/PATCH/DELETE, query builder, `ApiResult`) | Highest | A |
| S1-6 | Subtask | api-client: operation-lefedettség és új resource sablon | High | A |
| S1-7 | Subtask | admin: `src/app/` réteg (providers, router, layout, nav, session, error boundary) | Highest | C |
| S1-8 | Subtask | admin: generikus hook réteg + generikus mezőhiba-leképezés | Highest | B |
| S1-9 | Subtask | admin: lista UI state URL search params-ban + zustand store factory | High | C |
| S1-10 | Subtask | ui: form primitívek (FormField, FormActions, Select, Checkbox, DatePicker…) | Highest | B |
| S1-11 | Subtask | ui: data-display primitívek (DataTable, Pagination, EmptyState, Skeleton…) | Highest | B |
| S1-12 | Subtask | ui: overlay primitívek (Dialog, Drawer, Tooltip, DropdownMenu) Radix alapon | High | B |
| S1-13 | Subtask | admin: MSW alapú teszt harness és fixture-ek | High | C |
| S1-14 | Subtask | quality: réteg- és token-kapu a CI-ben (boundaries, knip, paletta) | High | D |
| S1-15 | Subtask | docs: UI-Architecture, Admin-Data-Flow, Forms-and-Validation | Medium | D |
| S1-16 | Subtask | agent: api-keys oldal átállítása az új alapokra (end-to-end bizonyíték) | Highest | C |
| S1-17 | Subtask | opcionális: Ladle komponens-katalógus a `packages/ui`-ra | Low | D |
| S1-18 | Subtask | opcionális: frontend hibamonitoring (Sentry/GlitchTip) | Low | D |

**Hullámok:** A = szerződés + API + transport (párhuzamosítható 3 sávon) · B = admin hook + primitívek · C = app réteg + teszt harness + api-keys átállítás · D = kapuk és dokumentáció.

---

## 2. Story S1 — teljes szöveg

**Summary:** `Admin + API: egységes adatáramlás, validáció, form- és hibakezelés, UI alap`

**Description (markdown):**

```markdown
Cél: egy új admin oldal (elsőként a cégadatok) megírása ne igényeljen új infrastruktúrát.
A fejlesztő csak a domaint írja le; a szerződést, a transportot, a hookot, a mezőhibát,
a form-elemeket, a hibafelületeket és a lista-megjelenítést készen kapja.

Négy kötelező pillér:
1. Közös adatáramlás: ApiResult<T> (data + meta), lista query-szerződés, PATCH/DELETE,
   típusos request-body a shared registryből, paginált szerver-lista, dto -> view model mapper.
2. Közös hibakezelés: ApiError -> egy döntő toErrorSurface, generikus toFieldErrors(fieldPaths),
   field/page/banner/log szintek, toast + log store.
3. Közös formkezelés: shared zod séma (szerver pipe + kliens parse + RHF resolver ugyanaz),
   FormField/FormActions primitívek, magyar mezőüzenetek, submit/reset konvenció.
4. Közös megjelenítés: DataTable, Pagination, EmptyState, Skeleton, DescriptionList,
   StatusBadge, Dialog/Drawer — token-alapú, Radix a11y-vel.

Sorrend: F1 szerződés -> F2 transport/API -> F3 hibakezelés -> F4 formkezelés ->
F5 megjelenítés -> F6 app réteg -> F7 api-keys átállítás -> F8 docs és kapuk.
A cégadatok (AIS-19/20/21) csak F7 zöld után indulnak.

Nem cél: auth implementáció (AIS-71..74), apps/web átállítás, e-mail modul.
```

**Story DoD:**

- [ ] Az `api-keys` oldal az új alapokon fut: paginált lista, közös űrlap, toast, MSW teszt.
- [ ] Egy új admin oldal megírható kizárólag a `packages/api-client` service-én, egy `features/` hookon és `packages/ui` primitíveken keresztül, új `fetch` és új dependency nélkül.
- [ ] `pnpm test`, `pnpm lint`, `pnpm --filter @callback/admin build` zöld; a CI réteg- és token-kapu aktív.

---

## 3. Subtask specifikációk

### S1-1 — shared: közös formátum-sémák és magyar zod üzenetek

**Típus:** Subtask · **Parent:** S1 · **Labels:** `shared`, `contract`, `validation`

**Leírás:**

- `packages/shared/src/contract/common/` új mappa: `email.schema.ts`, `phone.schema.ts`, `hu-tax-number.schema.ts`, `hu-postal-code.schema.ts`, `iban.schema.ts`, `date-only.schema.ts`, `url.schema.ts`, `text.schema.ts` (`trimmedString`, `nonEmptyText`, `slug`/`identifier`).
- Telefon: `libphonenumber-js` alapú validálás + E.164 normalizálás (`normalizePhone`), magyar default ország.
- Adószám: `XXXXXXXX-Y-ZZ` (8+1+2) formátum és súlyozott ellenőrző összeg.
- Dátum: `dateOnlySchema` (`YYYY-MM-DD`) a meglévő `isoDateTimeSchema` mellé; a kettő közti konverzió tiszta helper.
- **Magyar üzenetek:** egyetlen `errorMap` (`validation-error-map.const.ts`) + a `zod-i18n-map` csomag (vagy saját map, ha a verzió nem kompatibilis a zod v3-mal) — a UI magyar szöveget kap, a szerver `message` továbbra sem user copy.
- Minden séma a `contract/index.ts`-ből exportálva, mellette `*.fixture.ts` a tesztekhez.

**Elfogadási kritérium:**

- [ ] Minden séma unit tesztelve: érvényes, határérték, érvénytelen formátum, üres érték.
- [ ] A magyar hibaüzenet egy helyen él; egy RHF mező ezt rendereli.
- [ ] `pnpm --filter @callback/shared test` zöld; nincs `any`, minden helper JSDoc-kal dokumentált.

**Függőség:** nincs.

---

### S1-2 — shared: lista- és paginációs szerződés

**Típus:** Subtask · **Parent:** S1 · **Labels:** `shared`, `contract`, `architecture`

**Leírás:**

- `listQuery.schema.ts`: `page` (min 1, default 1), `limit` (1..100, default 20), `sort` (mező allow-listából), `order` (`asc`/`desc`), `q` (max 200, trim); resource-specifikus szűrők kiterjesztésként (`.extend()` / `mergeListQuery`).
- `paginated.schema.ts`: `paginatedSchema(itemSchema)` — a `data` tömb + `meta.pagination` együtt a típusban.
- `api-result.interface.ts`: `ApiResult<T> = { readonly data: T; readonly meta: ResponseMeta }`, `PageMeta` a meglévő `paginationMetaSchema`-ból.
- A meglévő `apiKeyListSchema` váltson `paginatedSchema(apiKeySchema)`-re (breaking, lásd S1-5/S1-16).

**Elfogadási kritérium:**

- [ ] A `meta.pagination` típusosan elérhető a kliens oldalon (nem `any`, nem cast).
- [ ] A registry-teszt zöld; a query séma elfogadja a hiányzó paramétert default-tal, és elutasítja a `limit > 100`-at.
- [ ] Üres lista esetén `data: []` + `meta.pagination.total = 0` szerződés-teszt.

**Függőség:** nincs (S1-1-gyel párhuzamos).

---

### S1-3 — api: generikus paginált lista

**Típus:** Subtask · **Parent:** S1 · **Labels:** `api`, `backend`, `contract`

**Leírás:**

- `@Query(new ZodQueryPipe(listQuerySchema))` használat minta + `ListQueryContext` a service-nek.
- Repository szint: `limit/offset` + `count()` egy lekérdezésben (Drizzle `$count` vagy külön count), determinisztikus `orderBy` (default `createdAt desc, id`).
- `ApiResponseService.ok(data, ctx, pagination)` kiterjesztése, hogy a `meta.pagination` bekerüljön.
- `api-keys` lista retrofittálva; a régi „minden sor” viselkedés megszűnik.

**Elfogadási kritérium:**

- [ ] e2e: `?page=2&limit=10&sort=name&order=asc&q=abc` → helyes sorok + `meta.pagination` (`page`, `limit`, `total`, `totalPages`).
- [ ] Üres találat: `200` + `data: []` (nem `404`, nem `null`).
- [ ] Érvénytelen `limit` → `400` + `VALIDATION_FAILED` + `details[].path = "limit"`.

**Függőség:** S1-2.

---

### S1-4 — api: update/delete konvenció

**Típus:** Subtask · **Parent:** S1 · **Labels:** `api`, `backend`, `contract`

**Leírás:**

- `PATCH /api/<resource>/:id` — részleges frissítés, `.strict()` request séma, `updatedAt` visszaadva.
- Optimistic concurrency: a kliens `updatedAt`-et küld (vagy `If-Match`), eltérés → `409` + új kód (`STALE_WRITE`).
- `DELETE /api/<resource>/:id` — soft delete mező (`deleted_at`) vagy kemény törlés: a döntés a ticketben dokumentálva, `404` törölt sorra.
- Új hibakódok az `API_ERROR_CODE` katalógusban: `STALE_WRITE` (409), `SEMANTIC_VALIDATION_FAILED` (422).
- A controller `responses.ok(...)` mintát követi, a service `AppError`-t dob.

**Elfogadási kritérium:**

- [ ] e2e: sikeres PATCH, stale write → `409 STALE_WRITE`, szemantikus hiba → `422 SEMANTIC_VALIDATION_FAILED`, törölt sor → `404`.
- [ ] A katalógus és a `API_CONVENTION` doksi táblázata együtt frissül (S1-15-tel).

**Függőség:** S1-2, S1-3.

---

### S1-5 — api-client: teljes transport

**Típus:** Subtask · **Parent:** S1 · **Labels:** `api-client`, `contract`, `frontend`

**Leírás:**

- `HttpClient` interfész: `get`, `post`, `put`, `patch`, `delete`, `getList` (az `ApiResult`-ot adja vissza).
- Query-string builder: `toQueryString(filters)` — tömb, `undefined`, üres string kihagyva, URL-kódolás.
- A body típusa a registry `requestSchema`-jéből származik (ne `unknown` legyen a service-határon).
- `unwrapEnvelope` bővítése: `{ data, meta }` visszaadása mellett a meglévő `data`-only viselkedés megmarad a részlet-végpontokon.
- `ApiError` változatlan (status, code, requestId, issues, details).

**Elfogadási kritérium:**

- [ ] Transport-teszt minden metódusra + query kódolásra + `meta` átadásra + hibaágra.
- [ ] Nincs `fetch` a `packages/api-client`-en kívül; nincs React import a csomagban.
- [ ] A meglévő `api-keys` tesztek az új szignatúrára átírva zöldek.

**Függőség:** S1-2.

---

### S1-6 — api-client: operation-lefedettség és új resource sablon

**Típus:** Subtask · **Parent:** S1 · **Labels:** `api-client`, `contract`, `tooling`

**Leírás:**

- `apiKeys.findByIdentifier` bekötése (a registry-ben már létezik, a kliensben nincs).
- Új resource sablon dokumentálva + egy teszt, amely a registry minden `operationId`-jára megköveteli a service-metódust (nincs kihagyott operation).
- A path továbbra is `clientPathOf('<operationId>')`-ból jön, literal nélkül.

**Elfogadási kritérium:**

- [ ] Registry ⇄ service lefedettség teszt zöld (hiányzó operation esetén piros).
- [ ] `findByIdentifier` teszt: 200 + 404 ág.

**Függőség:** S1-5.

---

### S1-7 — admin: `src/app/` réteg

**Típus:** Subtask · **Parent:** S1 · **Labels:** `admin`, `frontend`, `architecture`

**Leírás:**

- `apps/admin/src/app/`: `providers/` (QueryClient, ErrorBoundary, Session), `router/` (route registry + `ProtectedLayout`), `layout/` (header, oldalsáv/szekciók, breadcrumb), `session/` (Zustand session store a meglévő `session-token.ts` fölött).
- `App.tsx` csak kompozíció lesz; a nav a route registry-ből generálódik (nincs kézzel írt link-lista).
- Error boundary: komponenshiba → `PageErrorState`, ne fehér képernyő.

**Elfogadási kritérium:**

- [ ] `App.tsx` nem tartalmaz route-markupot vagy nav-listát.
- [ ] Új route felvétele egyetlen registry-bejegyzés.
- [ ] Deep link curl-teszt zöld (`/api-keys`, `/`), a dev proxy regex viselkedése változatlan.

**Függőség:** nincs (párhuzamos az A/B hullámmal), de a toast host miatt egyeztetendő az AIS-83/84-gyel.

---

### S1-8 — admin: generikus hook réteg és mezőhiba-leképezés

**Típus:** Subtask · **Parent:** S1 · **Labels:** `admin`, `frontend`, `contract`

**Leírás:**

- `apps/admin/src/features/api/use-api-list.ts`, `use-api-detail.ts`, `use-api-mutation.ts`: egységes `{ data, isLoading, isFetching, error, errorMessage, errorSurface, refetch }` visszatérés.
- `apps/admin/src/lib/field-errors.logic.ts`: `toFieldErrors(error, fieldPaths)` — a mostani feature-specifikus [`api-keys.logic.ts:109`](../../apps/admin/src/features/api-keys/api-keys.logic.ts:109) logika általánosítása: kód-kapu, `issues[].path` → mező, default path, első nyertes, kliens-owned üzenet.
- `entities/<entity>/<entity>.mapper.ts` konvenció dokumentálva (lista vs. detail view model).
- Az `api-keys` feature átáll a közös helperre, a saját másolat törölve.

**Elfogadási kritérium:**

- [ ] A mezőhiba-logika egy helyen él; a feature-ök csak a mezőlistát adják át.
- [ ] Tesztek: kód-kapu, ismeretlen path → form hiba, default path, duplikált path, nem-`ApiError`.
- [ ] Nincs hook, amely `status`-t vagy `code`-ot vizsgál a komponensben.

**Függőség:** S1-5.

---

### S1-9 — admin: lista UI state URL-ben + store factory

**Típus:** Subtask · **Parent:** S1 · **Labels:** `admin`, `frontend`

**Leírás:**

- Typed search-params hook: `useListParams(schema)` — parse/serialize a `listQuerySchema`-val, default értékek kihagyva az URL-ből.
- Zustand page-store factory minta (`createStore` + provider + selector hook) a tranziens UI állapotra (nyitott drawer, kijelölt sor).
- Szabály: szerver adat soha nem kerül store-ba; szűrő/sort/page az URL-ben él.

**Elfogadási kritérium:**

- [ ] Vissza/előre gomb és másolható link ugyanazt a listát adja.
- [ ] Érvénytelen query param → default, hiba nélkül.
- [ ] Store-teszt: minden action, reset navigációváltáskor.

**Függőség:** S1-2, S1-7.

---

### S1-10 — ui: form primitívek

**Típus:** Subtask · **Parent:** S1 · **Labels:** `ui`, `frontend`, `forms`

**Leírás:**

- `FormField` (label + hint + error + `aria-describedby`/`aria-invalid` egy helyen), `FormActions`, `Fieldset`/`FormSection` (szekciókhoz), `FormErrorSummary` (opcionális, fókuszálható hibalista).
- Új mezők: `Select`, `Checkbox`, `Switch`, `RadioGroup`, `Combobox` (kereshető), `DatePicker` (natív `input[type=date]` alap + maszk), `NumberInput`.
- Minden primitív token-alapú CVA variánssal, ref-forwardolással (RHF), a `packages/ui` explicit exportjain keresztül.

**Elfogadási kritérium:**

- [ ] RTL teszt minden primitívre (render, variáns, disabled, error állapot).
- [ ] a11y teszt (`vitest-axe`): label–input kapcsolat, `aria-invalid`, fókusz.
- [ ] Nincs szín-literal, nincs paletta-osztály; a meglévő `Input`/`Textarea` a `FormField`-re épül.

**Függőség:** nincs (párhuzamos).

---

### S1-11 — ui: data-display primitívek

**Típus:** Subtask · **Parent:** S1 · **Labels:** `ui`, `frontend`

**Leírás:**

- `DataTable` a `@tanstack/react-table` fölött: oszlopdefiníció, sort jelzés, sor-akciók, `aria-sort`, üres állapot slot.
- `Pagination` (oldalszám + total + limit választó), `EmptyState` (cím, leírás, CTA), `Skeleton`, `Spinner`, `DescriptionList` (detail oldalakhoz), `StatusBadge` (domain státusz → `Badge` variáns).
- Loading / empty / error / success mindegyikhez.

**Elfogadási kritérium:**

- [ ] A táblázat fejléc-sort kliens és szerver oldali módban is kezeli (controlled).
- [ ] `EmptyState` és `Skeleton` snapshot/RTL teszt.
- [ ] Nincs inline táblázat-markup a meglévő oldalakon (api-keys átáll).

**Függőség:** S1-10 (közös mezők/hibamegjelenítés), S1-2 (típusok).

---

### S1-12 — ui: overlay primitívek

**Típus:** Subtask · **Parent:** S1 · **Labels:** `ui`, `frontend`, `a11y`

**Leírás:**

- Radix alapú `Dialog`, `ConfirmDialog` (megerősítés törléshez/veszélyes művelethez), `Drawer` (oldalpanel), `Tooltip`, `DropdownMenu`.
- A vizuális réteg token-alapú CVA; a Radix csak viselkedést ad (focus trap, Esc, aria).

**Elfogadási kritérium:**

- [ ] Focus trap + Esc + `aria-modal` teszt; fókusz visszaállítás zárás után.
- [ ] `ConfirmDialog` visszaadja a választott műveletet, nem navigál.
- [ ] Bundle: csak a használt Radix csomagok importálva.

**Függőség:** nincs.

---

### S1-13 — admin: MSW alapú teszt harness

**Típus:** Subtask · **Parent:** S1 · **Labels:** `admin`, `testing`

**Leírás:**

- `msw` v2 + `src/test/mocks/handlers/` (sikeres lista, üres lista, 400 `VALIDATION_FAILED`, 409, 500, hálózati hiba), `render-with-providers` helper, fixture-ök a `packages/shared` fixture-ökből.
- Szabály: service-határ mockolása, nem `fetch` internals; a fetch-double a tesztfájlokból eltűnik.

**Elfogadási kritérium:**

- [ ] Hook-tesztek MSW-vel: loading / success / empty / error / retry.
- [ ] Nincs `vi.fn()` fetch-double a tesztfájlokban.
- [ ] `pnpm --filter @callback/admin test` zöld, nincs valós hálózat.

**Függőség:** S1-5, S1-8.

---

### S1-14 — quality: réteg- és token-kapu a CI-ben

**Típus:** Subtask · **Parent:** S1 · **Labels:** `ci`, `tooling`, `quality`

**Leírás:**

- `eslint-plugin-boundaries` (vagy `dependency-cruiser`): `app → pages → features → entities → services → lib` irány kényszerítve, page→page és feature→feature tilos.
- `knip`: halott fájl/export/dependency detektálás; a „planned” csomagra hivatkozás ne fordulhasson elő.
- Meglévő paletta-check (`rg` szabály) + mezőhiba-check (nincs `error.code ===` komponensben) beemelve a CI-be.

**Elfogadási kritérium:**

- [ ] CI piros, ha egy réteg-szabály vagy token-szabály sérül (negatív fixture-rel bizonyítva).
- [ ] A szabály a `react.coding-standards.md`-re és a `UI-Architecture.md`-re mutat.

**Függőség:** S1-7 (a mappastruktúra legyen végleges).

---

### S1-15 — docs: UI-Architecture, Admin-Data-Flow, Forms-and-Validation

**Típus:** Subtask · **Parent:** S1 · **Labels:** `documentation`, `contract`, `ui`

**Leírás:**

- `docs/Specs/UI-Architecture.md` frissítése: primitív-lista, dependency-tábla, state-tábla, `src/app/` réteg.
- Új `docs/Specs/Admin-Data-Flow.md`: szerződés → transport → hook → mapper → komponens, `ApiResult`, lista query, hibaszintek.
- Új `docs/Specs/Forms-and-Validation.md`: shared séma, `FormField`, mezőhiba-leképezés, magyar üzenetek, submit/reset.
- `API-Convention.md` §13 ismert hiányok frissítése (422 kód, stale write).
- History + milestone bejegyzés a projekt szabályai szerint.

**Elfogadási kritérium:**

- [ ] A három doksi együtt olvasva leírja a „új admin oldal” receptjét, a §9 checklist-el.
- [ ] A `**Utolsó frissítés:**` sorok naprakészek.

**Függőség:** S1-1…S1-13.

---

### S1-16 — agent: api-keys oldal átállítása (end-to-end bizonyíték)

**Típus:** Subtask · **Parent:** S1 · **Labels:** `admin`, `frontend`, `testing`

**Leírás:**

- `ApiKeysPage`: paginált lista (`DataTable` + `Pagination` + URL state), loading `Skeleton`, empty `EmptyState`, hiba page `PageErrorState`.
- `ApiKeyForm`: `FormField` + shared séma + generikus `toFieldErrors` + siker/hiba toast; a helyi `pageError` state megszűnik.
- Az `api-keys` feature saját mezőhiba-logikája törölve (S1-8-ra támaszkodik).

**Elfogadási kritérium:**

- [ ] Nincs duplikált hiba-/mezőlogika; a tesztek MSW-vel futnak.
- [ ] Pagináció és szűrés URL-ből vezérelt, deep link működik.
- [ ] Ez a ticket a mag elfogadási bizonyítéka: ha ez zöld, a cégadatok indulhatnak.

**Függőség:** S1-3, S1-5, S1-7, S1-8, S1-9, S1-10, S1-11, S1-13.

---

### S1-17 — opcionális: Ladle komponens-katalógus

**Típus:** Subtask · **Parent:** S1 · **Labels:** `ui`, `tooling`
**Leírás:** `packages/ui` vizuális katalógus (Ladle vagy Storybook), minden primitív minden variánsban, token-lista oldallal.
**Elfogadási kritérium:** a katalógus buildel, a variánsok egy helyen áttekinthetők.
**Függőség:** S1-10, S1-11, S1-12.

---

### S1-18 — opcionális: frontend hibamonitoring

**Típus:** Subtask · **Parent:** S1 · **Labels:** `admin`, `frontend`, `observability`
**Leírás:** Sentry/GlitchTip bekötés: `ApiError` 5xx és `UNEXPECTED_PAYLOAD` esemény `requestId`-vel, forrás-térkép feltöltés a build során.
**Elfogadási kritérium:** egy szimulált 500 és egy drift esemény megjelenik a monitoringban a `requestId`-vel.
**Függőség:** S1-7, S1-8.

---

## 4. Meglévő ticketek — bemásolható módosítások

| Ticket | Módosítás |
|---|---|
| **AIS-19** (cég lista) | Description kiegészítés: „Előfeltétel: S1 (a közös alap) F7 zöld. A lista a `DataTable` + `Pagination` + URL search params mintát követi, `EmptyState`-tel; a query a `listQuerySchema`-t használja.” |
| **AIS-20** (cég detail) | „Előfeltétel: S1. A megjelenítés `DescriptionList` primitívvel, loading `Skeleton`, hiba `PageErrorState`, 404 külön ág.” |
| **AIS-21** (cég módosítás) | „Előfeltétel: S1. A mentés `PATCH` + `updatedAt` (stale write → 409), a mezőhibák a `details[].path`-ból, siker/hiba toast.” |
| **AIS-22** (email feldolgozás gomb) | „Előfeltétel: S1. Megerősítő `ConfirmDialog` + mutation + toast.” |
| **AIS-16** | „A cég mezőkészlet és formátumok a `packages/shared/contract/company` sémában rögzítendők (S1-1 mintájára), a UI terv ezt használja.” |
| **AIS-18** | „A DB táblák a shared `company` contractból vezetendők le; a séma a migráció előtt készüljön el.” |
| **AIS-99** | Prioritás `Highest`, ütemezés S1-2/S1-5 elé — a típusgenerálás alapja. |
| **AIS-100** | Összevonható S1-15-tel (ugyanaz a doksi-kör), vagy S1-15 után zárandó. |
| **AIS-79…AIS-85** | Megjegyzés: az `F3` fázis része; a `NotificationHost` az S1-7 layoutjában mountolható. AIS-85 (ApiKeyForm notify) egybeolvad S1-16-tal. |
| **AIS-71…AIS-74** | Megjegyzés: párhuzamos sáv; az AIS-74 a S1-7 session store-jára épül. |
| **AIS-101** | Változatlan, bármikor felvehető. |

---

## 5. Duplikáció-ellenőrzés (amit NEM hozok létre)

| Felmerült | Miért nem új ticket |
|---|---|
| Külön „api-client” story | már van: AIS-57 (Done) + AIS-94 (Done); a hiány az S1-5/S1-6 |
| Külön „hibakezelés frontend” story | AIS-95 + AIS-96 már leszállította a szinteket; a hiány a *generikus* mezőhiba (S1-8) |
| Külön „toast rendszer” | AIS-79…AIS-85 már felvéve (To Do) |
| Külön „UI kit bővítés” | AIS-61 (Done) az alap; a hiányzó primitívek S1-10…S1-12 |
| Külön „company CRUD backend” | AIS-18 (táblák) + AIS-15 alatti impl subtaskok; az S1-3/S1-4 csak a *konvenciót* adja |

---

## 6. Létrehozás utáni ellenőrzés

1. `parent = S1` listában mind a 18 subtask `To Do` állapotban, a helyes címekkel.
2. A Story description tartalmazza a négy pillért és a sorrendet (F1→F7), a DoD-t.
3. Az AIS-19/20/21/22 description-je hivatkozik az S1-re mint előfeltételre.
4. Az AIS-99 prioritása `Highest`, és az S1-2/S1-5 hivatkozik rá.
5. Nem keletkezett `In Progress` ticket, amit nem kezdtünk el.
