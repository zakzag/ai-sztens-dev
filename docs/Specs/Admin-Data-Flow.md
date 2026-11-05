# Admin Data Flow — contract → transport → service → hook → UI

**Utolsó frissítés:** 2026-11-05 (AIS-133: a fájlszintű „új erőforrás” recept egyetlen helyre, a [`New-Admin-Page.md`](New-Admin-Page.md)-ba került — ez a doksi a **folyamokat** tartja meg: a 3.6 alatti lista-adatfolyamot és a 3.7 alatti CRUD-adatfolyamot, a lépéssort nem; a korábbi, elavult szekcióhivatkozások javítva; AIS-131: a referencia-szelet teljes CRUD; AIS-116: a lista-recept; AIS-110: registry ⇄ service lefedettségi kapu)
**Story:** AIS-102 (data flow), AIS-110 (client operation coverage + resource template)
**Status:** living document — a jelenlegi állapotot írja le, nem pillanatképet.

---

## 1. Az adat útja egy rétegen át

```text
@callback/shared      contract/            zod séma + registry bejegyzés (`operationId`) + fixture
@callback/api-client  <resource>/          service (a path a registry-ből, a válasz a sémával parse-olva)
apps/api              <resource>/          controller (`responses.ok`) → service (AppError) → repository (Drizzle)
apps/admin            features/<use-case>/ query/mutation hook + `*.logic.ts` + query key konstans
apps/admin            entities/<entity>/   dto → view model mapper
apps/admin            pages/<page>/        kompozíció + `ui/` részek
```

Két szabály, amit ez a doksi **nem** ismétel meg, mert máshol él:

| Téma                                                                                                    | Hol van leírva                                       |
| ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| A HTTP szerződés (envelope, hibakódok, lista query, `PATCH`/`DELETE` konvenció, `operationId` registry) | [`API-Convention.md`](API-Convention.md) §1–§8, §4.2 |
| Az admin rétegek, tokenek, primitívek, state-bucketek, primitív-vokabulár                               | [`UI-Architecture.md`](UI-Architecture.md) §3.3, §4, §6 |
| Az „új admin oldal” lépéssor (fájlnév-szintű, réteg-sorrendű) — **az egyetlen igazságforrás**          | [`New-Admin-Page.md`](New-Admin-Page.md)             |

Ez a doksi a **kettő közötti** részt fedi le: hogyan lesz egy végpontból működő admin adatfolyam, és
hogyan lehet ezt egy új erőforrásra másolni.

---

## 2. Ki a felelős miért

| Réteg                 | Felelősség                                                  | Tilos benne                               |
| --------------------- | ----------------------------------------------------------- | ----------------------------------------- |
| `packages/shared`     | Az egyetlen igazság: séma, registry, fixture                | Bármilyen hálózat vagy React              |
| `packages/api-client` | Hívás + **válasz**-parse; a path-ot a registry-ből veszi    | React, `import.meta.env`, literal route   |
| `apps/api`            | Validálás (pipe), üzleti döntés (`AppError`), perzisztencia | Válaszforma-definíció                     |
| `apps/admin/features` | Query/mutation hook, cache-invalidálás, tiszta szabályok    | JSX, közvetlen service-hívás komponensből |
| `apps/admin/entities` | dto → view model (tiszta mapper)                            | Effekt, fetch, page state                 |
| `apps/admin/pages`    | Kompozíció, loading/empty/error/success                     | Új üzleti szabály                         |

---

## 3. New resource template

A fájlnév-szintű, réteg-sorrendű recept **egyetlen** helye a [`New-Admin-Page.md`](New-Admin-Page.md)
(owner AIS-133). Az ottani §2 tábla sorolja fel a létrehozandó fájlokat abban a sorrendben, ahogy a
réteg-kapu megköveteli — contract → `endpoint.registry` → shared tesztek → api-client →
`service.registry` → api → drizzle → api tesztek → features → entities → pages → opcionális store →
route-registry → (nav: nincs teendő) → MSW handler → `UI-Architecture.md` §5 state-plan sor —, és
mindegyiknél a kötelező tartalmat is.

Ez a doksi azt tartja meg, amit a checklist nem tud kifejezni:

| Marad itt | Miért |
| --- | --- |
| §2 réteg-felelősségek | táblázat arról, mi **tilos** egy rétegben — nem lépés, hanem szabály |
| §3.6 a lista adatfolyama | egy vonal, a `useListParams → useApiList → DataTable` sorrend |
| §3.7 a detail/edit/delete adatfolyama | a teljes CRUD-szelet öt szabálya |

Az HTTP-oldali szerződés (envelope, lista query, `PATCH`/`DELETE` szemantika, `operationId` registry)
továbbra is a [`API-Convention.md`](API-Convention.md) §1.1 és §4.2-ben él; a registry ⇄ service
lefedettségi kapu (`packages/api-client/test/service-coverage.test.ts`) automatikusan elkapja az
eltérést, ezért egy új erőforrás nem igényel külön tesztet ehhez.

### 3.6 Egy lista adatfolyama (AIS-116)

Egy lapozott lista **egy** vonalon fut, és minden lépésnek megvan a maga helye. Az `api-keys` a
referencia:

```text
URL (?page=&limit=&sort=&order=&q=)
  → useListParams(apiKeyListQuerySchema)      features/api/use-list-params.ts   (parse + write, egy setParams = egy URL-írás)
  → useApiKeysQuery(params)                   features/api-keys/use-api-keys.ts (a params a query key-ben)
  → useApiList { data, meta, isLoading, … }    features/api/use-api-list.ts
  → toApiKeyViewModels(apiKeys)                entities/api-key/api-key.mapper.ts
  → <DataTable rows columns sort onSortChange> + <Pagination meta={meta.pagination}>   packages/ui
  → onPageChange / onLimitChange / onSortChange → vissza az URL-be (setParam / setParams)
```

Négy szabály, ami ezt a vonalat egyben tartja:

1. **A lap/lapméret/rendezés az URL-ben él**, nem store-ban és nem `useState`-ben — ezért a
   `DataTable` és a `Pagination` **soha** nem tárol oldalt, csak jelez (`onPageChange`, `onSortChange`).
2. **A `DataTable` nem rendez helyben.** A sorrend a szerveré; a tábla a kért rendezést jelenti
   (`DataTableSort`), a page pedig a `pages/<page>/<page>.logic.ts`-ben fordítja vissza query-vá
   (`toSortParams`), és egyetlen `setParams` hívással írja ki — két mező (`sort` + `order`) egy
   írásban, különben a második felülírná az elsőt.
3. **A lapozó a `meta.pagination`-t fogyasztja.** A `Pagination` meta-típusa strukturális
   (`packages/ui` nem függ a `@callback/shared`-től), ezért a hook `meta.pagination`-ja közvetlenül
   átadható; a lapméret-opciókat a **page** adja (`API_KEYS_LIMIT_OPTIONS`).
4. **Hiba → page szint.** A lista hibája nem a tábláé: `errorSurface === 'page'` → `PageErrorState`
   retry-jal, a `banner` feltételeket a layout mutatja (lásd `UI-Architecture.md` §4.1).

A négy megjelenítési állapot így oszlik meg: loading → skeleton sorok (fejléc marad) + `sr-only`
státuszszöveg; üres → `EmptyState`; siker → sorok + lapozó; hiba → `PageErrorState`.

### 3.7 Egy detail + edit + delete adatfolyama (AIS-131)

A referencia-szelet a listán túl a **teljes CRUD**-ot mutatja. Az `api-keys` a minta itt is; a cégek
(AIS-20/21/22) ezt másolják.

```text
URL (/api-keys/:identifier)                     a lap azonosítója az URL-ben (useParams)
  → useApiKeyDetailQuery(identifier)            features/api/use-api-keys.ts
  → useApiDetail<ApiKey>                        features/api/use-api-detail.ts (query key: API_KEYS_QUERY_KEYS.detail)
  → toApiKeyDetailViewModel(dto)                entities/api-key/api-key.mapper.ts (token eldobva, időpontok formázva, expiry → StatusBadge)
  → <DescriptionList> + <StatusBadge>           packages/ui
  → <ApiKeyEditForm> (useAppForm)               defaultValues a detail-ből; submit = PATCH
  → useUpdateApiKeyMutation(identifier)         invalidate: API_KEYS_QUERY_KEYS.all
  → <ApiKeyDeleteDialog> (ConfirmDialog) → useDeleteApiKeyMutation(identifier) → navigate(lista)
```

Öt szabály, ami a szeletet összetartja:

1. **Egy route, egy registry bejegyzés.** A detail route (`API_KEY_DETAIL_ROUTE_PATH`) a page
   konstansában él, mert a tábla linkje és a registry is ugyanazt a literált használja; a `pages` nem
   importálhat `app`-ot. A registry-teszt pineli a lista-path egyezését.
2. **A `PATCH` mindig viszi az `updatedAt`-et.** A `useAppForm` `submit`-ja a page-en keresztül megy,
   mert a verzió-token és a `STALE_WRITE` döntés a page-é; a form csak az értékeket adja.
3. **`409 STALE_WRITE` → page szintű `Alert` + újratöltés, nem mezőhiba.** A döntés a allowlistelt
   `isStaleWriteFailure` (`lib/error-surface.logic.ts`); komponensben tilos `error.code ===` vizsgálat.
4. **`422 SEMANTIC_VALIDATION_FAILED` → mezőn.** A `toFieldErrors` a `details[].path` alapján teszi a
   hibás inputra, és az kap fókuszt.
5. **Sikeres mentés után a form újramountol** (`key={updatedAt}`), mert a `useAppForm` a
   `reset(defaultValues)`-szel zár — statikus default-okkal a mentés előtti értékek jönnének vissza.

Törlés: a `ConfirmDialog` csak a döntést jelenti; a dialógus addig marad nyitva, amíg a mutáció nem
sikerül, hiba esetén a leírása a leképezett hibaüzenet (nem toast, nem eltűnő dialógus).

---

## 4. Definition of done egy új erőforrásra

- [ ] séma + registry bejegyzés + fixture a `packages/shared`-ben;
- [ ] service implementáció + **egy sor** a `service.registry.ts`-ben;
- [ ] `pnpm --filter @callback/api-client test` zöld (a lefedettségi kapu az `api-keys` mintán túl is tartja a szabályt);
- [ ] controller/service/repository + pipe- és e2e-tesztek az `apps/api`-ban;
- [ ] hook + `*.logic.ts` + query key konstans az adminban, loading/empty/error/success állapotokkal;
- [ ] `API-Convention.md` §1.1 registry-táblája (ha van) és az OpenAPI generált példái az új bejegyzést tartalmazzák.
