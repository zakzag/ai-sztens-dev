# `pnpm build` javítás — esbuild temp-fájl és a kettős lockfile

**Dátum:** 2026-11-05 01:39 (Europe/Budapest) · Kapcsolódó: AIS-85 utómunka (build breakdown)

## Tünetek

1. `pnpm build` (illetve `pnpm --filter @callback/admin build`) a **transpile fázis után** halt meg:

   ```text
   ✓ 483 modules transformed.
   error during build:
   [vite:esbuild-transpile] remove C:\Users\zakza\AppData\Local\Temp\esbuild-<hash>: Access is denied.
   ```

   Ugyanaz a build `apps/web`-nél átment → nem kódhiba, hanem a profil `%TEMP%` könyvtárában
   lévő fájl törlését valami (scanner/handle) blokkolja.

2. Közben a teljes workspace build elhasalt `packages/ui`-nál is:

   ```text
   Error: Cannot find module '…\packages\ui\node_modules\typescript\bin\tsc'
   packages/ui build: src/components/dialog/OverlayShell.tsx(1,34): error TS2307: Cannot find module '@radix-ui/react-dialog'
   ```

   Ok: a `node_modules/.pnpm` virtuális store **részben kiürült** (943 → 36 bejegyzés).

3. `pnpm install --frozen-lockfile` erre:

   ```text
   ERR_PNPM_BROKEN_LOCKFILE: The lockfile at "pnpm-lock.yaml" is broken:
   expected a single document in the stream, but found more
   ```

## Kiváltó okok

| # | Ok | Bizonyíték |
| - | -- | ---------- |
| A | A `pnpm-lock.yaml`-ba egy **pnpm 12** folyamat egy második YAML dokumentumot írt (`packageManagerDependencies` + `@pnpm/exe.*`), miközben a repó `packageManager` mezője `pnpm@12.16.1`, a gép pedig **pnpm 9.15.4**-et futtat Node 20-on | `lockfileVersion` kétszer szerepel a fájlban; `pnpm config list` → `pnpm/9.15.4`; a CI `pnpm/action-setup@v4 version: 10` + Node 24 |
| B | A félbeszakadt install **félkész store**-t hagyott, ezért a következő build modulokat nem talált | `.pnpm` bejegyzések száma 36 / 451 / 884 / 943 között ingadozott |
| C | `esbuild` a `os.tmpdir()`-t **induláskor** olvassa, a `vite.config.ts` viszont már esbuilddel transzformálódik → a config nem tudja átállítani | a hiba a config betöltése *után*, a modul-transpile alatt jött |

## Megoldás

| Fájl | Változás |
| ---- | -------- |
| [`scripts/lib/vite-build.logic.mjs`](../../scripts/lib/vite-build.logic.mjs:1) | tiszta helperek: `toBuildEnv(baseEnv, tempDir)` (TEMP/TMP/TMPDIR átírása, minden más megtartása), `toViteBinPath(appDir)` |
| [`scripts/lib/vite-build.mjs`](../../scripts/lib/vite-build.mjs:1) | CLI wrapper: létrehozza a `<repo>/.tmp/esbuild` mappát, majd a **helyi** `vite`-et indítja `stdio: inherit`-tel, az exit kódot/szignált továbbadva |
| [`scripts/lib/vite-build.logic.test.mjs`](../../scripts/lib/vite-build.logic.test.mjs:1) | 6 teszt (temp-változók, hiányzó változók, megőrzött env, nincs mutáció, bin path); a `pnpm test:quality` futtatja |
| [`apps/admin/package.json`](../../apps/admin/package.json:6), [`apps/web/package.json`](../../apps/web/package.json:6) | `dev*`, `build*`, `preview` → `node ../../scripts/lib/vite-build.mjs …` |
| [`.gitignore`](../../.gitignore:1) | `.tmp/` kizárva |
| [`.npmrc`](../../.npmrc:1) | `manage-package-manager-versions=false` — a futó pnpm ne töltsön le és ne írjon a lockfile-ba saját verziót |
| [`package.json`](../../package.json:17) | `test:quality` futtatja az új logic-tesztet is |
| [`scripts/README.md`](../../scripts/README.md:104) | wrapper dokumentáció + **Troubleshooting** (kettős lockfile, pnpm 9 `overrides`-hiány, Node 20 `--test` glob) |
| milestone (AIS-85) | a „TEMP workaround” megjegyzés a valódi, repón belüli javításra mutat |

Helyreállítás (amit a felhasználónak kell futtatnia, ha a kettős lockfile visszatér):

```bash
git checkout -- pnpm-lock.yaml
pnpm install --frozen-lockfile
pnpm build
```

## Verifikáció

```text
pnpm build            → 7/7 projekt zöld (shared, ui, api-client, notifications, apps/web, apps/api, apps/admin)
pnpm --filter @callback/admin test → 388 teszt zöld
pnpm --filter @callback/ui test    → 337 teszt zöld
node --test scripts/lib/vite-build.logic.test.mjs → 6 teszt zöld
```

Ismert, **nem ebből a változásból eredő** eltérések a helyi gépen (Node 20 + pnpm 9 vs. CI Node 24 + pnpm 10):

- `apps/api` egyetlen `create-fastify-adapter` tesztje piros, mert a pnpm 9 **nem olvassa** a
  `pnpm-workspace.yaml` `overrides`-át, így `light-my-request` 6.8.0-ra oldódik a pinelt 6.6.0 helyett
  (a `cookie`/ESM hiba, amiért a pin létezik). CI-n (pnpm 10) zöld.
- `pnpm test:quality` a `node --test` **glob** szintaxisa miatt áll meg Node 20-on (Node 22+ kell).

## Tanulság

Ha két különböző pnpm-major írja ugyanazt a lockfile-t, a tünet nem „lockfile-hiba”, hanem
félkész `node_modules` és érthetetlen `TS2307`-fal. A build-hotfix ezért nem ott javít, ahol a hiba
látszik: a Vite-et indító wrapper determinisztikussá teszi a temp-könyvtárat, a `.npmrc` és a
`scripts/README.md` troubleshooting szakasza pedig a lockfile-driftet teszi diagnosztizálhatóvá.
