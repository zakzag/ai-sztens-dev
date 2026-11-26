# AIS-16 — a `customers` szerződés-sémái (első lépés az AIS-14-ből)

**Dátum:** 2026-11-22 00:35 (Europe/Budapest)
**Ticket:** AIS-16 (parent: AIS-14 `Admin - cég adatbázis`)
**Típus:** feature (contract layer, kód + tesztek + dokumentáció)
**Terv:** [`docs/plans/2026-11-22--00-10-00-ais-14-customers-data-layer-plan.md`](../plans/2026-11-22--00-10-00-ais-14-customers-data-layer-plan.md)

## Probléma

Az AIS-14 négy subtaskból áll (AIS-16 terv → AIS-18 `customer`+`iam` séma → AIS-177
`activity`+`audit` + `AuditWriter` → AIS-178 API). A mezőkészlet eddig csak egy tervezési
dokumentumban létezett, kódban nem: sem a szerver, sem a kliens nem tudta volna
ellenőrizni, hogy ugyanazt a mezőnevet, enumot és formátumot használja-e.

## Döntés — a sorrend és a hatókör

A négy subtask **egyenként**, egy branchen (`AIS-14-customers-data-layer`) kerül be, négy
commitben. Indok: a migráció az egyetlen visszafordíthatatlan artefaktum (két kisebb migráció
átnézhető), a AIS-178 önmagában ~22 endpoint, és a kapuk kereszt-package-ek (egy új registry
bejegyzés elrontja az `api-client` lefedettséget, egy új hibakód az admin copy-paritást).

**Hatókör-korrekció a tickethez képest:** a `customers.contract.ts` (registry-bejegyzések)
**nem** ebben a commitban készül, hanem az AIS-178-ban, mert a registry-bejegyzés
kontroller és kliens-service nélkül elbuktatja a
`packages/api-client/test/service-coverage.test.ts` és a
`packages/shared/test/endpoint-registry.test.ts` (sample payload) kapukat. AIS-16 a
döntésrekordot és a sémákat szállítja.

## Változások

| Fájl | Változás |
| --- | --- |
| [`packages/shared/src/contract/customers/customers.enums.ts`](../../packages/shared/src/contract/customers/customers.enums.ts:1) | 12 zárt értékkészlet (customer_type, customer_status, customer_source, headcount_range, contact_role, customer_user_role, customer_user_status, operator_role, activity_type, author_type, audit_operation, audit_source) egy-egy `readonly` tuple + belőle derivált `z.enum`, hogy az API, az űrlap és a Postgres enum ne csússzon el. Számlázási és előfizetés-enum szándékosan nincs. |
| [`packages/shared/src/contract/customers/customers.const.ts`](../../packages/shared/src/contract/customers/customers.const.ts:1) | Route (`/api/admin/customers`), `AIS-YYYYMM-NNN` minta, mezőhossz-limitek (a közös `SHORT_TEXT_MAX_LENGTH` / `LONG_TEXT_MAX_LENGTH` újrafelhasználásával), alapértelmezett ország, kezdő státusz, rendezhető oszlopok allow-listje. |
| [`packages/shared/src/contract/customers/customers.schema.ts`](../../packages/shared/src/contract/customers/customers.schema.ts:1) | Olvasó sémák (`customerSchema`, `customerDetailSchema`, `contactSchema`, `customerUserSchema`, `customerTagSchema`, `activitySchema`, `auditLogSchema`) és kérő sémák (`createCustomerSchema`, `updateCustomerSchema`, `updateCustomerStatusSchema`, `create/updateActivitySchema`, `create/updateContactSchema`, `inviteCustomerUserSchema`, tag sémák). A formátum-sémák (AIS-112) importálva, nincs duplikált regex. |
| [`packages/shared/src/contract/customers/customers.list-query.ts`](../../packages/shared/src/contract/customers/customers.list-query.ts:1) | A közös `listQuerySchema` kiterjesztése: `sort` allow-list + négy szűrő (`type`, `status`, `source`, `responsibleOperatorId`) és a hozzájuk tartozó OpenAPI paraméter-leírók. |
| [`packages/shared/src/contract/customers/customers.fixture.ts`](../../packages/shared/src/contract/customers/customers.fixture.ts:1) | Mintaadatok: tele és hiányos ügyfél, részletes payload, kapcsolattartók, felhasználók, tevékenység, audit sor, create/update body. A valós, checksum-helyes adószám (`10773381-2-44`) azért kell, mert a `huTaxNumberSchema` ellenőrzi az ellenőrző számjegyet. |
| [`packages/shared/src/contract/customers/customers.interface.ts`](../../packages/shared/src/contract/customers/customers.interface.ts:1) | A sémákból derivált típusok. A `CreateCustomerInput` és az `InviteCustomerUserInput` `z.input`, mert ezek a sémák defaultot hordoznak (a hívó elhagyhatja a mezőt). |
| [`packages/shared/src/index.ts`](../../packages/shared/src/index.ts:166) | Explicit re-export (nincs `export *`); minden új szimbólum a package publikus felületén van, így a `knip` dead-code kapu zöld marad. |
| [`packages/shared/test/customer.schema.test.ts`](../../packages/shared/test/customer.schema.test.ts:1) | Olvasó/kérő sémák: null vs. hiányzó mező, ismeretlen enum, `.strict()` tiltás, default kitöltés, `updatedAt` kötelező, null-lal törlés, adószám checksum, E.164 normalizálás, e-mail lower-case. |
| [`packages/shared/test/customer-list-query.test.ts`](../../packages/shared/test/customer-list-query.test.ts:1) | Defaultok, coercion, minden rendezhető oszlop, ismeretlen `sort` a közös INVALID_FORMAT szöveggel, a négy szűrő, üres `q` → nincs szűrő. |
| [`packages/shared/test/customer-number.schema.test.ts`](../../packages/shared/test/customer-number.schema.test.ts:1) | Az `AIS-YYYYMM-NNN` formátum határai (prefix, hónap, sorszám, hossz). |
| [`docs/Specs/Functional-Specification.md`](../Specs/Functional-Specification.md:1) | A 3. pont funkciótáblázata valós `O1` sort kapott (ügyfél-nyilvántartás), fejléc-dátum frissítve. |
| [`docs/Specs/API-Convention.md`](../Specs/API-Convention.md:1) | §4.1: a `customers` sort allow-list + az új „resource-specific filters” bekezdés; fejléc-dátum frissítve. |

## Döntések, amiket a kód rögzít

1. **`null` a válaszban, hiányzó mező a kérésben** (API-Convention §4) — a `customerSchema`
   minden opcionális mezője `.nullable()`, a kérő sémák `.strict()`-ek.
2. **Származtatott mező nem oszlop:** `lastActivityAt` és `hasMissingData` a válaszban van,
   a DB-ben nem lesz.
3. **`status` külön endpointon** (`PATCH /:id/status`), ezért a `PATCH /:id` `.strict()`
   sémája elutasítja — a státuszváltás `status_changed_at`-et is ír.
4. **`customerNumber`, `statusChangedAt`, timestampek szerver-oldaliak** — a `.strict()`
   sémák ezeket is elutasítják.
5. **Nincs `note`, nincs számlázási mező** — minden megjegyzés `activities` bejegyzés lesz
   (AIS-177), a számlázás az AIS-176-ig nem része a modellnek.

## Ellenőrzés

- `pnpm --filter @callback/shared typecheck` → zöld
- `pnpm --filter @callback/shared test` → **25 suite / 395 teszt zöld** (ebből 3 új suite)
- `pnpm quality` (`docs` kapuval együtt) → futtatandó a commit előtt

## Következő lépés

AIS-18: `customer` + `iam` Postgres sémák, enumok, migráció, grantek — a most rögzített
mezőkészlet és enumok alapján.
