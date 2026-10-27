# Frontend notification + élő log rendszer — tervező beszélgetés

**Dátum:** 2026-10-22 15:52 (Europe/Budapest)
**Típus:** terv (implementáció még nem történt meg)
**Terv dokumentum:** [`docs/plans/2026-10-22--15-40-00-frontend-notification-and-log-system-plan.md`](../plans/2026-10-22--15-40-00-frontend-notification-and-log-system-plan.md:1)

## Kiinduló igény

Minden oldalra beépülő notification rendszer, ahol a notification és a rendszerüzenetek
(logok) **ugyanabban a belső tárolóban** gyűlnek, a tároló kezelése **UI-független**, a UI csak
feliratkozik rá. Toastként jelennek meg a jobb alsó sarokban, egymás fölé stackelve, idővel
eltűnve; emellett egy alapból rejtett, oldalszéli nyíllal előhívható panel csúsztatva mutatja az
élő logot az utolsó néhány bejegyzéssel és egy gombbal a korábbiak betöltéséhez.

## Kutatás (Brave MCP)

Összehasonlítottuk a Sonner, `react-hot-toast`, `react-toastify` és a saját megoldás
lehetőségeit. Kulcs megállapítások:

- A log-tárolót egyik library sem adja, tehát a rendszer gerince mindenképp saját munka.
- A Sonner maga is egy observer store + egy feliratkozó komponens, tehát a szükséges minta
  megegyezik azzal, amit mi írnánk le; a különbség csak az animációs polír.
- Library használatával a látható toastokról egy **második** igazságforrás keletkezne, amit
  dismiss/undo/clear esetén két irányban kellene szinkronban tartani.
- A repóban jelenleg **nincs** telepítve toast library és `zustand` sem.

Források: [Building a toast component](https://emilkowal.ski/ui/building-a-toast-component),
[Toast library comparison 2026](https://www.pkgpulse.com/guides/react-hot-toast-vs-react-toastify-vs-sonner-2026),
[Top React notification libraries](https://knock.app/blog/the-top-notification-libraries-for-react),
[`useSyncExternalStore`](https://react.dev/reference/react/useSyncExternalStore).

## Döntések

| # | Döntés |
|---|---|
| N1 | Saját core + saját UI (Option A), library nélkül |
| N2 | Új `packages/notifications` csomag (core + React bindings); a `packages/ui` csak prezentációs `Toast` / `ToastStack` / `LogDrawer` / `LogEntryRow` primitíveket kap |
| N3 | Toast: max 3 látható, success/info 4 s, warning 6 s, error sticky, hover és rejtett tab pause, 2 s-en belüli azonos üzenet dedupe |
| N4 | Drawer: jobb szél, non-modális, 20 bejegyzés nyitáskor, „Korábbiak betöltése” +50, szint szűrők, törlés, Escape |
| N5 | Scope: csak `apps/admin`; az `apps/web` külön follow-up a token-migráció után |
| N6 | Log perzisztencia: `sessionStorage` tükör, cap 200, mountkor visszatöltés, toast **nem** perzisztálódik |
| N7 | Teljes automatikus capture: `QueryCache`/`MutationCache` callbackek + HTTP `onEvent` + globális `error`/`unhandledrejection`, az explicit `notify.*` mellett |

## Amit a tervezés során kiderítettünk a jelenlegi kódról

- [`apps/admin/src/main.tsx`](../../apps/admin/src/main.tsx:8)ban van a `QueryClient` — ide
  kerülnek a globális cache callbackek, nem kell egyetlen formot sem átírni hozzá.
- [`apps/admin/src/services/api-client.ts`](../../apps/admin/src/services/api-client.ts:42) az
  egyetlen composition root, tehát a HTTP `onEvent` injektálása egy helyen történik, a
  `packages/api-client` React-mentes marad.
- [`apps/admin/src/lib/error-message.ts`](../../apps/admin/src/lib/error-message.ts:53) már most
  egyetlen pure error→szöveg leképezés, ezt használja a notification is.
- [`apps/admin/src/pages/api-keys/ui/ApiKeyForm.tsx`](../../apps/admin/src/pages/api-keys/ui/ApiKeyForm.tsx:36)
  inline `Alert`-ekkel jelez; az első migrált form ez lesz (a 409-es `setError` viselkedés marad).
- `apps/web` még `slate-*` osztályokat használ, token-import nélkül — ezért nem kerül bele most.

## Következő lépés

A terv 6. szakasza szerinti implementáció (csomag-skeleton → core store → storage adapter →
UI primitívek → React bindings → admin wiring → `ApiKeyForm` migráció → dokumentáció).
