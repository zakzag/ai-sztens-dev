# AIS-110 — PATCH/DELETE a kliens-service-ben + registry ⇄ service lefedettségi kapu

**Dátum:** 2026-11-03
**Ticket:** AIS-110 (Subtask, AIS-102)
**Plan:** [`docs/plans/2026-11-03--16-43-00-ais-110-api-client-patch-delete-and-coverage-plan.md`](../plans/2026-11-03--16-43-00-ais-110-api-client-patch-delete-and-coverage-plan.md)

## Kiindulás

A ticket szövege a `findByIdentifier` bekötését kérte számon, de az már az AIS-109-ben
megtörtént (a `list` is `getList`-re állt át). A valódi rés az volt, hogy a registry **öt**
operationt írt le (`list`, `findByIdentifier`, `create`, `update`, `remove`), miközben az
`ApiKeysService` csak hármat valósított meg — az AIS-108-ban hozzáadott `PATCH`/`DELETE`
végpontokhoz nem tartozott kliens-metódus.

## Változások

| Fájl                                                     | Változás                                                                                                                                                  |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/api-client/src/api-keys/api-keys.interface.ts` | `update(identifier, input, options?)` → `Promise<ApiKey>` és `remove(identifier, options?)` → `Promise<null>`; a fejléc a read/write konvenciót is leírja |
| `packages/api-client/src/api-keys/api-keys.service.ts`   | `client.patch(...)` / `client.delete(...)` a meglévő `toApiKeyDetailPath`-en, `apiKeySchema`, illetve `noPayloadSchema` parse-olással                     |
| `packages/api-client/src/service-coverage.interface.ts`  | a kapu típusai (`ServiceFactory`, `CoverageGap`, `ServiceCoverage`, `CoverageGapReason`)                                                                  |
| `packages/api-client/src/service-coverage.errors.ts`     | `InvalidOperationIdError` a `<namespace>.<action>` konvenció megsértésére                                                                                 |
| `packages/api-client/src/service-coverage.logic.ts`      | tiszta `toServiceNamespace`, `toServiceMethodName`, `findCoverageGaps` (missing + orphan irány)                                                           |
| `packages/api-client/src/service.registry.ts`            | `createServiceFactories()` — erőforrásonként egy sor, ez a kapu egyetlen bővítési pontja                                                                  |
| `packages/api-client/test/service-coverage.test.ts`      | a valódi kapu + a negatív esetek (hiányzó metódus, hiányzó service, árva metódus, hibás id)                                                               |
| `packages/api-client/test/api-keys.service.test.ts`      | path-paritás teszt + 7 PATCH- és 5 DELETE-eset                                                                                                            |
| `packages/api-client/test/mocks/api-key.mock.ts`         | `VALID_UPDATE_INPUT`, `UPDATED_API_KEY` fixture-ök                                                                                                        |
| `docs/Specs/Admin-Data-Flow.md`                          | **új** élő spec: „New resource template” szekció, `API-Convention` §4.2/§11-re és `UI-Architecture` §12-re hivatkozva                                     |
| `docs/Specs/API-Convention.md`                           | §9 service-binding és coverage-gate bekezdés, §11 a sablonra mutat, §12 új sor, §13 elavult bekezdés javítva                                              |

## Döntések

1. **`remove` `Promise<null>`-t ad vissza, nem `void`-ot.** A §4.2.2 szerint a válasz `200` +
   `data: null` (soha `204`, mert az nem hordozhat `meta.requestId`-t). A transport a `noPayloadSchema`-val
   újravalidálja a `data`-t, így a `204`, a hiányzó `data` kulcs és az objektum payload is
   `UNEXPECTED_PAYLOAD` drift.
2. **Egy detail path, három művelet.** Az `API_KEYS_DETAIL_PATH` továbbra is a
   `apiKeys.findByIdentifier`-ből származik; a `update`/`remove` ugyanazt használja, és egy teszt
   állítja, hogy a három `operationId` ugyanarra a sablonra oldódik fel.
3. **A kapu a metódusnevet az `operationId`-ből vezeti le**, ezért új erőforrásnál csak a
   `service.registry.ts`-be kell egy sor — a teszt nem változik.
4. **A sablon egy helyen él** (`Admin-Data-Flow.md`), az `API-Convention` §11 csak az API-specifikus
   szabályokat (raw route exemption, mutation konvenció) tartja meg.

## Ellenőrzés

```powershell
pnpm --filter @callback/api-client build     # tiszta
pnpm --filter @callback/api-client test      # 9 suite, 198 teszt zöld
pnpm test                                    # shared 207, api-client 198, ui 71, admin 223, api 433
pnpm lint                                    # tiszta
pnpm quality                                 # layers, knip, tokens, field-errors — 0 violation
```

A kapu piros ágát kézzel is igazoltuk: a `createServiceFactories()`-ből ideiglenesen kivéve az
`apiKeys` kulcsot a `service-coverage.test.ts` 2 esetben elbukott `missing-service` okkal, majd a
visszaállítás után újra zöld lett.

## Nyitott pont

Az admin oldalon még nincs szerkesztő/törlő UI, ezért az `update`/`remove` egyelőre csak
service-szinten van bekötve és tesztelve — a fogyasztó a következő admin ticket.
