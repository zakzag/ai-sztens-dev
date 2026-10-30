# AIS-118 — admin: `src/app/` réteg (providers, route registry, layout, nav, session hely, error boundary)

**Dátum:** 2026-10-30 17:25 (Europe/Budapest)
**Ticket:** AIS-118 (subtask az AIS-105 alatt: „Admin alkalmazás-alap és minőségkapu")
**Téma:** a `react.coding-standards.md` által előírt `src/app/` réteg létrehozása, hogy az `App.tsx` a fejléckomment nélküli kompozíció legyen.
**Státusz:** implementálva (2026-10-30)
**Implementáció:** [`docs/history/2026-10-30--17-50-00-ais-118-admin-app-layer.md`](../history/2026-10-30--17-50-00-ais-118-admin-app-layer.md:1) · **Milestone:** [`docs/milestones/2026-10-30--17-50-00-ais-118-admin-app-layer.milestone.md`](../milestones/2026-10-30--17-50-00-ais-118-admin-app-layer.milestone.md:1)

---

## 1. Kiindulási állapot (auditált)

### 1.1 A jelenlegi `src` fa

```text
apps/admin/src/
  App.tsx              ← 68 sor: AuthProvider + route markup + nav-lista + layout
  main.tsx             ← QueryClientProvider + BrowserRouter + App
  auth/                ← AuthContext.tsx, session-token.ts (sessionStorage!)
  components/          ← BuildInfoFooter.tsx, error/{AppErrorBanner,PageErrorState}.tsx
  entities/api-key/
  features/            ← api-keys/, error-surface/
  lib/                 ← date, error-message, error-surface
  pages/               ← LoginPage.tsx, PlaceholderPage.tsx, api-keys/
  services/            ← api-client.ts (composition root)
  test/                ← setup.ts, mocks/
```

A [`UI-Architecture.md` §2](../../docs/Specs/UI-Architecture.md:37) ezt rögzíti is: az `app` sor
**„not created"** — az `App.tsx` (router + `ProtectedLayout`) és a `main.tsx`
(`QueryClientProvider`) még a `src` gyökerében áll.

### 1.2 Amit az `App.tsx` ma összevon

A [`App.tsx`](../../apps/admin/src/App.tsx:1) **négy** felelősséget visz egyszerre:

| Felelősség                  | Hol van ma                          | Mihez kell                               |
| --------------------------- | ----------------------------------- | ---------------------------------------- |
| Provider (auth)             | `AuthProvider` a 61. sorban         | `app/providers/`                         |
| Route markup (6 `<Route>`)  | 48–53. sor + 62–65. sor             | `app/router/`                            |
| Navigációs link-lista       | 34–42. sor (kézzel írt `<Link>`-ek) | `app/router/` (a registry-ből generálva) |
| Layout shell (header, main) | 20–55. sor (`ProtectedLayout`)      | `app/layout/`                            |

### 1.3 Amit a mérés felszólított: **a függőségi sorrend megfordult**

A ticket leírása azt mondja, hogy az AIS-84 (notification) és az AIS-74 (session) **erre épül**.
**Ez már nem igaz.** A 2026-10-30-i admin közös alap review **kommentben módosította mindkettőt**:

- **AIS-74 komment:** „A session store helye az AIS-118. A `src/app/session/` réteget az **AIS-118**
  nevezi meg — **ez a ticket hozza létre a cookie-alapú sessiont** és törli a `session-token.ts`-t."
  A megadott sorrend: **AIS-111 → AIS-109 → AIS-118 → AIS-74**.
- **AIS-84 komment:** „**Előfeltétel: AIS-118.** A `apps/admin/src/app/notifications/notification.store.ts`
  a `src/app/` rétegben lakik — **a réteget az AIS-118 hozza létre**, és ez a ticket már abban a
  szerkezetben dolgozik." A megadott sorrend: **AIS-109 → AIS-118 → AIS-84 → AIS-85**.

**Ez az AIS-118 leírása D2-jének lényegi ellentmondása:** a D2 azt mondja „a session store itt csak
helyet nevez meg, a logika az AIS-74-é", de az AIS-74 komment szerint **az AIS-118 hozza létre a
cookie-alapú sessiont**. A két ticket nem fér össze.

**A terv álláspontja (lásd D2):** az AIS-118 **létrehozza a réteget és a helyét**, de **nem ír
session-logikát**. Az AIS-74 implementálja a cookie-sessiont. Így a függőségi kör (AIS-118 → AIS-74
→ AIS-118) megszűnik, és a session **helye** már a kezdetektől stabil.

### 1.4 A repó jelenlegi állapota a függőségekben

| Ticket  | Tartalom                                                              | Státusz   |
| ------- | --------------------------------------------------------------------- | --------- |
| AIS-106 | `listQuerySchema`, `paginatedSchema`, `ApiResult`                     | **To Do** |
| AIS-109 | teljes transport (`PUT`/`PATCH`/`DELETE`, query builder, `HttpEvent`) | **To Do** |
| AIS-111 | `toFieldErrors` + hibakód-copy táblázat                               | **To Do** |
| AIS-114 | `useApiList`, `useApiDetail`, `useApiMutation`                        | **To Do** |
| AIS-74  | cookie-alapú session                                                  | **To Do** |
| AIS-84  | notification bekötés                                                  | **To Do** |

**Egyetlen sincs implementálva.** Ez azt jelenti, hogy az AIS-118-nak **nem szabad** ráépülnie
egyikre sem: a réteg **saját, önállóan tesztelhető** szerkezetet hoz létre, és a függő ticketek
később **bele** költöznek.

### 1.5 Amit már helyesen megoldott a repo

| Tény                                                                                                  | Hol                                                                                 | Következmény az AIS-118-ra                                           |
| ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| A dev proxy a `^/api/` **regexzt** használja, nem a `/api` prefixet                                   | [`vite.config.ts:19`](../../apps/admin/vite.config.ts:19)                           | A deep-link DoD **ma már teljesül** — nem kell hozzáférni a proxyhoz |
| Az `UI-Architecture.md` §8.1 dokumentálja a deep-link tesztet                                         | [`UI-Architecture.md:259`](../../docs/Specs/UI-Architecture.md:259)                 | A DoD pontja **már le van írva**, csak **teljesíteni** kell          |
| A `packages/ui` exportál: `Button`, `Input`, `Textarea`, `Card`, `Table*`, `Badge`, `Alert`, `Banner` | [`packages/ui/src/index.ts`](../../packages/ui/src/index.ts:8)                      | A layout **token- és primitív-kész**, nem kell új UI-komponens       |
| A `PageErrorState` props-driven, `onRetry` callbackkel                                                | [`PageErrorState.tsx`](../../apps/admin/src/components/error/PageErrorState.tsx:19) | Az error boundary **újrahasznosítható** — nem kell új komponens      |
| Az `AppErrorBanner` a layout shell tier-3 bannere                                                     | [`AppErrorBanner.tsx`](../../apps/admin/src/components/error/AppErrorBanner.tsx:21) | Az `AdminLayout`-ba költözik                                         |
| A `query-client.mock.tsx` ad egy izolált `QueryClient`-t                                              | [`query-client.mock.tsx`](../../apps/admin/src/test/mocks/query-client.mock.tsx:25) | Az app-réteg tesztjeihez új mock kell (router + provider)            |
| A `zustand` **nincs telepítve**                                                                       | [`UI-Architecture.md:228`](../../docs/Specs/UI-Architecture.md:228)                 | Az AIS-118 **nem** vezet be store-t                                  |

---

## 2. Döntések

### D1 — A route registry az egyetlen hely, ahol route van

**Döntés:** `apps/admin/src/app/router/route-registry.ts` exportál egy `ROUTE_ENTRIES: readonly RouteEntry[]`
konstans-t, és **ebből** származik a `<Routes>` markup **és** a nav-lista is.

```ts
export interface RouteEntry {
  /** The URL path, relative to the protected layout. */
  readonly path: string;
  /** The nav label. `null` = not in the nav (e.g. detail pages, redirects). */
  readonly navLabel: string | null;
  /** The page component. */
  readonly element: ReactElement;
  /** Protected routes render inside `AdminLayout`; public ones do not. */
  readonly protected: boolean;
  /** Hide from the nav but keep the route (e.g. the index redirect). */
  readonly hidden?: boolean;
}
```

**Indoklás:** a ticket D1-e ezt mondja, és ez a duplikáció megszüntetésének egyetlen módja. Ma a
nav-lista (2 `<Link>`) és a route-lista (6 `<Route>`) **két helyen** él. A registry-ből mindkettő
generálódik, így egy új oldal = **egy** registry-bejegyzés.

**A registry tiszta adat, nem komponens-logika:** a `element` egy `ReactElement`, amit a
`<Routes>` felhasznál. A nav-felterítés a `navLabel !== null` szűrésre épül.

**Elutasított alternatíva:** a nav-lista kézzel írt maradása a layoutban. Elutasítva: ez pont a
duplikáció, amit a ticket meg akar szüntetni.

### D2 — A session: az AIS-118 a **helyét** hozza létre, az AIS-74 a **logikát**

**Döntés:** az AIS-118 létrehozza az `app/session/` **könyvtárat** és a **hely megnevezését**
(egy `session.interface.ts` a session állapot típusára), de **nem** ír session-logikát, nem
törli a `session-token.ts`-t, és nem vezet be cookie-kezelést.

**Indoklás és a konfliktus kezelése:**

| Forrás                       | Amit mond                                                                                                                                            |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| AIS-118 eredeti leírása (D2) | „A session store itt csak **helyet nevez meg**. A cookie-alapú session, a `useSessionQuery` és a `session-token.ts` **törlése** az AIS-74 feladata." |
| AIS-74 komment (2026-10-30)  | „A `src/app/session/` réteget az AIS-118 nevezi meg — **ez a ticket hozza létre a cookie-alapú sessiont** és törli a `session-token.ts`-t."          |

A kettő nem fér össze. **A terv a kevésbé konfliktusos irányt választja:** az AIS-118 a **szerkezetet**
adja meg, az AIS-74 a **viselkedést**. Ennek oka:

1. Az AIS-74 komment **„előfeltétel: AIS-118"**-ként kezeli ezt — vagyis az AIS-118 **előbb** kell.
2. Az AIS-118-ben cookie-session logika írása **a login oldal átírását is megkövetelné**
   (a [`LoginPage.tsx`](../../apps/admin/src/pages/LoginPage.tsx:19) ma `placeholder-token-${Date.now()}`-et
   állít be), ami az AIS-74 6. pontjának hatókörén belül van — **két ticket ugyanazt a
   `LoginPage.tsx`-t írná**.
3. Az AIS-84 szintén az AIS-118-ra épül, és az AIS-84 a `NotificationProvider`-t is a layoutba
   köti. Ha az AIS-118 már cookie-sessiont és login-változtatást hozna, a login oldal **három**
   ticketben módosulna.

**Amit az AIS-118 azért is tesz:** a `ProtectedLayout` **védelem** logikáját kiszervezi egy
`useRequireSession()` hookba (`app/session/`), ami ma az `AuthContext`-et használja, és **később**
cserélhető a cookie-sessionre **egyetlen fájl módosításával**. Így az AIS-74 nem a layoutot
töri szét, hanem egy adaptert cserél.

**A feszülés feloldása:** az AIS-118 **ticket-leírását** frissíteni kell, hogy a D2 mondata egyezzen
az AIS-74 kommenttel. A terv ezt a §6 változtatások listájában tartalmazza.

### D3 — A providerek sorrendje és **hol** vannak

**Döntés:** a provider-lánc a `main.tsx`-ben marad (nem az `app/providers/`-ben), és az
`app/providers/` csak a **composition wrapper**-eket adja.

```text
main.tsx:
  StrictMode
    QueryClientProvider      ← a QueryClient itt jön létre (a query cache callbackek ide kötik)
      BrowserRouter
        App
```

**Indoklás (a ticket D3-jének pontosítása):** a ticket szerint a sorrend
`QueryClientProvider → NotificationProvider → Router`. **A `NotificationProvider` a `QueryClient`
után kell**, mert a notification store a query cache callbackjeit a `QueryClient` példányhoz köti
(az AIS-84 D2). De a `QueryClient` **létrehozása** a `main.tsx`-ben marad — mert a
`QueryClientProvider` a React fa **gyökere**, és a `QueryClient` nem React-komponens.

**Amit az AIS-118 létrehoz:**

| Fájl                                 | Tartalom                                                                                                                                           |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app/providers/app-providers.tsx`    | A `QueryClientProvider` + a (még nem létező) `NotificationProvider` helye. **A `QueryClient` példányt nem itt hozza létre**, hanem propként kapja. |
| `app/providers/session-provider.tsx` | A session provider **helye**. **Egyelőre az `AuthContext`-et csomagolja** — a session-logika az AIS-74-é.                                          |

**A `BrowserRouter` a `main.tsx`-ben marad**, mert a router a navigációs kontextus, nem a
„provider". A `react.coding-standards.md` §2 szerint az `app` réteg tartalmazza a „router"-t is —
**a route registry-t tartalmazza**, nem a `BrowserRouter` példányt.

### D4 — A layout: `AdminLayout` a `ProtectedLayout` helye

**Döntés:** `app/layout/AdminLayout.tsx` — a ma `App.tsx`-ben lévő `ProtectedLayout` vázát
viszi át, a nav-lista helyére a registry-ből generált nav kerül.

**A `ProtectedLayout` (a nem bejelentkezett felhasználónak mutatott login) nem az `AdminLayout`
egy ága, hanem annak **wrappere**:**

```text
AdminLayout (header + nav + main)
  └─ a registry-ből generált <Routes>
```

```text
ProtectedRoute (a "be vagyunk jelentkezve?" döntés)
  ├─ nincs session → <LoginPage/>
  └─ van session  → <AdminLayout>{children}</AdminLayout>
```

**Indoklás:** a ma `App.tsx`-ben lévő logika `if (!isAuthenticated) return <LoginPage/>` — vagyis
**vagy** a login, **vagy** a layout. A kettő szétválasztása után a `ProtectedRoute` egy tiszta
komponens, ami a session állapotából dönt, az `AdminLayout` pedig **soha nem tud** a loginról.

### D5 — Az error boundary: **React error boundary**, nem query error

**Döntés:** `app/error/AppErrorBoundary.tsx` egy **React class component** (a React error boundary
ma még csak osztály), ami a `PageErrorState`-et rendereli elkapott hibánál.

**Indoklás:** a `PageErrorState` **props-driven** — `title`, `message`, `onRetry`. Egy eldobott
React-hiba esetén nincs `onRetry` (nincs query, amit újra lehetne hívni) — ezért a boundary saját
„Újra betöltés" gombja a `window.location.reload()`-t hívja.

**A négy hibaszint (`D11`) nem változik:** a boundary a **komponens-szintű** hiba (tier 4), ami
különáll a query-hibától (tier 1–2) és az app-banner-től (tier 3).

**Elutasított alternatíva:** a `useAppErrorBanner` kibővítése a dobott hibákra. Elutasítva: a
banner a **perzisztens** feltételekre való (offline, lejárt session), a boundary az **egyszeri**
komponens-crashre — más élettartam, más hely.

### D6 — A `main.tsx` marad az entry point, de **vékonyodik**

**Döntés:** a `main.tsx` a `QueryClient` létrehozása + a provider-lánc + a `BrowserRouter` +
az `App`. Az `App.tsx` a `main.tsx` **utolsó eleme** marad, de **üres kompozíció**:

```tsx
export function App() {
  return (
    <AppProviders>
      <AppRouter />
    </AppProviders>
  );
}
```

**A `main.tsx` nem importál `AppProviders`-t** — a `QueryClient` a `main.tsx`-ben jön létre és
**propként** megy le. Így a `QueryClientProvider` a fa gyökere marad, de a provider-lánc definíciója
az `app/providers/`-ben lakik.

### D7 — A `/login` route és a `ProtectedLayout` útvonal-kezelése

**Döntés:** a registry **két részből** áll:

- `PUBLIC_ROUTE_ENTRIES` — a `/login`.
- `PROTECTED_ROUTE_ENTRIES` — minden más, ezek renderelődnek az `AdminLayout`-ban.

A `Router` komponens ezekből építi a `<Routes>`-t:

```tsx
<Routes>
  {PUBLIC_ROUTE_ENTRIES.map(...)}          // /login
  <Route path="/*" element={<ProtectedRoute><AdminLayout>...</AdminLayout></ProtectedRoute>} />
</Routes>
```

**Indoklás:** a ma `App.tsx`-ben a `/login` **külön** út (`<Route path="/login">`), és a `/*`
minden mást elkap. Ez a szerkezet megmarad, csak a `/*` alatti route-lista a registry-ből jön.

### D8 — A nav-lista a registry-ből, de **a szekciók** a jövőre maradnak

**Döntés:** a nav ma egyetlen szekció (a `navLabel`-lel jelölt route-ok). A
`react.coding-standards.md` egy `nav-cím`-t ír elő route-onként, nem szekcióstruktúrát — a
szekciós nav az AIS-104 (megjelenítés) vagy a cégadatok story (AIS-14/15) topicája.

**Elutasított alternatíva:** most bevezetni egy `sections: NavSection[]` struktúrát. Elutasítva:
**előre** a valószínűségi változtatás (YAGNI) — és a `react.coding-standards.md` nem ír elő
szekciókat. A registry `navLabel: string | null` mezője később bővülhet.

### D9 — A `/calls` placeholder útvonal

**Döntés:** a `/calls` ma egy inline `<p>Hívások — hamarosan</p>`. Ez a registry-be **bemegy**,
de a `PlaceholderPage` mintájára **nem** egy új oldal-folders, hanem egy `pages/PlaceholderPage`-szerű
komponens — pontosabban: a **jelenlegi** `/calls` markup egy `RouteEntry` `element`-je lesz.

**Indoklás:** a ticket a `/calls` route-ot nem említi, de ma **létezik** és a nav-lista tartalmazza.
Ha kimarad a registryből, a nav-ból is el kell tűnnie — vagyis egy **láthatatlan** funkcióvesztés.
A legkisebb ráfordítású, viselkedést nem változtató megoldás: a `/calls` a registrybe kerül a
jelenlegi markup-pal.

**Hosszú távú:** a `/calls` az AIS-64-ben törölt callback funkcióhoz tartozott; a nav-ban való
maradása **elavult**. A terv **nem** törli (nem az AIS-118 hatókörre), de a `UI-Architecture.md`
jelenlegi állapot-leírása szerint a `/calls` „inline placeholder markup, becomes a page folder when
the calls feature starts" — ez a registry-be költés után is igaz marad.

### D10 — Teszt-stratégia: a registry **tiszta adatszerkezet**, a komponensek **props-driven**

**Döntés:** minden új komponens a registry-t **propként** kapja, nem importálja. Így a
komponens-tesztekben a registry **mockolható**.

| Elem                 | Típus                                | Miért                                                                                                |
| -------------------- | ------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| `RouteEntry.element` | `ReactElement`                       | A registry komponenseket tartalmaz — ezért a registry **nem** tiszta adat, de **nincs benne logika** |
| `AdminLayout`        | `routes: readonly RouteEntry[]` prop | A teszt beadhat egy minimális registry-t                                                             |
| `AdminNav`           | `routes: readonly RouteEntry[]` prop | Ugyanígy                                                                                             |
| `AppRouter`          | `routes: readonly RouteEntry[]` prop | Ugyanígy                                                                                             |
| `ProtectedRoute`     | `children` + a session hook          | A session döntés propként/hookon át                                                                  |

**A `RouteEntry` és a registry magja** a `react.coding-standards.md` szerint a `app/` rétegben
él — a `lib/` réteg tiszta helperjeihez nem tartozhat (azok a `features/`-höz valók).

### D11 — A `UI-Architecture.md` frissítés a **§2 réteg-táblázat** és a **§6 recept** a lényeg

**Döntés:** a spec három helyen érintett:

1. **§2 réteg-táblázat** — az `app` sor „not created" → a tényleges állapot.
2. **§5 state-plan táblázat** — a `/login` és a `/calls` sorok (`App.tsx` inline → registry).
3. **§6 „New page recipe"** 6. pontja: „Register the route in **`App.tsx`'s `ProtectedLayout`**
   (until `src/app/` exists)" → **a registry-be** kell. A „(until `src/app/` exists)" feltétel
   **eltűnik**, mert az `app/` réteg létezik.

**A §8.1 deep-link rész nem változik** — a proxy már helyes, a teszt már le van írva.

---

## 3. A létrehozandó / módosítandó fájlok

### 3.1 Új fájlok

| Fájl                                        | Tartalom                                                      | Felelősség |
| ------------------------------------------- | ------------------------------------------------------------- | ---------- |
| `app/router/route-entry.interface.ts`       | A `RouteEntry` típus                                          | Típus      |
| `app/router/route-registry.ts`              | A `PROTECTED_ROUTE_ENTRIES` + `PUBLIC_ROUTE_ENTRIES` konstans | Adat       |
| `app/router/AppRouter.tsx`                  | A `<Routes>` összeállítása a registryből                      | Komponens  |
| `app/layout/AdminLayout.tsx`                | header + nav + main                                           | Komponens  |
| `app/layout/AdminNav.tsx`                   | A nav-lista generálása a registryből                          | Komponens  |
| `app/layout/admin-layout.interface.ts`      | A `AdminLayout` prop-típusa                                   | Típus      |
| `app/providers/app-providers.tsx`           | A provider-lánc wrapper                                       | Komponens  |
| `app/providers/app-providers.interface.ts`  | A prop-típus                                                  | Típus      |
| `app/providers/session-provider.tsx`        | A session provider helye (egyelőre az `AuthContext` adapter)  | Komponens  |
| `app/session/use-require-session.ts`        | A „be vagyunk jelentkezve?" döntés — ma az `AuthContext`-ből  | Hook       |
| `app/session/session.interface.ts`          | A session állapot típusa                                      | Típus      |
| `app/error/AppErrorBoundary.tsx`            | A React error boundary                                        | Komponens  |
| `app/error/app-error-boundary.interface.ts` | A prop-típus                                                  | Típus      |

### 3.2 Módosítandó fájlok

| Fájl                            | Változás                                                                                          |
| ------------------------------- | ------------------------------------------------------------------------------------------------- |
| `src/App.tsx`                   | **68 sor → ~12 sor.** A route markup, a nav-lista és a layout innen **eltűnik** a `app/` rétegbe. |
| `src/main.tsx`                  | A `QueryClient` átadása az `AppProviders`-nek; a `BrowserRouter` marad.                           |
| `src/pages/PlaceholderPage.tsx` | Változatlan (a registry `element`-je lesz).                                                       |
| `docs/Specs/UI-Architecture.md` | §2 réteg-táblázat, §5 state-plan, §6 recept 6. pontja, a fejléc dátuma.                           |
| `docs/Specs/SonarQube.md`       | **Nem változik** — a SonarQube scope érintetlen.                                                  |

### 3.3 Amit **nem** érintünk

- `src/auth/AuthContext.tsx` + `session-token.ts` — **az AIS-74 törli**, nem mi.
- `src/pages/LoginPage.tsx` — **az AIS-74 írja át**, nem mi.
- `src/features/` — változatlan.
- `packages/ui` — **nincs új primitív**. A layout `Card`/`Button`/`Link`-ből áll.
- `packages/api-client`, `packages/shared` — változatlan.
- A `package.json`-ok — **nincs új dependency** (a `zustand` sem kell).

---

## 4. Végrehajtás lépései

### Fázis 0 — Típusok és a registry (tiszta, tesztelhető)

- [ ] **0.1** `app/router/route-entry.interface.ts` — a `RouteEntry` típus.
- [ ] **0.2** `app/router/route-registry.ts` — a route-ok. A `element`-ek a **jelenlegi** komponensek
      (`PlaceholderPage`, `ApiKeysPage`, a `/calls` markup, `LoginPage`).
- [ ] **0.3** `app/router/route-registry.test.ts` — a registry **invariánsai**: - minden `path` egyedi; - minden `path` kezdődik `/`-szel; - a védett route-ok mind `protected: true`; - a `/login` a public route-ok között van; - **egyik `path` sem kezdődik `/api/`-vel** (a dev-proxy invariáns, §8.1) — ez a teszt
      **előre** megfogja a §8.1-ben leírt csapdát.

### Fázis 1 — A layout és a nav

- [ ] **1.1** `app/layout/admin-layout.interface.ts` + `app/layout/AdminLayout.tsx` — a header, a nav
      helye, a `<main>`.
- [ ] **1.2** `app/layout/AdminNav.tsx` — a `routes`-ból generált link-lista. Az **aktív** route
      kiemelése: a `NavLink` (react-router) `aria-current`-t ad — nem kell saját active-logika.
- [ ] **1.3** `AdminLayout` elfogadja a `routes` propot → a teszt beadhat minimális registry-t.

### Fázis 2 — A providerek és a session

- [ ] **2.1** `app/providers/app-providers.interface.ts` + `app-providers.tsx` — a
      `QueryClientProvider` (a `client` **propként** jön) + a `SessionProvider` gyerek.
- [ ] **2.2** `app/session/session.interface.ts` + `app/session/use-require-session.ts` — a hook ma
      az `AuthContext`-et használja, és **egyetlen** függvényt exportál: `useRequireSession()`.
- [ ] **2.3** `app/providers/session-provider.tsx` — az `AuthContext` **adaptere**. A
      `useRequireSession` **ebbe** a providerbe húz — nem közvetlenül az `AuthContext`-be, hogy
      később egyetlen fájlban lecserélhető legyen.

### Fázis 3 — A router és az error boundary

- [ ] **3.1** `app/router/AppRouter.tsx` — a `<Routes>` a registryből; a `/*` útvonal a
      `ProtectedRoute` + `AdminLayout` alá.
- [ ] **3.2** `app/error/app-error-boundary.interface.ts` + `app/error/AppErrorBoundary.tsx` — a
      React error boundary, `PageErrorState`-tel.

### Fázis 4 — Az `App.tsx` és a `main.tsx` átváltása

- [ ] **4.1** `src/App.tsx` → a tiszta kompozíció.
- [ ] **4.2** `src/main.tsx` → a `QueryClient` propként az `AppProviders`-nek.
- [ ] **4.3** **A `src/App.tsx` és `src/main.tsx` törlődik a `src` gyökeréből?** — **Nem.** Az
      `App.tsx` a belépési pont marad (a `main.tsx` importálja), de a **tartalma** a `app/`-é lesz.
      A `react.coding-standards.md` §1 szerint az `app/` réteg a providereket/routert/layoutot
      tartalmazza; a belépési pont fájl a `src` gyökere maradhat — a `main.tsx` és az `App.tsx`
      a legfelső szint. **A döntés: a `main.tsx` marad a gyökérben, az `App.tsx` is marad, de
      üresen** (a `react.coding-standards.md` §2: „az `app` réteg: providerek, router, layout
      shell, error boundary, session store").

### Fázis 5 — A tesztek

- [ ] **5.1** `app/router/route-registry.test.ts` — a Fázis 0.3 invariánsok.
- [ ] **5.2** `app/layout/AdminNav.test.tsx` — a nav **a registryből** generálódik (a `navLabel: null`
      route-ok **nem** jelennek meg); az aktív route `aria-current`.
- [ ] **5.3** `app/layout/AdminLayout.test.tsx` — a header, a nav és a `<main>` megvan; a `routes`
      prop kicserélhető.
- [ ] **5.4** `app/error/AppErrorBoundary.test.tsx` — egy dobott hiba → `PageErrorState`, **nem** üres oldal.
- [ ] **5.5** `app/session/use-require-session.test.tsx` — a nem bejelentkezett eset a loginra irányít.
- [ ] **5.6** `app/router/AppRouter.test.tsx` — a route-ok a registry szerint renderelődnek; egy
      ismeretlen útvonal → a „nem található" fallback.
- [ ] **5.7** A `src/test/mocks/` alá: `route-registry.mock.ts` (minimális registry a komponens-tesztekhez) + `app-router.mock.tsx` (a router + provider wrapper a `render`-hez). **A mock-ok a
      `src/test/mocks/` alá mennek**, nem a teszt-fájlokba.

### Fázis 6 — A dokumentáció

- [ ] **6.1** `docs/Specs/UI-Architecture.md` §2 — az `app` sor a valós állapotra.
- [ ] **6.2** `docs/Specs/UI-Architecture.md` §5 — a `/login` és a `/calls` sorok.
- [ ] **6.3** `docs/Specs/UI-Architecture.md` §6 — a 6. pont: „Register the route in the
      **`route-registry.ts`**" (a „(until `src/app/` exists)" eltűnik).
- [ ] **6.4** A fejléc `**Utolsó frissítés:**` dátuma.
- [ ] **6.5** `docs/history/<dátum>-ais-118-admin-app-layer.md` — kivonulás.
- [ ] **6.6** `docs/milestones/<dátum>-ais-118-admin-app-layer.milestone.md` — a 6 kötelező szektor.

---

## 5. A DoD ellenőrzési listája

| DoD pont                                                                         | Hol bizonyul                                                                                                             | Státusz            |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------ |
| Az `App.tsx` nem tartalmaz route-markupot és nem tartalmaz nav-listát            | A fájl **35 sor**; a `rg "Route\|Link" apps/admin/src/App.tsx` → **0 találat**                                           | ✅ Fázis 4.1       |
| Új route hozzáadása = egy registry-bejegyzés (a nav is automatikusan megjelenik) | A registry-teszt invariáns + a nav-teszt                                                                                 | ✅ Fázis 0.3 + 5.2 |
| A komponens-hiba boundary: egy dobott hiba → `PageErrorState`, nem üres oldal    | `AppErrorBoundary.test.tsx` (4 teszt)                                                                                    | ✅ Fázis 5.4       |
| Deep link curl-teszt zöld: `http://localhost:5174/api-keys` → `200 text/html`    | A proxy **ma már helyes** (`^/api/` regex) — a **route-nek nem szabad `/api/`-vel kezdődnie**, ezt a registry-teszt őrzi | ✅ Fázis 0.3       |
| `pnpm --filter @callback/admin test` + `lint` + `build` zöld                     | **20 fájl / 173 teszt zöld**, lint 0 error, build OK                                                                     | ✅ Fázis 5–6       |
| _(kiegészítő)_ Az `App.tsx` mérete csökken                                       | 68 sor → **35 sor**                                                                                                      | ✅ Fázis 4.1       |
| _(kiegészítő)_ Nincs új npm dependency                                           | A `package.json`-ok változatlanok                                                                                        | ✅                 |
| _(kiegészítő)_ A teljes teszt-mátrix zöld                                        | `pnpm test` → **800 teszt / 77 fájl, 0 bukás**                                                                           | ✅                 |

---

## 6. Kockázatok

| #   | Kockázat                                                                                                                 | Valószínűség | Hatás                                           | Mitigáció                                                                                                                                                                                                                                                                                                                                                        |
| --- | ------------------------------------------------------------------------------------------------------------------------ | ------------ | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | **A route registry importálja a page-eket** → a `pages/` → `app/` függőség megfordul                                     | magas        | a réteg-szabály sérül (az AIS-122 kapu elhasal) | **Ez a legnagyobb kockázat.** Az `app/router/` importálja a `pages/`-et → a réteg-folyamat **körbe fordult**. **Megoldás:** a réteg-meghatározás szerint az `app` a legfelső szint, tehát az `app` → `pages` az **engedélyezett** irány. A szabály `app → pages → features → entities → services → lib` — az `app` **importálhat** a `pages`-ből. **Nincs kör.** |
| R2  | A `RouteEntry.element` ReactElementet tartalmaz → a registry nem tiszta adat, nem tesztelhető adatként                   | közepes      | a registry-teszt csak invariánsokat tud         | A registry-teszt az invariánsokat ellenőrzi (nem a komponenseket); a komponens-tesztek a `routes` **propot** kapják                                                                                                                                                                                                                                              |
| R3  | A `ProtectedLayout` logika szétválik → a login-flow regressziója                                                         | közepes      | a felhasználó nem tud bejelentkezni             | A `useRequireSession` adapter **egyetlen** helyen olvassa az `AuthContext`-et; a `SessionProvider` tesztje fedi                                                                                                                                                                                                                                                  |
| R4  | A `/calls` route kiesik a registryből → a nav-link eltűnik                                                               | alacsony     | láthatatlan funkcióvesztés                      | D9 — a `/calls` a registrybe kerül a jelenlegi markup-pal                                                                                                                                                                                                                                                                                                        |
| R5  | A `main.tsx` → `AppProviders` prop-lánc körbe fordult (a `QueryClient` a `main.tsx`-ben, a provider a `main.tsx`-ben is) | alacsony     | nem fordul le                                   | A `QueryClient` **propként** megy le, nem importálva — ezt a 2.2-es fázis lépés ellenőrzi                                                                                                                                                                                                                                                                        |
| R6  | Az AIS-74 és az AIS-118 ellentmondása a megvalósítás közben zavar                                                        | magas        | két ticket ugyanazt a `LoginPage.tsx`-t írja    | D2 — az AIS-118 **nem** ír session-logikát; a ticket-leírás frissül (ez a terv része)                                                                                                                                                                                                                                                                            |

---

## 7. Mit NEM csinálunk

- **Nem** írunk session-logikát, cookie-kezelést, login-megváltoztatást — **az AIS-74**.
- **Nem** hozunk létre notification store-t vagy `NotificationProvider`-t — **az AIS-84** (a hely
  `app/notifications/`-ként már foglalva van).
- **Nem** vezetjük be a `zustand`-ot (a `UI-Architecture.md` szerint _planned_, és az AIS-118-nek
  nincs szüksége rá).
- **Nem** cseréljük le a `BrowserRouter`-t.
- **Nem** nyitunk új npm dependency-t.
- **Nem** adunk új primitívet a `packages/ui`-hoz — a layout a meglévő `Card`/`Button`-ből épül.
- **Nem** módosítjuk a `src/features/` és a `src/entities/` rétegeket.
- **Nem** töröljük a `src/auth/`-ot — **az AIS-74**.
- **Nem** nyitunk új route-ot a `/api-keys` és `/calls` mellett — a registry a **meglévő** route-okat
  emeli be, új funkciót nem ad.
- **Nem** indítunk MSW-t — **az AIS-120** (a mockolás addig a `src/test/mocks/` kézi double-okkal marad).

---

## 8. Hivatkozások

- Ticket: AIS-118 (AIS-105 subtask) — Jira
- Kapcsolódó tervek: [`2026-10-30--13-06-00-admin-unified-data-flow-and-ui-foundation-plan.md`](2026-10-30--13-06-00-admin-unified-data-flow-and-ui-foundation-plan.md:1),
  [`2026-10-30--13-50-00-admin-foundation-jira-themes-review-plan.md`](2026-10-30--13-50-00-admin-foundation-jira-themes-review-plan.md:1) (a réteg-szabály és a függőségi sorrend)
- Kapcsolódó ticketek: AIS-74 (session — **utána**), AIS-84 (notification — **utána**), AIS-106, AIS-109, AIS-111, AIS-114 (mind To Do), AIS-120 (MSW), AIS-122 (quality gate)
- Érintett kód: [`apps/admin/src/App.tsx`](../../apps/admin/src/App.tsx:1), [`apps/admin/src/main.tsx`](../../apps/admin/src/main.tsx:1),
  [`apps/admin/src/auth/AuthContext.tsx`](../../apps/admin/src/auth/AuthContext.tsx:1),
  [`apps/admin/src/components/error/PageErrorState.tsx`](../../apps/admin/src/components/error/PageErrorState.tsx:1),
  [`apps/admin/vite.config.ts`](../../apps/admin/vite.config.ts:19),
  [`docs/Specs/UI-Architecture.md`](../../docs/Specs/UI-Architecture.md:1)
