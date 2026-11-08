# Glassmorphism variánsok — négy üveg megjelenés (AIS-169)

**Dátum:** 2026-11-08 00:47 (Europe/Budapest)
**Ticket:** [AIS-169](https://zakzag.atlassian.net/browse/AIS-169) (előd: AIS-164)

## Mi volt a kérés

Az `Üveg` megjelenés az első körben óvatos kompromisszum lett. A felhasználó a referencia-képre
hivatkozva **üvegebb** felületeket kért: alig látható, erősen áttetsző panelek, **világos perem
csillanással**, lágy nagy sugarú árnyék, nagy kerekítés — és több választható variánst, hogy a fejléc
választójában lehessen kipróbálni és kiválasztani a kedvencet.

## Mi készült el

Négy üveg token-készlet ugyanazon a motoron, hét opció a választóban:

| Érték | Címke | Kitöltés (raised / overlay) | Blur / saturate | Perem |
| ----- | ----- | --------------------------- | --------------- | ----- |
| `glass` | Üveg | 10% / 14% fehér | 16px / 140% | 0.30 / 0.40 |
| `glass-frost` | Fagyott üveg | 20% / 24% fehér | 26px / 120% | 0.24 / 0.32 |
| `glass-crystal` | Kristályüveg | 5% / 7% fehér | 12px / 155% | 0.48 / 0.55 |
| `glass-smoke` | Füstüveg | 55% / 60% sötét | 20px / 130% | 0.22 / 0.30 |

## A recept, amit követtünk

A kutatás (Farvist „Glassmorphism in CSS" + a generátorok) négy kötelező elemet ad: áttetsző
kitöltés, `backdrop-filter`, világos perem, lágy árnyék. Ehhez jött a két részlet, amit a legtöbb
kézi megoldás kihagy:

1. **`inset 0 1px 0 rgba(255,255,255,…)` felső fényperem** — valódi üveg a felső peremen kapja a
   legtöbb fényt; enélkül a panel „áttetsző div" marad. Nálunk ez a `--shadow-neu-raised` slotban
   **bevel** lett: felső világos + alsó sötét inset + egy nagy, lágy vetett árnyék — ez adja a
   *vastagság* érzetét.
2. **`saturate()` a blur mellett** — a blur átlagoló filter, chromát veszít; 120–155% visszahozza.
   Enélkül lett „tejes műanyag" a korábbi próbálkozásokból.

Plus egy új állapot-token, `--glass-sheen`: átlós `linear-gradient`, amit a `surface-glass` utility
`background-image`-ként rak a felületre (nem `background-color`, így a `bg-surface-*` tokent nem
írja felül). Ez a csillanás, amit egy sima perem nem tud megcsinálni.

A blur szándékosan a 12–26px sávban marad (30px felett a háttér „köddé" válik), és továbbra is csak a
lebegő rétegeken fut — kártyán és táblázaton nem.

## Érintett fájlok

| Fájl | Változás |
| ---- | -------- |
| `packages/ui/src/styles/theme.css` | `--glass-sheen` állapot-token, `surface-glass` kiegészítése `background-image`-dzsel, `glass` újrahangolása + `glass-frost` / `glass-crystal` / `glass-smoke` blokkok, fallbackek mind a négyre |
| `packages/ui/src/theme/theme.interface.ts`, `theme.const.ts` | a union és a `THEME_NAMES` hét értékre bővült |
| `packages/ui/src/components/icon/icons.tsx`, `src/index.ts` | új `SnowflakeIcon`, `DropletIcon`, `CloudIcon` (Lucide, ISC) |
| `apps/admin/src/app/layout/layout.const.ts` | három új érték + címke + ikon, hét elemű opció-lista |
| `apps/admin/index.html` | a boot script értéklistája hét elemű |
| `apps/admin/src/app/layout/{theme-selector.logic,ui/ThemeSelector}.test.tsx`, `app/theme/theme.logic.test.ts`, `packages/ui/test/icon.test.tsx` | hét opció, hét név, három új ikon |
| `scripts/quality/theme-tokens.const.mjs` | `--glass-sheen` az engedélyezett állapot-tokenek között |

## Ellenőrzés

```bash
pnpm quality        # a quality:themes mind a hét blokkot összeveti a @theme készlettel
pnpm build          # a CSS 44.5 kB, mind a hét :root[data-theme=…] blokk benne van
```

Manuálisan: `pnpm dev` → `/api-keys` → fejléc `Megjelenés` → a négy üveg variáns végigkattintható,
a választás reload után megmarad; `prefers-reduced-transparency: reduce` mind a négyet opakká teszi.

## Következő lépés

A felhasználó kiválasztja, melyik variáns legyen a hivatalos `Üveg`; a másik három ezután
eltávolítható (a törlés egy token-blokk + három opció törlése, a kapu és a tesztek azonnal jelzik a
félig maradt állapotot).
