# AIS-60 — admin API-kulcs feature hook + segédek (Fázis 4)

**Dátum:** 2026-10-21 21:30
**Ticket:** AIS-60 (subtask of AIS-57)
**Terv:** [`docs/plans/2026-10-21--20-40-00-ais-57-ais-41-admin-api-keys-page-plan.md`](../plans/2026-10-21--20-40-00-ais-57-ais-41-admin-api-keys-page-plan.md) §5 Fázis 4
**Előzmény:** Fázis 0–3 (AIS-58, AIS-59, AIS-62, AIS-61) már zöld volt.

## Mit kellett megoldani

Az `api-keys` oldal (AIS-41) még nem készült el, de a hozzá tartozó adatelérési réteg igen:
TanStack Query hook, query key konstansok, dátum- és hibaüzenet-segédek, valamint az a
composition root, ami a `@callback/api-client` példányt létrehozza. A DoD két pontja volt
kritikus: (1) az oldal **kizárólag** a hookon keresztül kér adatot, közvetlen `fetch` nélkül;
(2) a tesztek hálózat nélkül futnak.

## Új fájlok

| Fájl                                                                                                                                                            | Tartalom                                                                                                                                   |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| [`apps/admin/src/auth/session-token.ts`](../../apps/admin/src/auth/session-token.ts)                                                                            | `SESSION_TOKEN_KEY`, `readSessionToken()`, `storeSessionToken()`, `clearSessionToken()` — SSR/teszt-safe. Az `AuthContext` innen olvas/ír. |
| [`apps/admin/src/services/api-client.ts`](../../apps/admin/src/services/api-client.ts)                                                                          | Composition root: `createHttpClient({ baseUrl, getToken: readSessionToken })` + `apiKeysService` singleton.                                |
| [`apps/admin/src/services/api-client.const.ts`](../../apps/admin/src/services/api-client.const.ts)                                                              | `DEFAULT_API_BASE_URL = '/api'` fallback, ha a `VITE_API_BASE_URL` hiányzik.                                                               |
| [`apps/admin/src/lib/date.const.ts`](../../apps/admin/src/lib/date.const.ts), [`date.ts`](../../apps/admin/src/lib/date.ts)                                     | `toExpiryIso()` (naptári nap → **helyi** éjfél → ISO), `formatExpiry()` (`Intl.DateTimeFormat`, `null` → „nincs lejárat”).                 |
| [`apps/admin/src/lib/error-message.const.ts`](../../apps/admin/src/lib/error-message.const.ts), [`error-message.ts`](../../apps/admin/src/lib/error-message.ts) | `toErrorMessage(error): string` — status-alapú magyar nyelvű leképezés.                                                                    |
| [`features/api-keys/api-keys.const.ts`](../../apps/admin/src/features/api-keys/api-keys.const.ts)                                                               | `API_KEYS_QUERY_KEYS` (`all`, `list`), 409 mezőszöveg, `EMPTY_API_KEY_LIST`.                                                               |
| [`features/api-keys/api-keys.interface.ts`](../../apps/admin/src/features/api-keys/api-keys.interface.ts)                                                       | `UseApiKeysQueryResult`, `UseCreateApiKeyMutationOptions`, `UseCreateApiKeyMutationResult`.                                                |
| [`features/api-keys/api-keys.logic.ts`](../../apps/admin/src/features/api-keys/api-keys.logic.ts)                                                               | `isIdentifierConflict()`, `toIdentifierFieldError()` — tisztán `error.status === 409` alapján.                                             |
| [`features/api-keys/use-api-keys.ts`](../../apps/admin/src/features/api-keys/use-api-keys.ts)                                                                   | `useApiKeysQuery()`, `useCreateApiKeyMutation()` (invalidate `all` kulcsra + `onCreated`).                                                 |
| [`src/test/mocks/api-keys.mock.ts`](../../apps/admin/src/test/mocks/api-keys.mock.ts)                                                                           | Fixture-ök + `ApiKeysService` double singleton + `resetApiKeysServiceMock()`.                                                              |
| [`src/test/mocks/api-error.mock.ts`](../../apps/admin/src/test/mocks/api-error.mock.ts)                                                                         | 409 / 400 / 5xx / network / tetszőleges status `ApiError` factory-k.                                                                       |
| [`src/test/mocks/query-client.mock.tsx`](../../apps/admin/src/test/mocks/query-client.mock.tsx)                                                                 | `createTestQueryClient()` (`retry: false`, `gcTime: 0`) + `TestQueryProvider`.                                                             |

Módosult: [`AuthContext.tsx`](../../apps/admin/src/auth/AuthContext.tsx) (a storage-kulcs kikerült belőle),
[`vite-env.d.ts`](../../apps/admin/src/vite-env.d.ts) (`VITE_API_BASE_URL` típus).

## Tesztek

| Fájl                                           | Esetek                                                                                                               |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `src/auth/session-token.test.ts`               | 5 — kulcsnév, hiányzó érték, írás/olvasás, felülírás, törlés                                                         |
| `src/lib/date.test.ts`                         | 12 — üres/whitespace, helyi éjfél, round-trip, szökőnap, rossz formátum, nem létező nap, `null`/érvénytelen lejárat  |
| `src/lib/error-message.test.ts`                | 13 — nem-`ApiError`, network, 401, 403, 404, 409 (detail/fallback), 400/422, 5xx, nem-map-elt status                 |
| `src/features/api-keys/api-keys.logic.test.ts` | 7 — 409 igen, 400 nem, „Conflict” szövegű sima `Error` nem, 409-nek látszó objektum nem                              |
| `src/features/api-keys/use-api-keys.test.tsx`  | 8 — loading, success, query error, refetch, create + invalidate + `onCreated`, 409 → mezőhiba, network hiba, `reset` |

## Verifikáció (futtatott parancsok)

```text
pnpm --filter @callback/shared build        → OK
pnpm --filter @callback/api-client build    → OK
pnpm --filter @callback/admin test          → 6 fájl / 46 teszt zöld
pnpm --filter @callback/admin lint          → OK
pnpm --filter @callback/admin build         → OK (tsc --noEmit + vite build, 282.95 kB js)
palette-check (apps/admin/src)              → palette-violations=0
```

## Menet közben javított típushibák

1. `createStatusError(status = HTTP_STATUS.FORBIDDEN)` → a paraméter `403` literál típusra szűkült, ezért
   `createStatusError(HTTP_STATUS.UNAUTHORIZED)` nem fordult. Javítás: explicit `status: number`.
2. `toErrorMessage`-ben az `isValidationError(error)` type-predicate az `else` ágon `never`-ré szűkítette a
   változót (`Property 'status' does not exist on type 'never'`). Javítás: a statusot a belépés után lokális
   `const status = error.status`-ba tesszük, és a 400/422 döntés `HTTP_STATUS` összehasonlítás.

## Következő lépés

Fázis 5 (AIS-63): `docs/Specs/UI-Architecture.md` state-tábla `api-keys` sora + page-recept.
Fázis 6 (AIS-41): az oldal, ami ezt a hookot fogyasztja (`onCreated` → űrlap reset).
