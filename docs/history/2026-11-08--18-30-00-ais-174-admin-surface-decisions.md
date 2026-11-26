# AIS-174 — Admin surface-döntések: a doksi követi a kódot, a kód a doksit

**Dátum:** 2026-11-08 18:30 · **Ticket:** AIS-174 (parent: AIS-170) · **Plan:**
[`docs/plans/2026-11-08--18-10-00-ais-174-admin-surface-decisions-plan.md`](../plans/2026-11-08--18-10-00-ais-174-admin-surface-decisions-plan.md)
· **Milestone:**
[`docs/milestones/2026-11-08--18-30-00-admin-surface-decisions.milestone.md`](../milestones/2026-11-08--18-30-00-admin-surface-decisions.milestone.md)

## Miért

Az AIS-171/172/173 után a kód egységes lett, de három helyen a doksi és a kód ellentmondott, és két oldal
teszt nélkül maradt. Ez a változás **nem termel funkciót**: a kód által már eldöntött kérdéseket rögzíti,
hogy a következő fejlesztő ne a rossz mintát másolja.

## Mi változott

| Fájl                                                                                    | Változás                                                                                                                                                                                                                                                                                        |
| --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`LoginPage.tsx`](../../apps/admin/src/pages/LoginPage.tsx:1)                           | A copy exportált konstansokká vált a **page modulon belül**, és a lap végre visszajelzést ad: üres/whitespace jelszó esetén `LOGIN_EMPTY_PASSWORD_MESSAGE` az `Input` `error` propján (`aria-invalid` + `aria-describedby`), gépelésre törlődik. Korábban ez a beküldés **csendes no-op** volt. |
| [`PlaceholderPage.tsx`](../../apps/admin/src/pages/PlaceholderPage.tsx:1)               | A cím és az alcím a JSX-ből exportált konstansokba került (`PLACEHOLDER_PAGE_TITLE`, `PLACEHOLDER_PAGE_SUBTITLE`), így a teszt ugyanazt a stringet assertálja, amit a lap renderel.                                                                                                             |
| `LoginPage.test.tsx` (**új**)                                                           | 5 eset: render; sikeres beküldés → token a `sessionStorage`-ban (`installRecordingStorages()` double, `SESSION_TOKEN_KEY`, `/^placeholder-token-\d+$/`); üres jelszó → üzenet + `aria-invalid` + **nincs** írás; whitespace-only ugyanaz; gépelésre eltűnik az üzenet.                          |
| `PlaceholderPage.test.tsx` (**új**)                                                     | 3 eset: egyetlen `h1` a `PageShell`-ből; alcím; `data-testid="build-info"` a shellen **belül** (a `children` elvesztése a regresszió, amit a teszt fog).                                                                                                                                        |
| [`New-Admin-Page.md`](../../docs/Specs/New-Admin-Page.md:1)                             | Fejléc AIS-174 blokk; új „standard lista" bekezdés (step 11) és a teljes **route-path forrás** szabály (step 12); §3-ban **documented exceptions** tábla (login, landing, catch-all, `/calls`) + a flat kivétel-fájl szabálya; a 12b sor `history.back()` anti-pattern sora változatlan.        |
| [`UI-Architecture.md`](../../docs/Specs/UI-Architecture.md:1)                           | Fejléc-lánc AIS-174-gyel; §4.0 új „The list header action is a link, not a button" blokk (navigálható → link, nem navigálható → gomb); §4.2 a **label** és a **path** szabályát szétválasztja és a checklistre mutat; §5 „standard list + dokumentált hiányok" bekezdés.                        |
| [AIS-155 plan](../plans/2026-11-07--14-46-00-ais-155-entity-dialog-standard-plan.md:1)  | **Utólagos jegyzet** a fájl végén — a terv szövege érintetlen: `D9` (Button → Link), `D8` (a legacy detail oldal már nincs) és a routes-tábla `/api-keys/:identifier` sora pontosítva.                                                                                                          |
| [AIS-174 plan](../plans/2026-11-08--18-10-00-ais-174-admin-surface-decisions-plan.md:1) | Az 5a/5b lépés implementáció közben javítva (lásd a drift 3. pontját); a terv a változás része, ezért nem történeti rekord.                                                                                                                                                                     |

## Drift a tickethez és a tervhez képest

1. **C8 „EmptyState akcióval" — a kód nem ezt teszi.** [`ApiKeysTable.tsx`](../../apps/admin/src/pages/api-keys/ui/ApiKeysTable.tsx:106)
   copy-only `EmptyState`-et renderel, noha az `EmptyStateProps.action` létezik. A döntés: a standard lista
   **szándékosan** akció nélküli (egy CTA van, a fejléc-akció), és ez dokumentált hiány, nem hiba. Az
   audit-terv „üres állapot akció **van**" sora pontatlan volt.
2. **A `LoginPage`-nek nem volt hibapályája.** A kért „hibás hitelesítés → hibaüzenet" teszteset
   implementáció nélkül nem létezhetett, ezért a lap kapott egyetlen, őszinte hibát (üres jelszó). Ez a
   minimális kód-hozzáadás a docs-ticketben; a valódi `POST /api/auth/login` továbbra is nyitott.
3. **A terv `*.const.ts` fájljai nem jöhettek létre.** A layer gate `no-flat-page-to-page` szabálya
   ([`.dependency-cruiser.rules.cjs`](../../.dependency-cruiser.rules.cjs:154)) tiltja, hogy egy flat page
   bármit importáljon `src/pages/` alól — és a sibling const maga is flat page-nek számít. A copy ezért a
   page modulban él, **exportált** konstansként, és a teszt onnan importálja. A gate-hez nem nyúltunk.
4. **Nem csak `D9` avult el.** Az AIS-155 `D8` („a régi detail oldal megmarad, a törlés oda navigál") is
   ellentmond a kódnak az AIS-173 óta; a jegyzet mindkettőt lefedi.
5. **A DoD grep nem lehet nulla.** `ApiKeyDetailPage` / `ApiKeyDetailCard` **történeti** mondatokban marad:
   a [`New-Admin-Page.md`](../../docs/Specs/New-Admin-Page.md:1) AIS-173 fejléc-blokkja, valamint a
   [`UI-Architecture.md`](../../docs/Specs/UI-Architecture.md:1) fejléc-lánca, az AIS-131 blokk és az
   AIS-173 blokk (összesen 6 találat, link nélkül). Egyik sem élő hivatkozás, a D-A elv csak a kód által
   **cáfolt** mondatot tiltja — ezek múlt időben írnak a törlésről.
6. **`UI-Architecture.md` második `Utolsó frissítés` fejléce maradt.** Az AIS-172-es, 2160 karakteres
   egybefüggő blokk a fejléc-lánc alatt; ekkora egyetlen soron a biztonságos edit-felület nem áll
   rendelkezésre, a dátum viszont ugyanaz (2026-11-08), így R3 zöld. Follow-up: a blokk
   `**AIS-172 (2026-11-08):**` alakra bontása.
7. **`rg` nincs telepítve** ezen a gépen; a ticket manuális ellenőrzései `Select-String`-pel futottak.

## Ellenőrzés

- `pnpm quality` (layers → knip → tokens → themes → field-errors → docs) → **zöld**, 0 violation.
- `pnpm test` (shared 335, api-client 222, notifications, ui, admin 547, api 433 teszt) → **zöld**.
- `pnpm --filter @callback/admin test` → **48 fájl, 547 teszt zöld** (előtte 46 / 539: +2 fájl, +8 teszt).
- `pnpm typecheck`, `pnpm -r lint`, `pnpm -r build`, `prettier --check` → zöld.
- `pnpm test:quality` → a Node 20.19.2 `node --test` a `"scripts/quality/*.test.mjs"` globot nem oldja fel
  (a repo Node ≥ 24.9-et vár), ezért kézzel kiterjesztett fájllistával futtatva **87 teszt zöld**. Ez
  környezeti korlát, nem a változás következménye.
- `Get-ChildItem -Recurse docs\Specs -Include *.md | Select-String 'ApiKeyDetailPage'` → 4 találat, mind
  a fenti 5. pontban felsorolt történeti mondat.
- `Select-String '§12' docs\Specs` → csak érvényes hivatkozások (`API-Convention.md:399`, `:442`, illetve a
  pointer-sorok), elavult szekcióhivatkozás nincs.
- Manuális próba: `/login` + üres submit → magyar hibaüzenet, token nem íródik; jelszó megadásával →
  átirányítás a védett felületre, a token a tab `sessionStorage`-jában.
