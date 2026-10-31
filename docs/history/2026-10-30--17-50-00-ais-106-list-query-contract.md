# AIS-106 — `shared/contract`: közös lista- és paginációs szerződés

**Dátum:** 2026-10-30 17:50 (Europe/Budapest)
**Ticket:** AIS-106 (subtask az AIS-102 alatt)
**Terv:** [`docs/plans/2026-10-30--17-25-00-ais-106-list-query-contract-plan.md`](../plans/2026-10-30--17-25-00-ais-106-list-query-contract-plan.md:1)

## Mi történt

A `packages/shared/src/contract/` kapott egy közös **lista query-szerződést** (`listQuerySchema` + a
`createListQuerySchema` factory) és a **kliensoldali paginált nézetet** (`paginatedSchema` +
`ApiResult`).

A cél: a lista-lekérdezésnek legyen egy validált alakja, és a kliens **típusassert nélkül** elérje
a `meta.pagination`-t.

## A négy új fájl

| Fájl                      | Tartalom                                                                                                                           |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `list-query.schema.ts`    | a `page`/`limit`/`sort`/`order`/`q` sémái, a konstansok, a statikus `listQuerySchema` és a `createListQuerySchema(sortBy)` factory |
| `list-query.helper.ts`    | a `ListQuery` interfész, a `mergeListQuery` és a `toListQueryParams`                                                               |
| `api-result.interface.ts` | az `ApiResult<TRows>` — `data` + **kötelező** `meta.pagination`                                                                    |
| `paginated.schema.ts`     | a `paginatedSchema(rowsSchema)` — a hiányzó `pagination` parse-hiba                                                                |

## A három döntés, ami a kódot alakította

**1. A `data` tömb marad tömb — nincs breaking.** A `successEnvelopeSchema` **változatlan**. A
`paginatedSchema` egy **új, kliensoldali** nézet: a `data` mellett a `meta.pagination`-t is
adja, kötelezően. Így a `POST` (egy objektum) és a `DELETE` (`null`) sem törik el.

**2. A `sort` allow-list miatt a séma **factory** is.** A rendezhető oszlopok erőforrás-specifikusak
(`name` az api-keys-nél, `createdAt` a cégadatoknál), ezért egy statikus séma nem tudná őket
korlátozni. A `createListQuerySchema(sortBy)` a hívó allow-listjéből **enumot** épít — így egy
ismeretlen oszlopnév **400**, és a hibaüzenet felsorolja a megengedett értékeket (nem `500` a
adatbázistól).

**3. A `paginatedSchema` a `responseMetaSchema`-ra épül, nem a `successEnvelopeSchema`-ra.** A
`successEnvelopeSchema` a payloadot `.nullable()`-lal wrapped (a `POST`/`DELETE` miatt), és a zod
`ZodNullable<ZodType<T>>` **egy extra array dimenzióval** bővíti az elemet-típust — a `body.data`
`TItem[][]` lett `TItem[]` helyett. Ezt a **`tsc` fogta meg**, nem a teszt (a zod runtime-on nem
típusoz). A megoldás: a `meta` ugyanaz a séma, a payloadot a `paginatedSchema` kezeli maga.

## A `src/index.ts` **duplikálja** a `contract/index.ts` exportjait

A terv azt feltételezte, hogy a root index re-exportálja a contract indexet — **nem**. A két fájl
két külön lista. Ez a repo meglévő mintája (a `packages/api-client` és az `apps/api` is a root
indexen importál), és a `export *` tiltva van, hogy a csomag felszíne grippelhető maradjon. Így egy
új exportet **két** helyen kell felvenni.

## Mérések

| Mérőszám                               | Előtte | Utána         |
| -------------------------------------- | ------ | ------------- |
| `packages/shared` tesztfájlok          | 5      | **9**         |
| `packages/shared` tesztek              | 99     | **146** (+47) |
| Új npm dependency                      | —      | **0**         |
| `pnpm --filter @callback/shared build` | zöld   | **zöld**      |
| `pnpm -r build`                        | zöld   | **zöld**      |

A zod-viselkedés **mérve** lett egy próba-scripttel a terv megírása előtt: a defaultok, a coercion, a
határértékek, az érvénytelen `order` és az üres `q` minden esetben a tervezett eredményt adta. Egy
megfigyelés pontosította a tervet: az üres `q` után a kulcs **jelen marad** `undefined` értékkel,
tehát a `toListQueryParams` nemcsak a defaultokat, hanem az `undefined` mezőket is kihagyja.

## Amit nem érintettünk

A `packages/api-client` (az AIS-109 transport), az `apps/api` (a `ZodQueryPipe` és az
`ApiResponseService` már kész), és az `api-keys.schema.ts` — **az AIS-75 tulajdona**, és azzal a
konfliktus megszűnt.

**Nincs szerveroldali lapozás:** a `findAll` szándékosan lapozás nélküli (a táblák
provider-hitelesítő adatokat tartalmaznak); a paginált végpont az AIS-102 T1-2 (`findAll` →
`findPage`).

## Ellenőrzés

```bash
pnpm --filter @callback/shared test    # 9 fájl, 146 teszt
pnpm --filter @callback/shared build
pnpm -r build
pnpm test
pnpm format:check
```
