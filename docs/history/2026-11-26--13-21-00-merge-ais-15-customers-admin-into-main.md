# Az `AIS-15-customers-admin` ág egyesítése a `main` ágba (PR nélkül)

**Dátum:** 2026-11-26 13:21 (Europe/Budapest)
**Forrás ág:** `AIS-15-customers-admin` (`7943efc`)
**Cél ág:** `main` (előtte: `ebab234`)
**Eredmény:** fast-forward egyesítés, majd közvetlen push a `origin/main`-re — PR és merge commit nélkül

## Kontextus

A kérés az volt, hogy az aktuális munkaág tartalma kerüljön be a `main` ágba
**pull request nyitása nélkül**, tehát a helyi gépről, közvetlen push-sal.

## Kiinduló állapot és ellenőrzések

Az egyesítés előtt ellenőrzött tények:

| Ellenőrzés | Parancs | Eredmény |
| ---------- | ------- | -------- |
| Aktuális ág | `git branch --show-current` | `AIS-15-customers-admin` |
| Eltérés a `main`-hez képest | `git rev-list --left-right --count main...HEAD` | `0	17` — a `main` teljes egészében benne van az ágban |
| Remote szinkron | `git fetch origin --prune`, majd `git log -1 main` | `main` = `origin/main` = `ebab234` |
| Nem követett fájlok | `git status --short` | 4 dokumentum (AIS-70) + 1 üres, balesetből keletkezett fájl |

A `0	17` arány azt jelentette, hogy **nincs divergencia**: az egyesítés
fast-forward, tehát nem keletkezik merge commit és nincs konfliktusfeloldás.

## Végrehajtás

1. `git checkout main` — a `main` követi az `origin/main`-t (`ebab234`), a nem
   követett fájlok érintetlenül átkerültek a munkakönyvtárba.
2. `git merge --ff-only AIS-15-customers-admin` — szándékosan `--ff-only`
   kapcsolóval, hogy ha bármilyen divergencia lenne, a parancs **megálljon**
   a történet újraírása helyett. Eredmény: `Updating ebab234..7943efc`,
   `Fast-forward`, 192 fájl frissült.
3. `git push origin main` — `ebab234..7943efc  main -> main`.

## Mit tartalmaz az egyesített történet

A 17 commit a customers admin felület teljes vertikális szelete, többek között:

| Jegy | Tartalom |
| ---- | -------- |
| AIS-19 | customers lista oldal és wizard shell, `use-list-params` hook |
| AIS-20 | ügyfél részletező oldal, activity/audit mapper-ek |
| AIS-21 | ügyfél szerkesztő oldal és fejléc-műveletek |
| AIS-179 | contacts és users fülek, meghívó/visszavonó dialógusok |
| AIS-181 | activity és audit fülek, URL paraméter megőrzés |
| AIS-182 | wizard lépések és submit, munkaterületi konkurencia-korlát |

Emellett bekerült több `docs/history/`, `docs/milestones/` és `docs/plans/`
bejegyzés, valamint az `infra/docker-compose.tools.yml`.

## Szándékosan kihagyott fájlok

A munkakönyvtárban **nem követett** (untracked) fájlok maradtak, ezek nem
kerültek be az egyesítésbe, mert nem részei egyik commitnak sem:

- `docs/Specs/Authentication-Model.md`, a hozzá tartozó két `docs/history/`
  bejegyzés és a négy szereplős hitelesítési milestone (AIS-70) — ezek
  commitolása külön döntést igényel, nem a jelen egyesítés feladata;
- `m[1])))` — **0 bájtos**, hibás shell-átirányításból keletkezett
  szemétfájl, semmiképp nem kerülhet verziókövetés alá.

## Hogyan ellenőrizhető

```powershell
git log --oneline -1 main                     # 7943efc
git log --oneline -1 origin/main              # 7943efc
git status --short --branch                   # ## main...origin/main  (nincs ahead/behind)
git rev-list --left-right --count main...AIS-15-customers-admin   # 0	0
```

## Következmények

- A `main` mostantól tartalmazza az `AIS-15-customers-admin` ág teljes
  tartalmát; az ág a továbbiakban beolvasztható vagy törölhető.
- Nem keletkezett merge commit, így a történet lineáris maradt, és a
  jegy–commit kapcsolat a commit üzenetekben változatlanul megmaradt.
- A helyi `main` és az `origin/main` megegyezik, tehát nincs függő push.
