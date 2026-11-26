# AIS-111 — egységes hibakód-katalógus + generikus mezőhiba-leképezés

**Dátum:** 2026-11-03 22:05 (Europe/Budapest)
**Ticket:** AIS-111 (az AIS-103 sub-taskja) — `admin: generikus mezőhiba-leképezés (toFieldErrors mezőlistával) + egységes hibakód-copy táblázat`
**Terv:** [`2026-11-03--21-51-00-ais-111-generic-field-errors-and-error-code-table-plan.md`](../plans/2026-11-03--21-51-00-ais-111-generic-field-errors-and-error-code-table-plan.md:1)

## Kiinduló helyzet

Két kézi `code → copy` táblázat élt egymás mellett (`ERROR_CODE_MESSAGE` a
`lib/error-message.const.ts`-ben, `FIELD_SURFACE_CODES` a `lib/error-surface.const.ts`-ben),
plusz egy harmadik, feature-szintű újra-exportálás a `features/api-keys/api-keys.const.ts`-ben.
A mezőhiba-leképezés (`toFieldErrors`) a `features/api-keys/api-keys.logic.ts`-ben lakott, beégetve
az `API_KEY_FIELD_PATHS`-t és egy kódhoz tartozó szöveget — egy új erőforrás ezt másolta volna.

A ticket DoD-ja („minden `API_ERROR_CODE`-hoz van magyar copy vagy explicit elutasított”)
konkrét hiányt talált: a shared katalógusban **13** kód van, az admin táblázatban csak **11**.
Az AIS-108-ban bevezetett `STALE_WRITE` és `SEMANTIC_VALIDATION_FAILED` magyar copy nélkül maradt,
így egy lost update a `CONFLICT_MESSAGE`-t („ütközik egy már létező elemmel”) renderelte.

## Változások

### Egyetlen katalógus

| Fájl | Változás |
| --- | --- |
| `apps/admin/src/lib/api-error-code.interface.ts` | **új** — `ApiErrorCodeCopy` (`message`, `fieldMessage: string \| null`) |
| `apps/admin/src/lib/api-error-code.const.ts` | **új** — `ERROR_CODE_CATALOGUE` totális `Record<ApiErrorCode, …>`; belőle derivált `ERROR_CODE_MESSAGE` és `FIELD_SURFACE_CODES`; `CLIENT_UNEXPECTED_PAYLOAD_CODE` a kliens-oldali kódhoz |
| `apps/admin/src/lib/error-message.const.ts` | **új copy**: `STALE_WRITE_MESSAGE`, `SEMANTIC_VALIDATION_FAILED_MESSAGE`; a kézi `ERROR_CODE_MESSAGE` törölve (most derivált) |
| `apps/admin/src/lib/error-message.ts` | a derivált `ERROR_CODE_MESSAGE` importja |
| `apps/admin/src/lib/error-surface.const.ts` | `FIELD_SURFACE_CODES` törölve (a katalógusból jön) |
| `apps/admin/src/lib/error-surface.logic.ts` | import-átkötés, a döntési sorrend **változatlan** |
| `apps/admin/src/features/api-keys/api-keys.const.ts` | a `FIELD_ERROR_CODES` újra-exportálás törölve; `DEFAULT_FIELD_PATH_BY_CODE` marad (domain-tudás) |

Mezőképes kódok: `VALIDATION_FAILED`, `SEMANTIC_VALIDATION_FAILED` (új), `API_KEY_IDENTIFIER_CONFLICT`.
A `STALE_WRITE` szándékosan **nem** mezőképes: a hibáztatott `updatedAt` rejtett konkurrencia-token,
ezért oldalszintű, újratöltésre buzdító szöveget kap.

### Generikus leképezés

| Fájl | Változás |
| --- | --- |
| `apps/admin/src/lib/field-errors.interface.ts` | **új** — `FieldErrorMapping<F>`, `FieldErrorTarget<F>` (`fieldPaths`, opcionális `defaultPathByCode`) |
| `apps/admin/src/lib/field-errors.logic.ts` | **új** — `toFieldErrors<F extends string>(error, target)`; rögzített sorrend: lemondás → semmi; nem mezőképes kód → oldal; `issues[]` → path-onként egy üzenet (első nyer); üres `issues` → default path, ha a form birtokolja |
| `apps/admin/src/features/api-keys/api-keys.logic.ts` (+ `.test.ts`) | **törölve** — a feature-beli másolat és tesztjei |
| `apps/admin/src/features/api-keys/api-keys.interface.ts` | `ApiKeyFieldErrors` törölve |
| `apps/admin/src/pages/api-keys/ui/ApiKeyForm.tsx` | a közös függvényt hívja `{ fieldPaths: API_KEY_FIELD_PATHS, defaultPathByCode: DEFAULT_FIELD_PATH_BY_CODE }` targettel |

### Tesztek

| Fájl | Változás |
| --- | --- |
| `apps/admin/src/lib/api-error-code.test.ts` | **új** — teljességi kapu a `API_ERROR_CODE` ellen (mindkét irányban), mezőképes kódok halmaza, `STALE_WRITE` ≠ `CONFLICT_MESSAGE` |
| `apps/admin/src/lib/field-errors.logic.test.ts` | **új** — a 13 átmozgatott eset + 6 új (lemondás `AbortError`/`CancelledError`, nem birtokolt path, generikus `['a','b']` mezőlista, `SEMANTIC_VALIDATION_FAILED` mezőn, `STALE_WRITE` oldalszinten, form-on kívüli default path) |
| `apps/admin/src/features/api-keys/use-api-keys.test.tsx` | a két állítás a lib függvényt hívja az api-keys targettel |
| `apps/admin/src/test/mocks/api-error.mock.ts` | **új** `createCancelledError()` |

## Két mellékhatásként javított hiba

1. **A lemondott mutáció eddig hibaként jelent meg.** `toFieldErrors(AbortError)` →
   `UNKNOWN_ERROR_MESSAGE` („Váratlan hiba történt.”), miközben a `toErrorSurface` ugyanezt
   `silent`-nek sorolja be. Most `{ fields: {}, form: null }`.
2. **A `SEMANTIC_VALIDATION_FAILED` nem tudott mezőre kerülni.** Az AIS-108 szerződés szerint a
   `details[]` megnevezi a hibás mezőt, a kód mégsem volt a mezőképes listában — a 422 oldalszintű
   alertként jelent meg. Most a mező alatt jelenik meg.

## Ellenőrzés

```powershell
pnpm --filter @callback/admin test     # 28 fájl / 239 teszt zöld
pnpm --filter @callback/admin lint     # zöld
pnpm --filter @callback/admin build    # tsc --noEmit + vite build zöld
pnpm quality                           # 4 gate: layers (80 modul), knip, palette, field-errors — 0 violations
pnpm test                              # shared → api-client → ui → admin → api mind zöld
```

Negatív bizonyíték: a `STALE_WRITE` bejegyzés törlése az `ERROR_CODE_CATALOGUE`-ból a `tsc`-t
a totális record miatt, az `api-error-code.test.ts`-t pedig a kulcshalmazon buktatja.

## Specs frissítés

[`docs/Specs/UI-Architecture.md`](../Specs/UI-Architecture.md:1) — `Utolsó frissítés` bump,
a `lib` réteg sora, új §4.1.1 (egy katalógus, derivált táblák) és §4.1.2 (failure → form szabályok),
§9.3 field-error gate pontosítás.
