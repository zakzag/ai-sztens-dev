# AIS-151 — strukturált bejegyzés-részletek a `@callback/notifications` core-ban

**Dátum:** 2026-11-07 · **Ticket:** AIS-151 (parent: AIS-143) · **Terv:** [`2026-11-07--15-29-00-ais-151-notification-detail-fields-plan.md`](../plans/2026-11-07--15-29-00-ais-151-notification-detail-fields-plan.md)

## Mit kellett megoldani

A log bejegyzés egyetlen `detail: string` mezőt hordozott, minden technikai adat egyetlen sorba lapítva
(`"status=422 · code=VALIDATION · requestId=…"`). Az AIS-143 lenyitható sora kulcs–érték listát igényel,
ezért a core adatmodellnek strukturált, redaktált, limitált mezőlistát kell adnia — UI és transport nélkül.

## Döntések

| #   | Döntés                                                                                                            |
| --- | ----------------------------------------------------------------------------------------------------------------- |
| A   | `toDetailFields(record)` a **beszúrási sorrendet** követi (`Object.entries`), nincs ábécé-rendezés                  |
| B   | `clampDetailFields` is futtat `redactValue(label, value)`-t, így a tömbben érkező mezők sem kerülik meg a redakciót |
| C   | Dedupe/bump: új `details` lecseréli a régit, `details` nélküli repeat **megtartja** a korábbi mezőket                |
| D   | A `detail: string` **megmarad** (toast + csukott sor), a `details` kiegészít, nem helyettesít                        |
| E   | Üres eredmény → `undefined` (nem `[]`), hogy a snapshot és a `sessionStorage` payload ne hízzon                     |

## Változások fájlonként

| Fájl                                                                                                       | Változás                                                                                                                              |
| ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| [`notification.interface.ts`](../../packages/notifications/src/core/notification.interface.ts:1)            | Új `NotificationDetailField` (`label`, `value`, `mono?`); `NotificationEntry.details?`; `EmitNotificationInput.details?` (tömb vagy record) |
| [`notification.const.ts`](../../packages/notifications/src/core/notification.const.ts:1)                    | `NOTIFICATION_DETAIL_MAX_FIELDS = 20`, `..._LABEL_MAX_LENGTH = 40`, `..._VALUE_MAX_LENGTH = 2000`, `..._TRUNCATION_SUFFIX = '…'`, `NOTIFICATION_DETAILS_INVALID_PLACEHOLDER` |
| [`notification.logic.ts`](../../packages/notifications/src/core/notification.logic.ts:1)                    | `toDetailFields`, `clampDetailFields`, belső `toDetailField` / `serializeDetailValue` / `truncateDetailText` / `isDetailFieldList`; `bumpEntry` opcionális harmadik `details` paramétert kapott; `toRedactedDetail` **változatlan** |
| [`notification.store.ts`](../../packages/notifications/src/core/notification.store.ts:1)                    | `normalizeDetails` (üres → `undefined`), `createEntry` és `emit` átadja a normalizált mezőket a bumpnak                                 |
| [`notification.storage.logic.ts`](../../packages/notifications/src/core/notification.storage.logic.ts:1)    | `isDetailField` + `isOptionalDetails` type guard, beépítve az `isPersistedEntry`-be; all-or-nothing és `version: 1` maradt              |
| [`index.ts`](../../packages/notifications/src/index.ts:1)                                                   | Explicit exportok: a típus, az öt konstans, `toDetailFields`, `clampDetailFields`                                                       |
| [`test/mocks/notification.fixtures.ts`](../../packages/notifications/test/mocks/notification.fixtures.ts:1) | `createTestDetailField`, `createTestDetailsRecord` fixture-ök                                                                           |
| [`test/notification.logic.test.ts`](../../packages/notifications/test/notification.logic.test.ts:1)          | 24 új eset: sorrend, redakció mindkét ágon, csonkolás, mező-cap, üres label, `mono`, körkörös érték, `0` / `MAX` / `MAX+1` határok       |
| [`test/notification.store.test.ts`](../../packages/notifications/test/notification.store.test.ts:1)          | 9 új eset: record → tömb, redakció, `mono`, `undefined` / üres record / minden mező eldobva, bump lecserél és bump megtart               |
| [`test/notification-storage.logic.test.ts`](../../packages/notifications/test/notification-storage.logic.test.ts:1) | 6 új elutasítási eset + 5 tolerancia/round-trip eset, `isPersistedEntry` közvetlen esetekkel                                         |
| [`docs/Specs/UI-Architecture.md`](../Specs/UI-Architecture.md:3)                                             | `details` / normalizálás / limitek sorok a core táblában, `details?` a storage `Validation` sorban, új „Utolsó frissítés”             |
| [`tsconfig.core.json`](../../packages/notifications/tsconfig.core.json:1)                                   | `exclude: ["test/log-drawer-width-storage.test.ts"]` — a React-réteg storage-tesztje az AIS-150-ben került a `test/*.ts` mintába, és ezzel a `@callback/ui` source-át (`--jsx`, DOM lib nélkül) húzta be a core programba |

## Ellenőrzés

- `pnpm --filter @callback/notifications test` → **270 teszt zöld** (10 fájl).
- `pnpm --filter @callback/notifications build` → **zöld** (`tsconfig.core.json` + `tsconfig.json`).
- `pnpm typecheck` (root, mind a 8 workspace) → zöld.
- `pnpm quality:dead-code` → zöld. `pnpm quality:docs` → `0 violations`.

## Megjegyzés a core-fordításról

A `build` első futása a `tsconfig.core.json` lépésnél hasalt, kizárólag `packages/ui` hibákkal
(`--jsx` nincs beállítva, `HTMLTableCellElement` hiányzik). A `tsc --listFiles` kimenete mutatta meg,
hogy a `test/*.ts` include-minta a `test/log-drawer-width-storage.test.ts`-en keresztül behúzza a
`src/react` réteget és a `@callback/ui`-t, holott az AIS-150-ben került oda. Ez pre-existing hiba volt
(`git stash` + újrafuttatás ugyanazt adta), és a core-projekt helyes hatókörének helyreállításával
javult: a React-réteg tesztjét a `tsconfig.json` projekt továbbra is teljesen ellenőrzi.
