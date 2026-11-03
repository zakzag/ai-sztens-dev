# Admin Data Flow — contract → transport → service → hook → UI

**Utolsó frissítés:** 2026-11-03 (AIS-116: a lista-recept — `useListParams → useApiList → DataTable`/`Pagination`; AIS-110: „New resource template” szekció + registry ⇄ service lefedettségi kapu)
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
| Az admin rétegek, tokenek, primitívek, state-bucketek, „új oldal” recept                                | [`UI-Architecture.md`](UI-Architecture.md) §2, §12   |

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

Egy új erőforrás **öt helyen** jelenik meg, mindig ugyanabban a sorrendben. Az `api-keys` a referenci-
implementáció: a fájlnevek azért szerepelnek itt, hogy „másold az `api-keys` mappát” végrehajtható
utasítás legyen.

### 3.1 `packages/shared/src/contract/<resource>/`

| Fájl                                              | Tartalom                                                                                                                         |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `<resource>.schema.ts`                            | request séma **`.strict()`**, response séma toleráns (ismeretlen kulcsot eldob)                                                  |
| `<resource>.list-query.ts`                        | a lista query séma + a rendezhető oszlopok + a query paraméter-leírások (ha van lista)                                           |
| `<resource>.update.ts`                            | a `PATCH` partial séma, kötelező `updatedAt`-tel (ha az erőforrás módosítható)                                                   |
| `<resource>.contract.ts`                          | a registry bejegyzések (`<resource>.<action>`, method, path, `tag`, `successStatus`, `dataSchema`, `requestSchema?`, `errors[]`) |
| `<resource>.fixture.ts`                           | egy érvényes példa — ugyanaz a fixture megy a sémába a tesztben és az OpenAPI `example`-be                                       |
| `<resource>.const.ts` / `<resource>.interface.ts` | limitek, path konstans; a típusok `z.infer`-rel a sémákból                                                                       |

A registry bejegyzés hozzáadása után a `packages/shared/test/endpoint-registry.test.ts` és a
`packages/api/test/envelope-contract.e2e-spec.ts` route-audit automatikusan elkapja az eltérést.

### 3.2 `packages/api-client/src/<resource>/`

| Fájl                      | Tartalom                                                                                                               |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `<resource>.service.ts`   | `create<Resource>Service(client: HttpClient)` — a path `clientPathOf('<resource>.<action>')`-ból, **soha** nem literál |
| `<resource>.interface.ts` | a service interfésze (ezt injektálják a hookok); minden metódus fogad `options?: RequestOptions`-t                     |
| `<resource>.const.ts`     | a path konstansok + a lista query default-jai                                                                          |
| `<resource>.path.ts`      | csak akkor, ha `:identifier` helyettesítés kell — egyetlen hely, ami tudja, hogyan néz ki a placeholder                |

**Kötelező utolsó lépés:** egy sor a `packages/api-client/src/service.registry.ts`-ben

```ts
export function createServiceFactories(): ServiceFactories {
  return {
    apiKeys: createApiKeysService,
    // <resource>: create<Resource>Service,
  };
}
```

A kulcs **meg kell egyezzen** a registry namespace-szel, mert a lefedettségi kapu ebből vezeti le az
elvárást. A `packages/api-client/test/service-coverage.test.ts` piros lesz, ha egy `operationId`-hez
nincs service-metódus (`missing`), vagy ha egy service-metódusra nincs registry bejegyzés (`orphan`).
Ezért egy új erőforrás nem igényel új tesztet: csak a registry bejegyzést és a fenti egy sort.

### 3.3 `apps/api/src/<resource>/`

| Fájl                                                 | Tartalom                                                                                                                              |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `<resource>.controller.ts`                           | `@Body(new ZodBodyPipe(schema))`, `@ReqCtx()`, `this.responses.ok(await service…, ctx)`; a `DELETE` `200` + `data: null` (soha `204`) |
| `<resource>.service.ts`                              | üzleti döntés, plain adat vissza; hiba → `AppError` leszármazott                                                                      |
| `<resource>.repository.ts`                           | Drizzle; a `update`/`softDelete` **atomikus** és verzió-ellenőrzött                                                                   |
| `<resource>.mapper.ts` / `<resource>.logic.ts`       | row → dto; tiszta szabályok (pl. „múltbeli dátum”)                                                                                    |
| `<resource>.errors.ts` / `<resource>.error-guard.ts` | domain hibák és a hozzájuk tartozó HTTP-kód leképezés                                                                                 |

A `PATCH`/`DELETE` szemantikája (verzió-ütközés → `409 STALE_WRITE`, lehetetlen érték → `422
SEMANTIC_VALIDATION_FAILED`, soft delete → `404`) a [`API-Convention.md`](API-Convention.md) §4.2-ben
él; itt nem duplikáljuk.

### 3.4 `apps/admin/src/features/<use-case>/`

| Fájl                      | Tartalom                                                                        |
| ------------------------- | ------------------------------------------------------------------------------- |
| `use-<use-case>.ts`       | TanStack Query hook; a service-t injektálva kapja, cache-invalidálást itt végez |
| `<use-case>.logic.ts`     | tiszta szabályok (mapper, szűrő, döntés) — React és I/O nélkül                  |
| `<use-case>.interface.ts` | szűk hook-visszatérési típusok (`isLoading`, `errorMessage`, `errorSurface`, …) |
| `<use-case>.const.ts`     | query key-ek (**kötelező** itt deklarálni, nem a komponensben)                  |

### 3.5 `apps/admin/src/entities/<entity>/` és `pages/<page>/`

A mapper és a display-komponensek az `entities`-ben, a kompozíció a `pages`-ben. Az „új oldal” recept
lépésről lépésre a [`UI-Architecture.md`](UI-Architecture.md) §12-ben van — ott a state-tábla sorát is
fel kell venni.

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

---

## 4. Definition of done egy új erőforrásra

- [ ] séma + registry bejegyzés + fixture a `packages/shared`-ben;
- [ ] service implementáció + **egy sor** a `service.registry.ts`-ben;
- [ ] `pnpm --filter @callback/api-client test` zöld (a lefedettségi kapu az `api-keys` mintán túl is tartja a szabályt);
- [ ] controller/service/repository + pipe- és e2e-tesztek az `apps/api`-ban;
- [ ] hook + `*.logic.ts` + query key konstans az adminban, loading/empty/error/success állapotokkal;
- [ ] `API-Convention.md` §1.1 registry-táblája (ha van) és az OpenAPI generált példái az új bejegyzést tartalmazzák.
