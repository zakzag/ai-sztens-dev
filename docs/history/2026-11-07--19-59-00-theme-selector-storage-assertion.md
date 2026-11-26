# ThemeSelector storage-állítás — összeomló teszt javítása

**Dátum:** 2026-11-07 19:59 (Europe/Budapest)
**Ticket:** nincs (teszt-infrastruktúra javítás) · **Kapcsolódó:** AIS-149, AIS-140 `D3`
**Terv:** [`docs/plans/2026-11-07--19-59-00-theme-selector-storage-assertion-plan.md`](../plans/2026-11-07--19-59-00-theme-selector-storage-assertion-plan.md)

## Mit szállítottunk

A [`ThemeSelector.test.tsx`](../../apps/admin/src/app/layout/ui/ThemeSelector.test.tsx:127) „touches neither the
document nor the storage” esete nem a `window.localStorage.length`-et olvassa többé, hanem
két, a teszt által telepített **rekorder `Storage`-dupla** számlálóit: a komponens egyetlen
`setItem` / `removeItem` / `clear` hívást sem végez a `localStorage`-on és a
`sessionStorage`-on. Ezzel a teszt nem függ attól, hogy a jsdom ad-e egyáltalán storage
objektumot, és a korábbi `length === 0` állításnál pontosabbat bizonyít.

## Kiváltó hiba

```text
TypeError: Cannot read properties of undefined (reading 'length')
 ❯ src/app/layout/ui/ThemeSelector.test.tsx:145:32
    145|   expect(window.localStorage.length).toBe(0);
```

A `window.localStorage` az adott futásban `undefined` volt → a teszt **összeomlott**, mielőtt
bármit állított volna. Lokálisan (node 20 + jsdom 26) a suite zöld, tehát a hiba
környezetfüggő: a jsdom storage-jának megléte nem garantált.

## Változott fájlok

| Fájl                                                                         | Változás                                                                                                                                          |
| ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`test/mocks/web-storage.mock.ts`](../../apps/admin/src/test/mocks/web-storage.mock.ts:1) | új: `installRecordingStorages()` + `RecordingStorage` / `WebStorageHarness` típusok; memória-alapú duplák `writtenKeys()`, `removedKeys()`, `clearCount()`, `isUntouched()` számlálókkal és `restore()` undo-val |
| [`app/layout/ui/ThemeSelector.test.tsx`](../../apps/admin/src/app/layout/ui/ThemeSelector.test.tsx:12) | `beforeEach` telepíti, `afterEach` visszaállítja a duplákat; a storage-állítások a számlálókra váltottak  |

## Döntések

| #   | Döntés                                                                                                                                                                        |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A   | Nem `window.localStorage?.length ?? 0` guard: az elfedné a regressziót (egy írás továbbra is „0 hossz” lehet), ezért írás-detektáló dupla kell.                                 |
| B   | A duplák `Object.defineProperty`-vel települnek, így akkor is létrejönnek, ha a `window`-nak nincs saját storage property-je; a `restore()` az eredeti descriptor állapotot hozza vissza. |
| C   | A duplák minden teszt előtt **újra** települnek, hogy egy korábbi tesztből maradt bejegyzés ne tudja véletlenül „érintetlennek” mutatni a storage-ot.                          |
| D   | Spicek (`vi.spyOn`) helyett számlálók: a szerződés a megfigyelhető viselkedés („nem írt”), nem egy belső hívási sorrend.                                                       |

## Ellenőrzés

- `pnpm --filter @callback/admin exec vitest run src/app/layout/ui/ThemeSelector.test.tsx` → 5/5 zöld
- `pnpm --filter @callback/admin exec vitest run` → 43 fájl, **490/490 zöld**
- `pnpm --filter @callback/admin typecheck` → tiszta
- `pnpm --filter @callback/admin lint` → tiszta

## Follow-up

A [`session-token.test.ts`](../../apps/admin/src/auth/session-token.test.ts:18) közvetlenül
`window.sessionStorage`-ot használ (`clear()` a `beforeEach`-ben). Ha ott is felmerül a
hiányzó storage, ugyanez a harness alkalmazható.
