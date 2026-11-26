# AIS-175 — entity query-key factory

**Dátum:** 2026-11-10 00:10
**Ticket:** AIS-175 (`refactor(admin): query-key factory so cache invalidation cannot silently break`)
**Előzmény:** finding **F7** a [`2026-11-08--23-58-00-entity-page-standardization-plan.md`](../plans/2026-11-08--23-58-00-entity-page-standardization-plan.md) planből — az egyetlen tétel, aminek **csendes** hiba-módja volt
**Plan:** ez a change maga a terv (a ticket tartalmazza a DoD-t), külön plan fájl nem készült

---

## Probléma

Az `api-keys` use case kézzel írta fel a TanStack Query kulcsokat:

```ts
export const API_KEYS_QUERY_KEYS = {
  all: ['api-keys'] as const,
  list: (params) => ['api-keys', 'list', { ...params }] as const,
  detail: (identifier) => ['api-keys', 'detail', identifier] as const,
};
```

A TanStack Query az invalidálást **prefix** alapján párosítja. Ha az `all`-ban elgépelődik a
namespace (`['api-key']`), akkor minden `invalidateKeys: [API_KEYS_QUERY_KEYS.all]` csendben
no-op lesz: a lista a write előtti oldalt szolgálja ki tovább, hiba nem keletkezik, teszt nem
bukik. A `list`/`detail` elgépelése kettévágja a cache-t. A prefix-viszony eddig *feltételezés*
volt, nem garantált tulajdonság.

## Megoldás

Egy gyártó, egy namespace literál:

- [`create-entity-query-keys.ts`](../../apps/admin/src/features/api/create-entity-query-keys.ts:1) —
  `createEntityQueryKeys<TListParams>(namespace)` → `{ all, list(params), detail(identifier) }`.
  Mindhárom kulcs ugyanabból a paraméterből származik, a `list` pedig **másolja** a params
  objektumot, hogy egy későbbi in-place módosítás ne írja át egy létező cache-entry kulcsát.
- [`create-entity-query-keys.interface.ts`](../../apps/admin/src/features/api/create-entity-query-keys.interface.ts:1) —
  az `EntityQueryKeys<TListParams>` típus; a docblock rögzíti, hogy a prefix-viszony a létok.
- [`create-entity-query-keys.const.ts`](../../apps/admin/src/features/api/create-entity-query-keys.const.ts:1) —
  a `'list'` / `'detail'` szegmens egyszer deklarálva.
- [`api-keys.const.ts`](../../apps/admin/src/features/api-keys/api-keys.const.ts:26) —
  `API_KEYS_QUERY_KEYS = createEntityQueryKeys<ApiKeyListQuery>('api-keys')`; az exportált név
  maradt, ezért **egyetlen fogyasztó sem változott** (`use-api-keys.ts` öt hívási pontja,
  `use-api-keys.test.tsx`, `ApiKeyCreateDialog.test.tsx`).

A feloldott kulcs-tömbök bájtazonosak a korábbiakkal — ez volt a migráció feltétele.

## Tesztek

[`create-entity-query-keys.test.ts`](../../apps/admin/src/features/api/create-entity-query-keys.test.ts:1)
— 15 eset:

- `all` = `[namespace]`;
- `list` = `[namespace, 'list', params]`, külön kulcs minden eltérő query-re, azonos kulcs két
  egyenlő query-re;
- a params **másolat**: a kulcs nem ugyanaz a referencia, és a hívó utólagos mutációja nem
  változtatja meg a kulcsot;
- `detail` = `[namespace, 'detail', id]`, azonosítóként külön kulcs, `detail('list')` nem
  ütközik a `list(…)`-pel;
- **prefix-szerződés**: egy TanStack-utánzó `matchesPrefix` helperrel igazolva, hogy
  `list(…)` és `detail(…)` illeszkedik az `all`-ra, egy másik namespace kulcsa viszont nem.

## Verifikáció

| Parancs | Eredmény |
| --- | --- |
| `pnpm typecheck` | zöld (mind a 7 workspace) |
| `pnpm --filter @callback/admin test` | **562 teszt / 49 fájl** zöld |
| `pnpm --filter @callback/admin exec vitest run create-entity-query-keys` | 15/15 |
| `pnpm quality` | lásd a commit előtti futtatást |

## Doksi

- [`New-Admin-Page.md`](../Specs/New-Admin-Page.md) 9. lépés: a query key-ek **deriváltak**, a
  `create-entity-query-keys.ts` bekerült a generikus bázis listájába; a fejléc dátuma frissült.
- [`UI-Architecture.md`](../Specs/UI-Architecture.md) §5: új bekezdés a gyártóról és a
  prefix-garanciáról; a fejléc dátuma frissült.

## Nem változott

- Az `api-keys` oldal futásidejű viselkedése (a kulcsok azonosak).
- A többi F-tétel (F1–F6, F8–F14) nyitva maradt a planben — azok várnak a második entitás-oldalra.
