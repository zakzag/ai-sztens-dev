# Három-környezetes maradvány — `infra/.env` defaultok és a soft-fallback kisöprése

**Dátum:** 2026-10-19
**Trigger:** operator észrevette, hogy a `scripts/test/stack-up.sh` (és a smoke prelude) a mai napig `infra/.env`-et kér, ami a 2026-10-05-ös cutover óta nem létezik a lokális checkoutban; a per-env nevek (`infra/.env.local` / `.dev` / `.prod`) a helyesek, a droplet path (`infra/.env`) pedig továbbra is canonikus (lásd [`docs/Specs/Three-Env-Verification.md`](../Specs/Three-Env-Verification.md) §1d, §3.8).
**Terv:** [`2026-10-19--22-15-00-three-env-leftover-defaults-fix-plan.md`](../plans/2026-10-19--22-15-00-three-env-leftover-defaults-fix-plan.md)
**Hatás:** `scripts/test/`, `deploy/deploy.sh:upload()`, `scripts/test/README.md`

## Mit kellett megoldani

A 2026-10-05-ös tervben a `repo/infra/.env` és `repo/deploy/.env` plain-text fájlok `infra/.env.{local,dev,prod}` / `deploy/.env.{dev,prod}` per-env nevekre cserélődtek. A cutover két helyen hibásan implementálódott:

1. A `scripts/test/{stack-up.sh, stack-down.sh, lib/00-prelude.sh}` a mai napig a legacy `infra/.env`-et tekinti defaultnak. Egy lokális checkoutban ez a fájl sosem létezik (`gitignore:42-60`); `pnpm test:stack:up` emiatt `Missing env file: …/infra/.env` üzenettel áll le, és a `Missing env file` szövege a cutover előtti `Copy infra/.env.example to infra/.env first` sort írja — ez félrevezeti az új operátort.
2. A `deploy/deploy.sh:upload()` `local_infra_env` lookupjában a per-env `infra/.env.${APP_ENV}` megléte *opcionális* fallbackkel puhán ráfut a legacy `infra/.env`-re. A `deploy/.env` esetében ezt a puhaságot a 2026-10-06-os deploy-env-selection PR már kivégezte (`deploy.sh:255-265`: hibás, kilép, migration hint). Az `infra/.env` ága ezt a logikát soha nem kapta meg — egy pre-cutover laptopon maradt `infra/.env` csendben a prod dropletre kerülhet.

## Változások

| Fájl | Változás |
|---|---|
| [`scripts/test/stack-up.sh`](../../scripts/test/stack-up.sh) | Default `infra/.env.local`; `Missing env file` üzenet a `pnpm dev-stack.sh up` / `cp infra/.env.example infra/.env.local` receptet adja; ENV_FILE / `--env-file` override felülír |
| [`scripts/test/stack-down.sh`](../../scripts/test/stack-down.sh) | Default `infra/.env.local`; ENV_FILE override felülír; a hiányzó fájl itt nem hiba (a stack már leállhatott) |
| [`scripts/test/lib/00-prelude.sh`](../../scripts/test/lib/00-prelude.sh) | Default `ENV_FILE=infra/.env.local`; ENV_FILE export megmarad (env-var felülírja) így a check-ek a tényleges fájlnevet naplózzák |
| [`scripts/test/README.md`](../../scripts/test/README.md) | Quick-start (`cp infra/.env.example infra/.env.local` + `--env-file infra/.env.dev` példa) és a `--env-file` flag leírása per-env-re frissítve |
| [`deploy/deploy.sh`](../../deploy/deploy.sh) | `upload()` legacy-`infra/.env` fallback → abort + migration hint (a [`deploy.sh:255-265`](../../deploy/deploy.sh:255) `deploy/.env` minta szerint); per-env `infra/.env.${APP_ENV}` elsőbbsége megmarad |
| [`scripts/test/_stack-env-default-test.sh`](../../scripts/test/_stack-env-default-test.sh) | Új offline regression: 12 statikus check (a négy default + a régi hint + a deploy.sh soft-fallback) + 6 sandbox run (`deploy.sh upload dev` ssh/scp/rsync/pnpm stubbal, `infra/.env.dev` nélkül csak legacy `infra/.env` jelenlétével) |
| [`scripts/test/README.md`](../../scripts/test/README.md) § Layout szakasz + a „Postgres init-script suite" leírás szintén frissítve | Az új `_stack-env-default-test.sh` suite említése |

## Döntések

- **Default = `infra/.env.local`** (developer-machine default), mert a teljes dev stackhez az operátor explicit `--env-file` flaget ad a Three-Env-Verification §2.2.1 alapján (`pnpm test:stack:up --env-file infra/.env.dev`); a default a leggyakoribb esetre (csak postgres + api + monitor) van szabva, és megegyezik `scripts/dev-stack.sh:43` stratégiájával.
- **`stack-up.sh` hint a `pnpm dev-stack.sh up` receptet adja** (seedeli a fájlt az `infra/.env.example`-ból), mert az operátor első lépése általában ez; a `cp` + edit manuális alternatíva is ott van.
- **`deploy.sh:upload()` legacy reject a `deploy.sh:255-265` mintát követi** ugyanazzal a szerkezettel (log_error + migration hint + `Aborted before any file was shipped to the droplet`). A migration hint a `mv infra/.env infra/.env.${APP_ENV}` + `git check-ignore -v` auditlépést is megadja, mert a fájl a `.gitignore` miatt nem kerülhet a repoba.
- **Regression test sandboxot használ** (ssh/scp/rsync/pnpm stubok), nem kell hálózat / droplet; a deploy-env-selection és remote-compose-path meglévő mintáját követi.

## Bizonyíték / verifikáció

```
bash scripts/test/_stack-env-default-test.sh
# Pass: 18   Fail: 0

bash scripts/test/_deploy-sh-env-selection-test.sh  # 29/0 (változatlan)
bash scripts/test/_deploy-sh-m1-test.sh             # ALL_OK (változatlan)
bash scripts/test/_deploy-sh-logger-test.sh         # 10/0 (változatlan)
bash scripts/test/_deploy-sh-remote-compose-path-test.sh  # 43/9 (azonos a main baseline-nal)
```

A `_deploy-sh-remote-compose-path-test.sh` 9 failure-ja **pre-existing** (a `verify_up_result` a sandboxban `docker compose`-ot hív, amit a stub-készlet nem takar); `git stash -u` + futtatás + `git stash pop` igazolta, hogy a baseline `main`-on is 9/9 failure. A `_deploy-sh-m3-test.sh` pre-existing stale (Three-Env-Verification §7 dokumentálja).

A sandbox reproducer (B. szakasz a `_stack-env-default-test.sh`-ben) a `deploy.sh upload dev` teljes flow-ját lefuttatja `infra/.env.dev` nélkül, csak legacy `infra/.env` jelenlétében, és az `infra/.env.dev` keresésénél a migration hinttel kilép — ugyanaz a hiba, amit egy pre-cutover laptop operátora kapna, mostantól.

## Tanulság

A `git stash -u` → tesztfuttatás → `git stash pop` munkafolyamatot **külön shell-ablakban** kell végezni, mert a Windows `cmd.exe` néha nem kezeli jól az idézőjeleket / `&&`-t tartalmazó parancsokat; a stash elvesztésének kockázatát a `git stash list` + `git reflog` azonnali ellenőrzésével csökkentettük. A baseline-összehasonlítás (`git stash -u` után futtatás) megerősítette, hogy a regression suite-ok eredménye nem a mi szerkesztésünktől függ.

## Kapcsolódó

- [`docs/plans/2026-10-19--22-15-00-three-env-leftover-defaults-fix-plan.md`](../plans/2026-10-19--22-15-00-three-env-leftover-defaults-fix-plan.md) — a terv
- [`docs/Specs/Three-Env-Verification.md`](../Specs/Three-Env-Verification.md) — a §1d / §3.8 droplet-path megerősítése
- [`scripts/dev-stack.sh:43`](../../scripts/dev-stack.sh:43) — a referencia-implementáció, amit a per-env local default követ
- [`scripts/test/_deploy-sh-env-selection-test.sh`](../../scripts/test/_deploy-sh-env-selection-test.sh) — a 2026-10-06-os `deploy/.env` hard-reject regression, amelynek mintáját követtük
