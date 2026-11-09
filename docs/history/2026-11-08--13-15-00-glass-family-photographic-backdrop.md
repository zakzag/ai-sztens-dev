# Glass család — fotó háttér

**Dátum:** 2026-11-08 13:15
**Érintett terület:** `packages/ui/src/styles/theme.css`, `packages/ui/src/styles/assets/`,
`docs/Specs/UI-Architecture.md`

## Kérés

Ha a kiválasztott megjelenés `glass` típusú, a body háttere egy megadott kép legyen
(`background-glass-…jpg` a generátor kimenetéből), és a kép olyan helyre kerüljön, ami
benne van a buildben.

## Megvalósítás

| Fájl                                                   | Változás                                                                                                                                                                                                                                                                                                                                   |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `packages/ui/src/styles/assets/app-backdrop-glass.jpg` | új asset: a generált 3840×2160-as kép átmásolva a token-fájl mellé (Vite a CSS-ből hivatkozott assetet kiszolgálja a buildben)                                                                                                                                                                                                             |
| `packages/ui/src/styles/theme.css`                     | a négy glass variáns `--app-backdrop`-je: scrim (`linear-gradient`) + `url('./assets/app-backdrop-glass.jpg')` + a korábbi gradiens-lista fallbackként; a `body` megkapja a `background-size: cover`, `background-position: center`, `background-repeat: no-repeat` hármast; a glass család fejkommentje kiegészítve a döntés indoklásával |
| `docs/Specs/UI-Architecture.md`                        | §3.2.2 token-táblázat `--app-backdrop` sora + új bekezdés a fotó-háttér három következményével; fejléc dátuma/szövege                                                                                                                                                                                                                      |

## Miért kellett scrim

A kép nagyon világos pasztell (szinte fehér sarkokkal), a glass panelek pedig csak
3–13 % fehér kitöltést adnak. A szöveg így valójában fotó + scrim + vékony kitöltés
kompozitján ül: scrim nélkül a csaknem fehér szöveg-tokenek a legvilágosabb foltokon
~1.5:1 kontrasztra estek volna. Ezért minden variáns a saját bázis-árnyalatú,
fent sötétebb scrimet kap, alfája a kitöltés vastagságával fordítottan arányos
(`glass-crystal` 0.78, `glass-smoke` 0.54).

## Ellenőrzés

- `pnpm --filter @callback/admin build` → `dist/assets/app-backdrop-glass-*.jpg` létrejön,
  a CSS-ben 4 helyen (a négy glass blokkban) hivatkozott URL-lel.
- `pnpm --filter @callback/web build` → szintén emitálja az assetet; a web app soha nem
  alkalmaz glass témát, ezért a fájl ott nem töltődik le (elfogadott méret-költség).
- `pnpm quality:tokens`, `pnpm quality:themes`, `pnpm quality:docs` → 0 violation.
- Kézi: admin → fejléc téma-választó → `glass` / `glass-frost` / `glass-crystal` / `glass-smoke`,
  a body hátterében a fotó látszik, a lebegő panelek blurje a fotó struktúráját töri.

## Ismert következmény

A kép ~1.7 MB és 4K; nincs még reszponzív méretváltozat (`image-set()`), így mobilon is
a teljes fájl töltődik le. Ha ez gondot okoz, a következő lépés egy 1280/1920 széles
változat és `image-set()` a tokenben.
