# AIS-106 — `shared/contract`: közös lista- és paginációs szerződés

**Dátum:** 2026-10-30 17:25 (Europe/Budapest)
**Ticket:** AIS-106 (subtask az AIS-102 alatt: „Adatáramlás: lista/pagináció konvenció, PATCH/DELETE végpontok és teljes kliens-transport")
**Téma:** a lista-lekérdezésnek legyen egy közös, validált alakja, és a kliens kapjon róla **típust**, hogy a `meta.pagination` elérhető legyen.
**Státusz:** implementálva (2026-10-30)
**Implementáció:** [`docs/history/2026-10-30--17-50-00-ais-106-list-query-contract.md`](../history/2026-10-30--17-50-00-ais-106-list-query-contract.md:1) · **Milestone:** [`docs/milestones/2026-10-30--17-50-00-ais-106-list-query-contract.milestone.md`](../milestones/2026-10-30--17-50-00-ais-106-list-query-contract.milestone.md:1)

---

## 1. Kiindulási állapot (auditált)

### 1.1 Ami már létezik a `packages/shared/src/contract/`-ben

| Fájl                                            | Tartalom                                                                                                                                                                                      |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `envelope.schema.ts`                            | `paginationMetaSchema` (`page`/`limit`/`total`/`totalPages`), `responseMetaSchema` (`requestId` + `timestamp` + opcionális `pagination`), `successEnvelopeSchema<T>()`, `toSuccessEnvelope()` |
| `envelope.interface.ts`                         | `PaginationMeta`, `ResponseMeta`, `ApiEnvelope<T>`                                                                                                                                            |
| `error-envelope.ts` / `.interface.ts`           | a hibaoldali tükörképe                                                                                                                                                                        |
| `api-keys/api-keys.schema.ts`                   | `apiKeySchema`, `apiKeyListSchema` (`z.array(apiKeySchema)`), `createApiKeySchema`                                                                                                            |
| `endpoint.interface.ts`, `endpoint.registry.ts` | a `ApiEndpointContract` és a registry                                                                                                                                                         |
| `index.ts`                                      | **explicit** exportok (nincs `export *`) — minden re-export megtartja a JSDoc-ot                                                                                                              |

A `paginationMetaSchema` **már létezik** — tehát a `meta.pagination` **szerveroldalon** már
kész. Ami hiányzik: a **query** oldali szerződés (milyen `page`/`limit`/`sort`/`order`/`q` mehet
be), és a **kliensoldali** típus, amiből a `meta.pagination` elérhető **típusassert nélkül**.

### 1.2 Amit a szerver már tud (és amit nem szabad duplikálni)

| Tény                                                                           | Hol                                                                                       | Következmény                                                        |
| ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| A `ZodQueryPipe` a query objektumot validálja, és **coercet** vár              | [`zod.pipe.ts:9`](../../apps/api/src/common/http/zod.pipe.ts:9)                           | A `page`/`limit` **kötelezően** `z.coerce.number()`-os              |
| Az `ApiResponseService.ok(data, ctx, pagination?)` **már** tud paginációt adni | [`api-response.service.ts:36`](../../apps/api/src/common/http/api-response.service.ts:36) | A `meta.pagination` nem igényel szerveroldali változtatást          |
| A `successEnvelopeSchema` a `data`-t `nullable`-ként kezeli                    | [`envelope.schema.ts:61`](../../packages/shared/src/contract/envelope.schema.ts:61)       | A `data` tömb marad tömb — **nincs breaking** a response sémán (D1) |

### 1.3 Amit a kliens ma csinál (a hiány)

A [`createApiKeysService`](../../packages/api-client/src/api-keys/api-keys.service.ts:26) ma
így néz ki:

```ts
list: async (): Promise<readonly ApiKey[]> =>
  client.get(API_KEYS_PATH, apiKeyListSchema),
```

**Nincs query string**, és a `meta.pagination` **elvész**: a `client.get` a `data`-t adja
vissza, a `meta`-t eldobja. Tehát a kliens **nem tud lapozni**, és a `total`/`totalPages` sem
érhető el.

### 1.4 Az AIS-75 konfliktus — és a ticket elavult útvonala

Az AIS-106 leírása azt mondja: _„az AIS-75 ugyanazt az `api-key.schema.ts`-t módosítja → **egy
kiadásban** kell menniük"_.

**Az útvonal elavult.** Az AIS-75 a `packages/shared/src/schemas/api-key.schema.ts`-t írja, de a
valóságban a séma itt van: `packages/shared/src/contract/api-keys/api-keys.schema.ts`. Ez **már
követi** a `contract/` konvenciót.

**A konfliktus azonban valós.** Az AIS-75 a `apiKeySchema`-t módosítja (a `apiKey` mező kivétele
a read sémából + új `createdApiKeySchema`). Az AIS-106 az `api-keys.schema.ts`-t **nem** módosítja
— a listás sémák (`apiKeyListSchema`) a `api-keys.schema.ts`-ben vannak, de az AIS-106 **új
fájlokat** hoz létre (`list-query.schema.ts`, `paginated.schema.ts`, `api-result.interface.ts`).

**A terv álláspontja:** az AIS-106 **nem nyúl** az `api-keys.schema.ts`-hez. Ezzel a konfliktus
**eltűnik** — nem kell egy közös kiadás. Ha az AIS-75 később akarja használni a
`paginatedSchema`-t, akkor az **ő** módosítja az `api-keys.schema.ts`-t, és nem mi.

### 1.5 A `sort` allow-list problémája (D3)

A ticket szerint a `sort` értéke **nem** lehet szabad string: _„a hívó egy allow-listet ad át
(`z.enum([...])` vagy `.refine`), így egy ismeretlen oszlopnév `400`, nem `500`"_.

**A `listQuerySchema` ezért nem lehet egyetlen statikus séma.** Két lehetőség van:

|                                         | `listQuerySchema` (statikus) | `createListQuerySchema(sortBy)` (factory) |
| --------------------------------------- | ---------------------------- | ----------------------------------------- |
| Az `order`/`page`/`limit`/`q` validáció | ✅                           | ✅                                        |
| A `sort` allow-list                     | ❌ nem tudja                 | ✅ a hívó adja meg                        |
| Használható a `ZodQueryPipe`-ban        | ✅                           | ✅                                        |
| A kliensoldali `useListParams(schema)`  | ✅ ugyanaz a séma            | ✅ ugyanaz a séma                         |

**A terv a factory-s megoldást választja**, de a statikus `listQuerySchema`-t is exportálja
`sort` nélkül — lásd D3.

---

### 1.6 A séma-viselkedés **mérve** ellenőrizve (Node 24.22.2, zod 3.25.76)

Mielőtt a terv meg lett írva, lefuttattam egy zod-próbát a `packages/shared`-ben, hogy a séma
**tervezett viselkedése ne csak feltételezés** legyen. Az eredmény:

| Eset                                | Eredmény                                                                  |
| ----------------------------------- | ------------------------------------------------------------------------- |
| `parse({})`                         | `{ page: 1, limit: 20, order: 'desc' }` — a defaultok kitöltődnek         |
| `parse({ page: '3', limit: '50' })` | `{ page: 3, limit: 50 }` — a `z.coerce.number()` működik                  |
| `limit: ''`                         | **elbukik** (`too_small`) — a `''` → `0` coerces, ami a minimum alatt van |
| `limit: '101'`                      | **elbukik** (`too_big`)                                                   |
| `limit: '0'`                        | **elbukik** (`too_small`)                                                 |
| `page: '0'`                         | **elbukik** (`too_small`)                                                 |
| `page: '1.5'`                       | **elbukik** (`invalid_type` — a `.int()` elbukik a törton)                |
| `order: 'sideways'`                 | **elbukik** (`invalid_enum_value`)                                        |
| `q: ''`                             | `undefined` — a trim + transform helyesen short-circuitel                 |
| `q: '  abc  '`                      | `'abc'` — trimmelve                                                       |
| `q: undefined`                      | `undefined`                                                               |

**Egy megfigyelés, ami a tervet pontosítja (R3):** az üres `q` után az objektum **kulcsa
jelen marad** `undefined` értékkel (`Object.keys()` → `['q']`). Tehát a `toListQueryParams`
**nem** csak a `default` értékeket hagyja ki, hanem az **`undefined` értékű mezőket is** — különben
a `?q=undefined` kerülne a URL-be. Ez a helper feladata, nem a sémaé.

### 1.7 Az implementáció során mért zod-generikus akadály (a terv javítva)

A terv eredeti `paginatedSchema` vázlata `successEnvelopeSchema(itemSchema.array())`-t használt, és a
`ApiResult<TItem>` interfészt `data: TItem[]`-ként. Ez **nem fordult le**:

```text
src/contract/paginated.schema.ts(35,7): error TS2322:
  Type 'TItem[]' is not assignable to type 'TItem[][]'.
```

**A gyökérok:** a `successEnvelopeSchema` a payload sémát `.nullable()`-lal wrapped (a `data`
`null` lehet, ha nincs mit visszaadni). A zod `ZodNullable<ZodType<T>>` **egy extra array
dimenzióval** bővíti az elemet-típust, ha a `T` egy általános `ZodType` — vagyis a `body.data`
`TItem[][]` lesz `TItem[]` helyett. Ez **a `tsc` fogta meg**, nem a teszt (a tesztek futnak, mert
zod runtime-on nem típusoz).

**A megoldás (a repó mintájára):** a `paginatedSchema` **nem** a `successEnvelopeSchema`-ra
épül, hanem **a `responseMetaSchema`-ra** — ugyanazt a `meta`-t validálja, de a payload-ot
saját `z.object`-tel kezeli. Így:

- a `data` típusa pontos (`TRows`, nem `TRows[]`),
- a `meta` **ugyanaz** a sémából jön (nincs duplikáció),
- a `pagination` kötelezőségét egy explicit transform őrzi.

**A tanulság:** a `successEnvelopeSchema` nullable payloadja **és** a `paginatedSchema` nem
tűnik össze: az elsőnek a `data: T | null` alakja kell (a `POST`/`DELETE` miatt), a másodiknak
`data: T[]` (a lista soha nem `null`). A kettő **szándékosan** különbözik.

---

## 2. Döntések

### D1 — A `data` tömb marad tömb; nincs breaking a response sémán

**Döntés:** a `successEnvelopeSchema` **változatlan**. A `paginatedSchema` egy **új,
kliensoldali** kombinált típus, ami a `data`-t és a `meta.pagination`-t együtt adja.

**Indoklás:** a szerver ma `ApiEnvelope<readonly ApiKey[]>`-t ad — a `data` egy tömb, a
`meta.pagination` opcionális. Ha a `successEnvelopeSchema` `data`-ját tömbbé tennénk, a
`POST /api/api-keys` (egyetlen objektum) és a `DELETE` (`null`) nem férne bele. A
`paginatedSchema` ezért **nem** a response sémát módosítja, hanem a **kliensoldali** nézetet adja:
ahogy a `client.get` visszaadja, ha a service `paginatedSchema`-val parse-ol.

### D2 — A `limit` felső határa 100, a `page` 1-től indul

**Döntés:** `page` ≥ 1, `limit` 1..100, `limit` default 20, `page` default 1.

**Indoklás:** ez a ticket D2-je, és a szerveroldali `ZodQueryPipe` **ugyanezt** validálja majd,
mivel ugyanazt a sémát használja. A `limit` felső határa nem védelmi jegy — a `total`/`totalPages`
kiszámításához kell, hogy a kliens lapozója értelmes oldalszámokat mutasson.

### D3 — Két export: a statikus `listQuerySchema` és a factory `createListQuerySchema(sortBy)`

**Döntés:**

```ts
/** A statikus séma: `sort` nélkül (a `sort` oszlopnév resource-specifikus). */
export const listQuerySchema = z.object({ page, limit, order, q });

/** A factory: a hívó megadja a `sort` allow-listet. */
export function createListQuerySchema(sortBy: readonly string[]) { ... }
```

**Indoklás:** a D3 szerint egy ismeretlen `sort` **400**, nem 500. Statikus sémával ez nem
lehetséges — a `sort` oszlopnév erőforrás-specifikus (`name` az api-keys-nál, `createdAt` a
cégadatoknál). A factory az egyetlen módja annak, hogy a séma **zárt** maradjon, és a
`ZodQueryPipe` kimenete **400** legyen egy ismeretlen oszlopnévre.

A statikus `listQuerySchema` **a `sort` nélküli alap** — ezt használja az AIS-119
(`useListParams`), ahol a `sort` még nem része a scope-nak, és ez az alap, amiből a factory épül.

**A `sort` a factory-ban `z.enum`-szal** (a `readonly string[]` egy tuple-tá alakítva), nem
`.refine`-nel — így a hibaüzenet felsorolja a **megengedett** értékeket, ami a kliensnek
hasznos, a szervernek pedig ugyanaz a 400.

### D4 — A `q` trimmelt, és az üres `q` = nincs szűrés

**Döntés:** a `q` egy `z.string().trim().max(200).optional()`, és egy **transform**, ami az
üres stringet `undefined`-ra alakítja (a `''` nem kerül be a querybe).

**Indoklás:** a D4 szerint az üres `q` nincs szűrés. A `''` → `undefined` transform nélkül a
kliens `?q=`-t küldene (zaj a URL-ben), a szerver pedig egy üres stringre szűrne.

### D5 — A `mergeListQuery` és a `toListQueryParams` tiszta függvények, **külön** fájlban

**Döntés:** a `list-query.helper.ts` két **tiszta** függvényt exportál:

- `mergeListQuery(base, extra)` — a resource-specifikus szűrők (pl. `status`) **összefésülése** a
  lapos query-val. Nem írja fel a `page`/`limit`/`sort`/`order`/`q` mezőket.
- `toListQueryParams(query)` — a query → `URLSearchParams`, a **defaultokat kihagyva**.

**Indoklás:** a `toListQueryParams` default-kihagyása teszi lehetővé az AIS-119-et: _„a `?page=1`
nem látszik"_ — a URL csak a **nem-default** értékeket tartalmazza.

### D6 — A `paginatedSchema` a `successEnvelopeSchema`-ra épül, nem egy másik burkoló

**Döntés:** a `paginatedSchema(itemSchema)` a `successEnvelopeSchema(itemSchema.array())`-ra épül,
és egy transformot kap, ami a `meta.pagination` **kötelezővé** teszi.

**Indoklás:** ha külön z.object()-tel írnánk a `data`+`meta`-t, akkor a `meta` `requestId`/
`timestamp` kötelezősége **duplikálva** lenne, és a `meta` egyik változása (pl. egy új mező) csak
az egyik helyen kellene átírni. A `successEnvelopeSchema`-ra épülés **garantálja**, hogy a
kliensoldali típus **ugyanazt** a `meta`-t látja, amit a szerver küld.

**A `pagination` kötelezővé tétele** a `transform` feladata: ha nincs `meta.pagination`, a parse
**elbukik** — ez a ticket DoD-pontja (_„hiányzó `meta.pagination` elhasal"_).

### D7 — Az `ApiResult<T>` a `data` + `meta.pagination` kombináció, **nem** új burkoló

**Döntés:**

```ts
export interface ApiResult<T> {
  readonly data: T;
  readonly meta: ResponseMeta & { readonly pagination: PaginationMeta };
}
```

**Indoklás:** a `data` itt **nem** nullable (a paginált listában mindig van egy tömb, akár
üres), és a `meta.pagination` **kötelező**. Ez a kliensoldali nézet — amit a `paginatedSchema`
parse-ol, és amit a `useApiList` (AIS-114) fogyaszt.

**A `meta` típusa `ResponseMeta & { pagination }`** — így a `requestId`/`timestamp` is megmarad,
és nincs külön `ApiResultMeta` típus.

### D8 — Mindkét export-index frissül: a `contract/index.ts` **és** a `src/index.ts`

**Döntés:** az új exportok **mindkét** indexbe kerülnek — a `contract/index.ts`-be (a szerződés
otthona) és a `src/index.ts`-be (a csomag publikus API-ja).

**Indoklás (a terv eredeti feltevése hibás volt):** a terv azt feltételezte, hogy a
[`src/index.ts`](../../packages/shared/src/index.ts) a `contract/index.js`-t re-exportálja — és így
**egy** helyen kell frissíteni. **Nem így van:** a két index **duplikálja** egymás exportjait
(fegyverrel ugyanaz a lista, kétszer). Ez a repo meglévő mintája, és a `packages/api-client` és az
`apps/api` is a **root** indexen keresztül importál (`@callback/shared`).

A duplikáció megszüntetése (`export * from './contract/index.js'`) **nem** opció: a fájl docblockja
kifejezetten tiltja a `export *`-ot, hogy a csomag felszíne **grippelhető** maradjon, és egy
átnevezés ne bontsa ki csendben.

**Következmény:** egy új exportet **két** helyen kell felvenni. Ez a duplikáció a repo
dokumentált mintája, nem újonnan bevezetett technikai adósság.

### D9 — A `sort` a queryben **mindig** jelen van a defaulttal

**Döntés:** a `sort` a factory-ban `z.enum(...).default('...')` — vagyis a séma **kitölti** a
defaultot, ha a paraméter hiányzik.

**Indoklás:** a `ZodQueryPipe` a séma **kimenetét** adja tovább a controllernek — vagyis a
default **a szerveren** töltődik ki, nem a kliensen. Így a kliens nem küld `sort`-ot, ha nem
változtatta, és a szervernek nem kell defaultolnia.

**A `page`/`limit`/`order` ugyanígy**: `z.coerce.number().default(...)` / `z.enum(...).default(...)`.

### D10 — Az `order` defaultja `desc`

**Döntés:** az `order` default `desc`.

**Indoklás:** ez a ticket D2-**ben** nem szerepel explicit, de a `sort` alapértelmezett irányának
a legújabb elöl** kerüljön. A `createdAt`-en rendezve a legújabb rekord van az elején — ez a
hasznosabb alap egy admin listán.

### D11 — A `q` a `z.coerce.string()`-nel jön, de a `trim` a transform után

**Döntés:** a `q` `z.string().trim().max(200).optional()`, **coercet nélkül**.

**Indoklás:** a `q` a query stringből jön, tehát **mindig** string — a `page`/`limit` a
`z.coerce.number()`-re **szükséges** (a query string mindig string), a `q`-ra viszont a
`z.coerce.string()` **ártalmatlan** (már string) és elfedné, ha egy nem-string érték érkezne.

### D12 — Nincs új npm dependency, nincs `knip`-konfliktus

**Döntés:** a `packages/shared` **nem** kap új dependency-t. A `zod` már ott van.

**Indoklás:** a `zod` v3 a `packages/shared` egyetlen runtime dependency-e; a `listQuerySchema`
csak `z`-t használ.

---

## 3. A létrehozandó fájlok

### 3.1 `packages/shared/src/contract/list-query.schema.ts`

```ts
/** A lapozás alapértelmezett oldalmérete. */
export const LIST_QUERY_DEFAULT_LIMIT = 20;

/** A lapozás legnagyobb oldalmérete. */
export const LIST_QUERY_MAX_LIMIT = 100;

/** A kereső string legnagyobb hossza. */
export const LIST_QUERY_MAX_SEARCH_LENGTH = 200;

/** A `page` mező — 1-től, `z.coerce.number()`-os. */
export const listQueryPageSchema = z.coerce.number().int().min(1).default(1);

/** A `limit` mező — 1..100, `z.coerce.number()`-os. */
export const listQueryLimitSchema = z.coerce
  .number()
  .int()
  .min(1)
  .max(LIST_QUERY_MAX_LIMIT)
  .default(LIST_QUERY_DEFAULT_LIMIT);

/** Az `order` mező. */
export const listQueryOrderSchema = z.enum(['asc', 'desc']).default('desc');

/** A `q` mező — trimmelt, üresre undefined. */
export const listQuerySearchSchema = z
  .string()
  .trim()
  .max(LIST_QUERY_MAX_SEARCH_LENGTH)
  .optional()
  .transform((value) => (value === undefined || value.length === 0 ? undefined : value));

/** A `sort` alapértelmezett értéke — erőforrás-specifikus, a factory adja meg. */
export const LIST_QUERY_DEFAULT_SORT = 'createdAt';

/** A statikus alap-séma: `sort` nélkül. */
export const listQuerySchema = z.object({
  page: listQueryPageSchema,
  limit: listQueryLimitSchema,
  order: listQueryOrderSchema,
  q: listQuerySearchSchema,
});

/**
 * A `sort` allow-listet adó factory.
 * @param sortBy - a megengedett oszlopnevek.
 * @param defaultSort - a default oszlopnév.
 */
export function createListQuerySchema(sortBy: readonly [string, ...string[]], defaultSort?: string) { ... }
```

### 3.2 `packages/shared/src/contract/list-query.helper.ts`

```ts
/** A `sort` nélküli alap query — a lapos query mezői. */
export interface ListQuery {
  readonly page: number;
  readonly limit: number;
  readonly order: 'asc' | 'desc';
  readonly q?: string;
}

/** Összefésüli a lapos query-t a resource-specifikus szűrőkkel. */
export function mergeListQuery<T extends Record<string, unknown>>(
  base: ListQuery,
  extra: T,
): ListQuery & T { ... }

/** A query → URLSearchParams, a defaultokat kihagyva. */
export function toListQueryParams(
  query: ListQuery & { readonly sort?: string },
  defaults: { readonly limit: number; readonly order: string; readonly sort?: string },
): URLSearchParams { ... }
```

### 3.3 `packages/shared/src/contract/paginated.schema.ts`

```ts
/**
 * A kliensoldali paginált nézet: `data` + `meta.pagination`.
 * A `meta.pagination` kötelező — hiánya parse-hiba.
 */
export function paginatedSchema<TItem>(
  itemSchema: z.ZodType<TItem, z.ZodTypeDef, unknown>,
): z.ZodType<ApiResult<TItem>, z.ZodTypeDef, unknown> { ... }
```

### 3.4 `packages/shared/src/contract/api-result.interface.ts`

```ts
/** A paginált válasz kliensoldali nézete. */
export interface ApiResult<T> {
  readonly data: T;
  readonly meta: ResponseMeta & { readonly pagination: PaginationMeta };
}
```

### 3.5 A tesztek

| Fájl                                              | Mit fed                                                                                                                                                                                      |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/shared/test/list-query.test.ts`         | a statikus séma defaultjai, a `page`/`limit` coercion, a határértékek (`limit: 0`, `limit: 101`, `page: 0`, `page: 1.5`), az érvénytelen `order`, az üres `q` → `undefined`, a `q` trimelése |
| `packages/shared/test/list-query-factory.test.ts` | a factory: az allow-list, egy ismeretlen `sort` elhasal, a default `sort` kitöltődik                                                                                                         |
| `packages/shared/test/list-query-helper.test.ts`  | `mergeListQuery` (a lapos mezők megmaradnak, az extra nem írja fel őket), `toListQueryParams` (a defaultok kimaradnak, a `q` bekerül, az üres `q` kimarad)                                   |
| `packages/shared/test/paginated.test.ts`          | `data: []` + `total: 0` átmegy; a hiányzó `meta.pagination` elhasal; a `data` nem `null`                                                                                                     |

---

## 4. A változtatandó fájlok

| Fájl                                    | Változás                                                                                                                                                                                             |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/shared/src/contract/index.ts` | az új exportok (a statikus `listQuerySchema`, a factory, a `ListQuery`, a `mergeListQuery`, a `toListQueryParams`, a `paginatedSchema`, az `ApiResult`)                                              |
| `docs/Specs/API-Convention.md`          | egy új szakasz: a **lista query-szerződés** (a `page`/`limit`/`sort`/`order`/`q` alakja, a határértékek, az allow-list szabály) + a `meta.pagination` kliensoldali elérése. A fejléc dátuma frissül. |

**Nem változik:** az `envelope.schema.ts`, az `envelope.interface.ts` (a `meta.pagination` már
létezik), az `api-keys.schema.ts` (a D1 miatt, és az AIS-75 konfliktus elkerüléséért), a
`packages/api-client` (az a AIS-109 transport-ticket), az `apps/api` (a `ZodQueryPipe` és az
`ApiResponseService` már kész).

---

## 5. A végrehajtás lépései

### Fázis 0 — A típusok és a séma (tiszta, tesztelhető) ✅ ELKÉSZÜLT

- [x] **0.1** `list-query.schema.ts` — a konstansok, a mező-sémák, a statikus `listQuerySchema`, a `createListQuerySchema` factory.
- [x] **0.2** `list-query.helper.ts` — a `ListQuery` interfész, a `mergeListQuery`, a `toListQueryParams`.
- [x] **0.3** `api-result.interface.ts` — az `ApiResult<TRows>`.
- [x] **0.4** `paginated.schema.ts` — a `paginatedSchema` factory.

### Fázis 1 — A tesztek ✅ ELKÉSZÜLT

- [x] **1.1** `list-query.test.ts` — a defaultok, a coercion, a határértékek, az `order`, a `q`.
- [x] **1.2** `list-query-factory.test.ts` — az allow-list és a default `sort`.
- [x] **1.3** `list-query-helper.test.ts` — a `mergeListQuery` és a `toListQueryParams`.
- [x] **1.4** `paginated.test.ts` — az üres lista átmegy, a hiányzó `pagination` elhasal.

### Fázis 2 — Az exportok és a dokumentáció ✅ ELKÉSZÜLT

- [x] **2.1** `contract/index.ts` **és** `src/index.ts` — az új exportok (lásd D8: a két index duplikál).
- [x] **2.2** `docs/Specs/API-Convention.md` — az új §4.1 (a lista query-szerződés) + a fejléc dátuma.
- [x] **2.3** `docs/history/2026-10-30--17-50-00-ais-106-list-query-contract.md` — a kivonulás.
- [x] **2.4** `docs/milestones/2026-10-30--17-50-00-ais-106-list-query-contract.milestone.md` — a döntés-szintű összegzés.

### Fázis 3 — Az ellenőrzés ✅ ELKÉSZÜLT

- [x] **3.1** `pnpm --filter @callback/shared test` zöld — **9 fájl / 146 teszt**.
- [x] **3.2** `pnpm --filter @callback/shared build` zöld (a `tsc` a generikus típusokat is ellenőrzi — és meg is fogta a `TItem[][]` hibát).
- [x] **3.3** `pnpm -r build` zöld — **a `packages/api-client` és az `apps/api` sem broke**.
- [x] **3.4** `pnpm test` — a teljes mátrix zöld.
- [x] **3.5** `pnpm format:check` tiszta.

---

## 6. A DoD ellenőrzési listája

| DoD pont                                                                                                        | Hol bizonyul                                                                                                                                           | Státusz             |
| --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------- |
| `listQuerySchema` unit teszt: defaultok, határértékek (`limit: 0`, `limit: 101`), érvénytelen `order`, üres `q` | `list-query.test.ts` (15 teszt)                                                                                                                        | ✅ Fázis 1.1        |
| `paginatedSchema` unit teszt: `data: []` + `total: 0` átmegy; hiányzó `meta.pagination` elhasal                 | `paginated.test.ts` (8 teszt)                                                                                                                          | ✅ Fázis 1.4        |
| A `meta.pagination` típusa elérhető a kliensoldalon **típusassert nélkül**                                      | Az `ApiResult<TRows>` interfész exportálva — a `paginatedSchema` `z.ZodType<ApiResult<TRows>>`-ot ad vissza, vagyis a típus **inferálható** parse után | ✅ Fázis 0.3 + 0.4  |
| `pnpm --filter @callback/shared test` zöld; a `contract/index.ts` exportok frissültek                           | 9 fájl / 146 teszt zöld; a `contract/index.ts` **és** a `src/index.ts` exportjai frissültek (D8)                                                       | ✅ Fázis 2.1 + 3.1  |
| _(kiegészítő)_ A `sort` allow-list miatt egy ismeretlen oszlopnév **400**, nem 500                              | `list-query-factory.test.ts` (6 teszt) — az enum hibaüzenete felsorolja a megengedett oszlopokat                                                       | ✅ Fázis 1.2        |
| _(kiegészítő)_ Nincs breaking a response sémán                                                                  | Az `envelope.schema.ts` **változatlan**                                                                                                                | ✅ a döntés alapján |
| _(kiegészítő)_ Nincs új npm dependency                                                                          | A `packages/shared/package.json` változatlan                                                                                                           | ✅                  |
| _(kiegészítő)_ A `pnpm -r build` sem broke (a `packages/api-client` és az `apps/api` sem)                       | `pnpm -r build` zöld                                                                                                                                   | ✅ Fázis 3.3        |

---

## 7. Kockázatok

| #   | Kockázat                                                                                                                          | Valószínűség | Hatás                                              | Mitigáció                                                                                                                                                                                                 |
| --- | --------------------------------------------------------------------------------------------------------------------------------- | ------------ | -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | **A `z.enum` egy tuple-tá alakítása `readonly string[]`-ből nem fordul le**                                                       | közepes      | típushiba                                          | A factory paramétere `readonly [string, ...string[]]` — a TypeScript **előállítja** a tuple-t a `z.enum` számára, vagyis a hívó placeholderként nem fordul le, ha üres az allow-list. A teszt ezt rögzíti |
| R2  | A `z.coerce.number()` a `''` (üres query paraméter) értéket `0`-ra alakítja → a `limit` minimuma elbukik                          | közepes      | egy üres `?limit=` 400-at ad                       | A `z.coerce.number()` a `''`-t `0`-ra alakítja, ami a minimum alatt van → **elbukik**. Ez a kívánt viselkedés (a hibás paraméter 400), de **dokumentálni kell**                                           |
| R3  | A `q` transform `undefined`-ra alakítja az üres stringet → a `z.object` parse-ban a `q` kulcs **jelen lesz** `undefined` értékkel | közepes      | a `URLSearchParams`-ben `q=undefined` jelenhet meg | A `toListQueryParams` a `undefined` értékű mezőket **kihagyja** — ez a helper feladata, nem a séma                                                                                                        |
| R4  | A `sort` a factory-ban van, de a statikus `listQuerySchema` nem tartalmazza → a kliens és a szerver **más** sémát használhat      | közepes      | a `sort` elcsúszik                                 | A `useListParams` (AIS-119) a **factory** sémáját kapja, nem a statikust. A statikus `listQuerySchema` a `sort` nélküli alap — dokumentálva                                                               |
| R5  | Az AIS-75 párhuzamosan módosítja az `api-keys.schema.ts`-t                                                                        | alacsony     | konfliktus                                         | Az AIS-106 **nem nyúl** hozzá (D1) — a konfliktus elkerülhető                                                                                                                                             |
| R6  | A `paginatedSchema` nem ugyanaz, mint amit a szerver küld → parse-hiba a kliensen                                                 | alacsony     | a `useApiList` elhasal                             | A `successEnvelopeSchema`-ra épül (D6), így a `meta` **ugyanaz** a sémából jön                                                                                                                            |

---

## 8. Mit NEM csinálunk

- **Nem** módosítjuk a `successEnvelopeSchema`-t (D1) — nincs breaking.
- **Nem** nyúlunk az `api-keys.schema.ts`-hez — így az AIS-75 konfliktusa nem keletkezik.
- **Nem** módosítjuk a `packages/api-client`-t — az a AIS-109 (transport) ticket, és ott kell a
  query string és a `meta` kezelése.
- **Nem** módosítjuk az `apps/api`-t — a `ZodQueryPipe` és az `ApiResponseService` **már kész**.
- **Nem** vezetünk be új npm dependency-t.
- **Nem** csinálunk szerveroldali lapozást — a `findAll` **szándékosan** lapozás nélküli
  (a [`api-keys.repository.interface.ts:30`](../../apps/api/src/api-keys/api-keys.repository.interface.ts:30)
  szerint: _„no pagination by design"_ — a tábla provider-hitelesítő adatokat tartalmaz). A
  lapozott végpont az **AIS-102 T1-2** (a `findAll` → `findPage` breaking változás), **nem** ez a
  ticket.
- **Nem** készítünk `useListParams`-t — az **AIS-119**.

---

## 9. Hivatkozások

- Ticket: AIS-106 (AIS-102 subtask) — Jira
- Kapcsolódó ticketek: AIS-109 (transport — a query string kliensoldali összeállítása), AIS-119
  (`useListParams` — a `listQuerySchema` fogyasztója), AIS-114 (`useApiList` — az `ApiResult`
  fogyasztója), AIS-120 (MSW harness), AIS-75 (a `api-keys.schema.ts` tulajdonosa — **nem** mi)
- Kapcsolódó terv: [`2026-10-30--13-06-00-admin-unified-data-flow-and-ui-foundation-plan.md`](2026-10-30--13-06-00-admin-unified-data-flow-and-ui-foundation-plan.md:1)
- Érintett kód: [`packages/shared/src/contract/envelope.schema.ts`](../../packages/shared/src/contract/envelope.schema.ts:1),
  [`packages/shared/src/contract/envelope.interface.ts`](../../packages/shared/src/contract/envelope.interface.ts:1),
  [`packages/shared/src/contract/index.ts`](../../packages/shared/src/contract/index.ts:1),
  [`apps/api/src/common/http/zod.pipe.ts`](../../apps/api/src/common/http/zod.pipe.ts:59),
  [`apps/api/src/common/http/api-response.service.ts`](../../apps/api/src/common/http/api-response.service.ts:36),
  [`packages/api-client/src/api-keys/api-keys.service.ts`](../../packages/api-client/src/api-keys/api-keys.service.ts:26),
  [`docs/Specs/API-Convention.md`](../../docs/Specs/API-Convention.md:1)
