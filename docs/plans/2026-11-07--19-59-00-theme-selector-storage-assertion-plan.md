# ThemeSelector „nem ír storage-ot" teszt megbízhatóvá tétele

**Dátum:** 2026-11-07 19:59 (Europe/Budapest)
**Érintett csomag:** [`apps/admin`](../../apps/admin/package.json:1)
**Státusz:** kész

## Probléma

A `pnpm test` (admin csomag) futtatásakor elhasalt:

```text
FAIL src/app/layout/ui/ThemeSelector.test.tsx > ThemeSelector > touches neither the document nor the storage
TypeError: Cannot read properties of undefined (reading 'length')
 ❯ src/app/layout/ui/ThemeSelector.test.tsx:145:32
    145|   expect(window.localStorage.length).toBe(0);
```

A `window.localStorage` ebben a környezetben `undefined`, ezért a `.length` olvasása
`TypeError`-t dob — vagyis a teszt **összeomlott**, nem állítást fogalmazott meg. A hiba
környezetfüggő: jsdom nem garantáltan ad `localStorage`/`sessionStorage` objektumot
(függ a jsdom buildtől és az environment origójától), így a teszt vagy zöld, vagy
összeomlik, attól függően, hol fut.

Ráadásul a vizsgált állítás (`length === 0`) gyenge: azt bizonyítja, hogy a storage üres,
nem azt, hogy a komponens **nem írt** bele.

## Cél

1. A teszt ne függjön a jsdom storage-jának létezésétől (ne omoljon össze).
2. Az állítás a valódi szerződést fogalmazza meg: a `ThemeSelector` **egyetlen írási
   műveletet sem** végez a `localStorage`-on és a `sessionStorage`-on.

## Megoldás

- Új mock: [`apps/admin/src/test/mocks/web-storage.mock.ts`](../../apps/admin/src/test/mocks/web-storage.mock.ts:1)
  - `installRecordingStorages()` → memória-alapú `Storage`-duplák a `window.localStorage` /
    `window.sessionStorage` helyére, `writtenKeys()` / `removedKeys()` / `clearCount()` /
    `isUntouched()` számlálókkal, valamint `restore()` a `defineProperty` visszavonására.
  - A telepítés `Object.defineProperty`-vel történik, tehát akkor is működik, ha a
    jsdom-nak nincs saját storage property-je.
- [`ThemeSelector.test.tsx`](../../apps/admin/src/app/layout/ui/ThemeSelector.test.tsx:46):
  `beforeEach` telepít, `afterEach` visszaállít; a negatív kontraktus a duplák számlálóin
  fut (`writtenKeys() === []`, `isUntouched() === true`).

## Nem változik

- A `ThemeSelector` komponens és a `onThemeChange` port viselkedése.
- A dokumentumra vonatkozó állítások (`data-theme`, `style`).

## Ellenőrzés

```powershell
pnpm --filter @callback/admin exec vitest run src/app/layout/ui/ThemeSelector.test.tsx
pnpm --filter @callback/admin exec vitest run
pnpm --filter @callback/admin typecheck
pnpm --filter @callback/admin lint
```

## Következmény / follow-up

Ugyanez a minta (`Storage`-dupla) alkalmazható később a
[`session-token.test.ts`](../../apps/admin/src/auth/session-token.test.ts:1) szintén
közvetlen `window.sessionStorage`-használatára, ha az ott is környezetfüggő hibát okoz.
