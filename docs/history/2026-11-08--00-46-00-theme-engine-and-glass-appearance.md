# Témamotor és glassmorphism megjelenés (AIS-164)

**Dátum:** 2026-11-08 00:46 (Europe/Budapest)
**Ticket:** [AIS-164](https://zakzag.atlassian.net/browse/AIS-164) — subtaskok: AIS-165, AIS-166, AIS-167, AIS-168
**Terv:** [`2026-11-08--00-22-00-theme-engine-and-glass-appearance-plan.md`](../plans/2026-11-08--00-22-00-theme-engine-and-glass-appearance-plan.md)
**Feasibility:** [`2026-11-08--00-18-00-glassmorphism-theme-feasibility-plan.md`](../plans/2026-11-08--00-18-00-glassmorphism-theme-feasibility-plan.md)

## Mi volt a kiindulás

A fejléc `Megjelenés` választója **csak UI** volt: a `light` / `dark` / `ambient` értékek címkék,
`onThemeChange` egy dokumentált no-op, a `theme.css` egyetlen (dark) token-készlet, a `color-scheme`
pedig beégetve `dark`. Négydik megjelenést tehát nem lehetett „beszúrni a három után”, mert maga a
mechanizmus hiányzott.

## Négy commit, négy subtask

| Commit | Ticket | Tartalom |
| ------ | ------ | -------- |
| `8f2485c` | AIS-165 | `ThemeName` + `THEME_NAMES` a `packages/ui`-ban; `theme.css` appearance-state tokenek (`--color-scheme`, `--app-backdrop`, `--blur-glass`, `--saturate-glass`) a plain `:root`-ban; `light` és `ambient` blokk; `apps/admin/src/app/theme/*` (const, tiszta logika, provider, hook); inline boot script az `index.html`-ben |
| `cf83150` | AIS-166 | `:root[data-theme="glass"]` token-készlet, `@utility surface-glass`, reduced-transparency / contrast fallback, a blur rákerült a lebegő rétegek receptjeire |
| `ef7d7ae` | AIS-167 | `'glass'` a unionban, `ThemeOption = ThemeName`, `Üveg` opció + `LayersIcon`, a választó **controlled** lett, `AdminLayout` köti be a providert, a `NOOP_THEME_CHANGE` törölve |
| (ez a commit) | AIS-168 | `theme-tokens` minőségkapu (`quality:themes`), spec/rules frissítés, history + milestone |

## Miért így

- **A tokenek adják a témát, nem a komponensek.** A `@theme` blokk marad a dark default, a témák
  `:root[data-theme="…"]` blokkok; a specificity (0,2,0 > 0,1,0) dönt, a sorrend nem számít. A 22
  recept és 107 token-utility ezért **változtatás nélkül** színeződik át, a dark kinézet bitre a régi.
- **`backdrop-filter` nem token.** Ezért a lebegő rétegek receptjei feltétel nélkül hordozzák a
  `surface-glass` osztályt (`SURFACE_GLASS_CLASS`), a tokenek döntik el, hogy van-e hatása (`0px` a
  nem-glass témákban). Kártya és táblázat **nem** kap blurt: soronkénti `backdrop-filter` a görgetés
  ismert frame-költsége.
- **A választó tiszta control maradt.** A `value` a providerből jön, a választás a porton megy ki; így
  a „nincs mellékhatás” teszt továbbra is igaz marad a komponensre, a bekötést (attribútum +
  perzisztencia) pedig egyetlen teszt ellenőrzi az `AdminLayout`-on. Ez tudatos eltérés a subtask
  eredeti szövegétől (ott a tesztek invertálása szerepelt): az invariáns erősebb így, mert a kontroll
  és a motor külön-külön bizonyított.
- **A négy téma csak kapuval marad négy.** A `quality:themes` a `@theme` token-neveit hasonlítja
  minden `:root[data-theme="…"]` blokkhoz (hiányzó / kitalált token, üres blokk, hiányzó default),
  a kommenteket előbb kimaszkolja (a fájl maga is idéz szelektorokat), és csak a top-level blokkokat
  nézi, így a `prefers-reduced-transparency` finomítás legális marad.

## Érintett fájlok

`packages/ui/src/theme/*` (új), `packages/ui/src/styles/theme.css`, `packages/ui/src/index.ts`,
`packages/ui/src/components/icon/icons.tsx`, kilenc lebegő-réteg recept (dialog, drawer, dropdown,
tooltip, toast, banner, log drawer, combobox), `packages/ui/test/surface-glass.test.tsx` (új),
`apps/admin/src/app/theme/*` (új), `apps/admin/src/app/providers/app-providers.tsx`,
`apps/admin/src/app/layout/{AdminLayout,AdminHeader,layout.const,theme-selector.interface}.ts(x)`,
`apps/admin/src/app/layout/ui/ThemeSelector.tsx`, `apps/admin/index.html`,
`apps/admin/src/test/mocks/{app-router,document-theme,theme-provider,theme-selector-harness,
web-storage}.mock.ts(x)`, `scripts/quality/theme-tokens.*` (új) + `fixtures/theme/`,
`package.json`, `docs/Specs/UI-Architecture.md`, `.roo/rules/react.coding-standards.md`.

## Hogyan ellenőrizhető

```bash
pnpm quality           # layers → dead-code → tokens → themes → field-errors → docs
pnpm quality:themes    # üres kimenet = mind a négy téma-blokk teljes
pnpm --filter @callback/admin test
pnpm --filter @callback/ui test
```

Manuálisan (`pnpm dev`, `/api-keys`): a fejléc választójában négy opció (Világos, Sötét, Ambient,
Üveg); az `Üveg` azonnal átszínezi az egész UI-t, reload után megmarad, betöltéskor nincs villanás;
dialog, drawer, menük, tooltip, toast, banner és log drawer áttetsző + blur, kártya és táblázat csak
áttetsző; `prefers-reduced-transparency: reduce` mellett a blur eltűnik.

## Ismert korlátok

- A `--shadow-neu-*` nevek témától függetlenül „neu”-k maradtak (AIS-164 D9) — átnevezés follow-up.
- Az `apps/web`-nek nincs témaválasztója: attribútum nélkül a `@theme` default él, vagyis a mai kinézet.
- Ezen a gépen a `pnpm test:quality` glob-ja nem fut le Node 20-on (a repo `engines`-e ≥24.9.0);
  a kapuk tesztjei fájlonként futtatva zöldek (`node --test scripts/quality/theme-tokens.*.test.mjs`).
