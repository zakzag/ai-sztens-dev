# AIS-140 — Admin fejléc újratervezése (sticky két sávos shell, témaválasztó, breadcrumb)

**Story:** [AIS-140](https://zakzag.atlassian.net/browse/AIS-140) — _Admin fejléc újratervezése: sticky két sávos shell, témaválasztó és breadcrumb_
**Dátum:** 2026-11-06 17:52 (Europe/Budapest)
**Állapot:** jóváhagyott terv, implementáció előtt

---

## 1. Kiinduló állapot (mért tények a kódból)

| Elem | Ma | Bizonyíték |
| --- | --- | --- |
| Fejléc | egy sor, `border-b`, `mx-auto max-w-5xl`, nem sticky | [`AdminLayout.tsx`](../../apps/admin/src/app/layout/AdminLayout.tsx:43) |
| Navigáció | registry-ből generált `AdminNav`, a brand mellett | [`AdminNav.tsx`](../../apps/admin/src/app/layout/AdminNav.tsx:25) |
| `<main>` | `mx-auto w-full max-w-5xl px-6 py-8` | [`AdminLayout.tsx`](../../apps/admin/src/app/layout/AdminLayout.tsx:55) |
| Témaváltás | nincs: egy (dark) token-készlet, `data-theme` nélkül | [`theme.css`](../../packages/ui/src/styles/theme.css:22) |
| User-settings gomb | nincs a kódban | `grep` az `apps/admin/src` alatt: nincs találat |
| Breadcrumb | nincs infra; a `RouteEntry` nem hordoz crumb-metadatot | [`route-entry.interface.ts`](../../apps/admin/src/app/router/route-entry.interface.ts:14) |
| Ikonok | nincs ikon-könyvtár | egyik `package.json`-ban sincs `lucide`/`react-icons` |
| `Select`/`RadioGroup` opció-label | `string`, natív `<option>` / `<label>` szöveg | [`select.interface.ts`](../../packages/ui/src/components/select/select.interface.ts:8), [`radio-group.interface.ts`](../../packages/ui/src/components/radio-group/radio-group.interface.ts:6) |

**Korlát, amit a terv tiszteletben tart:** a `palette-gate` egyetlen fájlt enged literálokkal
([`EXEMPT_LITERAL_FILES`](../../scripts/quality/palette-gate.const.mjs:35)), és a
`UI-Architecture.md` §5 csak **két** globális store-t enged (session, notification).

---

## 2. Döntések

| # | Döntés | Indok / elvetett alternatíva |
| --- | --- | --- |
| D1 | Két sávos fejléc: 1. sor brand + akciók, 2. sor nav + breadcrumb | a user választása; a brand/akciók és a navigáció szétválik |
| D2 | Fejléc **és** `<main>` full-bleed (csak `px-6`) | a user kérése („bal oldalt teljesen”); a `max-w-5xl` megszűnik |
| D3 | A témaválasztó **csak UI**: lokális `useState` + **üres** eseménykezelő; nincs `data-theme`, nincs perzisztencia | a téma-implementáció külön ticket; most a UI-szerződés készül el |
| D4 | User-settings **ikon-gomb nem funkcionális** (`aria-label`, nincs `onClick`) | a story a vázat adja; a működés (profil/kijelentkezés) külön ticket |
| D5 | Breadcrumb **hierarchikus, registry-alapú**: `breadcrumbLabel` + `breadcrumbParentPath` + `resolveBreadcrumbLabel` | egyetlen adathely, tiszta és tesztelhető levezetés; elvetve: oldalankénti kézi lista (driftel) |
| D6 | Dinamikus szegmens crumb-labelje a **nyers** paraméter | a display-név szerver-adat lenne (későbbi finomítás) |
| D7 | `AppErrorBanner` a fejléc fölött marad, **nem** sticky | a banner feltételhez kötött, a fejléc állandó |
| D8 | Fejléc z-index `z-30`, konstansból | log drawer `z-40`, dialog `z-50`, toast `z-60` — a fejléc mindegyik alatt |
| D9 | Témaválasztó = `RadioGroup`, nem `Select` | a `Select` natív `<option>`-t renderel, SVG ikon nem tehető bele |
| D10 | Ikonok inline SVG-ként a `packages/ui`-ban (Lucide, ISC), **nincs** új dependency | öt ikon nem indokol könyvtárat; a döntést a §7 dependency tábla is rögzíti |
| D11 | Téma-állapot **nem** kerül store-ba | §5: globális store csak session + notification lehet |
| D12 | A fejléc nem implementálja a témákat → a `palette-gate` kivétellistája **nem** változik | nincs új szín-literál |

---

## 3. Subtaskok és sorrend

| # | Kulcs | Tartalom | Függ |
| --- | --- | --- | --- |
| 1 | [AIS-144](https://zakzag.atlassian.net/browse/AIS-144) | `packages/ui`: ikon-vagyon + `RadioOption.icon` | — |
| 2 | [AIS-145](https://zakzag.atlassian.net/browse/AIS-145) | `packages/ui`: `Breadcrumb` primitíva | AIS-144 |
| 3 | [AIS-146](https://zakzag.atlassian.net/browse/AIS-146) | admin: breadcrumb adat + logika + `AppBreadcrumb` | AIS-145 |
| 4 | [AIS-147](https://zakzag.atlassian.net/browse/AIS-147) | admin: sticky két sávos fejléc + `ThemeSelector` + settings gomb | AIS-144…146 |

A sorrend azért kötelező, mert a `quality:dead-code` (knip) azonnal pirosítja a használatlan
exportot: minden primitíva abban a subtaskban születik, amelyik már fogyasztja (vagy az azt követő
subtaskban, egy PR-en belül).

---

## 4. Fájlszintű terv

### 4.1 AIS-144 — ikon-vagyon + `RadioOption.icon`

| Fájl | Változás |
| --- | --- |
| [`packages/ui/src/components/icon/icon.interface.ts`](../../packages/ui/src/components/icon/icon.interface.ts) | új: `IconProps { readonly className?: string }` |
| [`packages/ui/src/components/icon/icons.tsx`](../../packages/ui/src/components/icon/icons.tsx) | új: `SunIcon`, `MoonIcon`, `SunsetIcon`, `SettingsIcon`, `ChevronRightIcon` — inline SVG, `currentColor`, `aria-hidden`, `focusable="false"`, Lucide forrás + ISC licenc a JSDoc-ban |
| [`packages/ui/src/components/radio-group/radio-group.interface.ts`](../../packages/ui/src/components/radio-group/radio-group.interface.ts) | `RadioOption.icon?: ReactNode` |
| [`packages/ui/src/components/radio-group/RadioGroup.tsx`](../../packages/ui/src/components/radio-group/RadioGroup.tsx) | az ikon a `<label>` elején, `aria-hidden` wrapperrel |
| [`packages/ui/src/index.ts`](../../packages/ui/src/index.ts) | explicit exportok |
| [`packages/ui/test/icon.test.tsx`](../../packages/ui/test/icon.test.tsx) | új teszt |
| [`docs/Specs/UI-Architecture.md`](../../docs/Specs/UI-Architecture.md) | §4 tábla + ikon-bekezdés + §7 döntés |

### 4.2 AIS-145 — `Breadcrumb` primitíva

| Fájl | Változás |
| --- | --- |
| [`packages/ui/src/components/breadcrumb/breadcrumb.interface.ts`](../../packages/ui/src/components/breadcrumb/breadcrumb.interface.ts) | új: `BreadcrumbItem`, `BreadcrumbLinkRenderer`, `BreadcrumbProps` |
| [`packages/ui/src/components/breadcrumb/breadcrumb.const.ts`](../../packages/ui/src/components/breadcrumb/breadcrumb.const.ts) | új: `BREADCRUMB_DEFAULT_ARIA_LABEL` |
| [`packages/ui/src/components/breadcrumb/Breadcrumb.tsx`](../../packages/ui/src/components/breadcrumb/Breadcrumb.tsx) | új: `<nav>` + `<ol>`, utolsó elem `aria-current="page"`, injektált link, üres lista → nincs landmark |
| [`packages/ui/test/breadcrumb.test.tsx`](../../packages/ui/test/breadcrumb.test.tsx) | új teszt |
| [`docs/Specs/UI-Architecture.md`](../../docs/Specs/UI-Architecture.md) | §4 tábla új sor |

### 4.3 AIS-146 — breadcrumb adat + logika + bekötés

| Fájl | Változás |
| --- | --- |
| [`apps/admin/src/app/router/route-entry.interface.ts`](../../apps/admin/src/app/router/route-entry.interface.ts) | `breadcrumbLabel`, `breadcrumbParentPath?`, `resolveBreadcrumbLabel?` |
| [`apps/admin/src/app/router/breadcrumb.interface.ts`](../../apps/admin/src/app/router/breadcrumb.interface.ts) | új: `BreadcrumbCrumb` |
| [`apps/admin/src/app/router/breadcrumb.logic.ts`](../../apps/admin/src/app/router/breadcrumb.logic.ts) | új: `toBreadcrumbItems(routes, pathname, params)` — statikus → `:param` → catch-all illesztés, parent-lánc, ciklus-védelem |
| [`apps/admin/src/app/router/route-registry.tsx`](../../apps/admin/src/app/router/route-registry.tsx) | minden entry breadcrumb-mezői |
| [`apps/admin/src/app/layout/AppBreadcrumb.tsx`](../../apps/admin/src/app/layout/AppBreadcrumb.tsx) | új: `useLocation` + `useParams` → `Breadcrumb`, `renderLink` = react-router `Link` |
| [`apps/admin/src/app/layout/AdminLayout.tsx`](../../apps/admin/src/app/layout/AdminLayout.tsx) | ideiglenes bekötés a nav alá |
| tesztek | `breadcrumb.logic.test.ts`, `AppBreadcrumb.test.tsx`, `route-registry.test.ts` invariánsok, `AdminLayout.test.tsx` frissítés |
| docs | `UI-Architecture.md` §4.1 + §4.2, `New-Admin-Page.md` checklist |

### 4.4 AIS-147 — sticky két sávos fejléc

| Fájl | Változás |
| --- | --- |
| [`apps/admin/src/app/layout/layout.const.ts`](../../apps/admin/src/app/layout/layout.const.ts) | új: z-index, sormagasságok, padding, settings aria-label, téma-opciók |
| [`apps/admin/src/app/layout/ui/ThemeSelector.tsx`](../../apps/admin/src/app/layout/ui/ThemeSelector.tsx) | új: `RadioGroup` + 3 ikonos opció, lokális `useState`, **üres** `onThemeChange` |
| [`apps/admin/src/app/layout/AdminHeader.tsx`](../../apps/admin/src/app/layout/AdminHeader.tsx) | új: sticky `<header>`, két sor, brand, akciók, nav, breadcrumb |
| [`apps/admin/src/app/layout/AdminLayout.tsx`](../../apps/admin/src/app/layout/AdminLayout.tsx) | header kiszervezése, `<main class="w-full flex-1 px-6 py-8">` |
| tesztek | `AdminHeader.test.tsx`, `ThemeSelector.test.tsx`, `AdminLayout.test.tsx` frissítés |
| docs | `UI-Architecture.md` §4.1 + §5, `docs/history/` bejegyzés |

**Komponens-vázlat (AIS-147):**

```tsx
<header className={`sticky top-0 ${ADMIN_HEADER_Z_INDEX} border-b border-border-hairline bg-surface-raised`}>
  <div className={`flex ${ADMIN_HEADER_TOP_ROW_HEIGHT} items-center justify-between ${ADMIN_HEADER_PADDING_X}`}>
    <Link to={APP_ROUTE_HOME_PATH} className="text-lg font-semibold text-text-primary">
      {APP_BRAND_LABEL}
    </Link>
    <div className="flex items-center gap-4">
      <ThemeSelector value={theme} onThemeChange={handleThemeChange} />
      <Button type="button" variant="ghost" size="sm" aria-label={APP_USER_SETTINGS_ARIA_LABEL}>
        <SettingsIcon className="size-5" />
      </Button>
    </div>
  </div>

  <div className={`flex ${ADMIN_HEADER_CRUMB_ROW_HEIGHT} items-center justify-between gap-6 border-t border-border-hairline ${ADMIN_HEADER_PADDING_X}`}>
    <AdminNav routes={routes} />
    <AppBreadcrumb routes={routes} />
  </div>
</header>

// Az eseménykezelő szándékosan üres — a téma-implementáció nem tárgya ennek a story-nak (D3).
function handleThemeChange(_value: ThemeOption): void {}
```

---

## 5. Tesztstratégia

- **Unit (Vitest + Testing Library)** minden rétegen: `*.logic.ts` minden ága, primitívek
  variánsai, hookok success/error állapota. Mock a `src/test/mocks/**` alatt, hálózat nélkül.
- **Regressziós pontok, amelyek elromolhatnak:**
  - [`AdminLayout.test.tsx`](../../apps/admin/src/app/layout/AdminLayout.test.tsx:88) névtelen
    `getByRole('button', { expanded: false })` — a settings gomb után **név szerint** kell kérdezni;
  - [`AdminLayout.test.tsx`](../../apps/admin/src/app/layout/AdminLayout.test.tsx:75) link-szám
    (`queryAllByRole('link')`) — a breadcrumb linkjei számlálódnak;
  - `quality:dead-code`: minden új export azonnal használt legyen.
- **E2E:** a repóban nincs böngésző-harness (a `test:e2e` csak az API-t fedi), ezért a story
  DoD-jában **manuális ellenőrzési lista** szerepel (sticky, magasság, layering, ikonok).

---

## 6. Ellenőrző parancsok

```bash
pnpm quality            # layers, dead-code, tokens, field-errors, docs
pnpm test:quality       # a gate-ek saját tesztjei (fixtures)
pnpm typecheck
pnpm lint
pnpm test               # shared, api-client, notifications, ui, admin, api
pnpm dev                # manuális ellenőrzés: /api-keys, /api-keys/<id>, /calls
```

---

## 7. Kockázatok és ellenintézkedések

| Kockázat | Ellenintézkedés |
| --- | --- |
| A `sticky` fejléc alá csúszó overlay-k (log drawer, toast) | z-index konstansból (`z-30`), teszt a konstans használatára |
| A breadcrumb parent-lánc elszakad egy új route-nál | registry-invariáns teszt: minden `breadcrumbParentPath` létező entry-re mutat |
| A `RadioGroup` primitíva módosítása más formokat érint | ikon nélküli DOM bitre változatlan + regressziós teszt |
| A full-bleed `<main>` szétdobja a táblázatokat (`/api-keys`) | manuális ellenőrzés a DoD-ban; ha kell, a táblázat saját max-width-et kap — külön döntés |
| A story terjedelme (4 subtask, két package) | a sorrend kötelező, minden subtask önállóan zöld gate-tel zárul |

---

## 8. Nyitott, későbbi ticketek

- **Téma-implementáció:** `[data-theme]` token-override-ok a `theme.css`-ben, `color-scheme: light`,
  mentés (localStorage vagy user-preference), villogás-mentes első festés.
- **User-settings működés:** `DropdownMenu` (profil, kijelentkezés) vagy beállítások panel.
- **Breadcrumb finomítás:** entitás-név a crumbban (D6), hosszú láncok tördelése.
