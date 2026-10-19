# Plan — the new dedicated SSH key for all deploys (local as `root`, CI as `deployer`)

**Date:** 2026-10-07
**Status:** approved (operator decision amended the first draft)
**Scope:** make [`deploy/ssh-keys/root.private.key`](../../deploy/ssh-keys/root.private.key) the single deploy key — used locally by [`deploy/deploy.sh`](../../deploy/deploy.sh:1) as `root@ssh.aisztens.hu`, and by GitHub Actions as `deployer@ssh.aisztens.hu`.
**Out of scope:** [`deploy/authorized_keys`](../../deploy/) (a stray file, deleted by the requester).

> **Decision (amended).** The first draft proposed switching the CI to `root`. The requester chose to **keep the CI on the `deployer` user** and authorise the new key for `deployer` instead — the least-privilege path is preserved. The local deploy keeps `SSH_USER=root`.

---

## 1. Goal

One key file, two login users:

| Path | User | Key | Change needed |
|---|---|---|---|
| Local `./deploy/deploy.sh up [dev]` | `root` | `deploy/ssh-keys/root.private.key` | none (already wired) — comment tidy only |
| GitHub Actions deploy | `deployer` | the **same** key via the `DROPLET_SSH_KEY` secret | no workflow logic change; new secret **value** + the key authorised for `deployer` |

---

## 2. Verified current state

| Fact | Evidence |
|---|---|
| New key is **passphrase-less** (no CI passphrase secret needed) | OpenSSH header `cipher=none`, `kdf=none`; comment `aisztens.hu-root-no-passphrase` |
| Dedicated key (not one of the four committed `.pub` files) | public half `ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAINI4k0yp3DLE2O6vwgsGcA4J0OXBDQ2NvPJPPOtsGGf3` |
| Key stays out of git | `.gitignore:78` `*.private.key` |
| Local config already uses it as root | [`deploy/.env.dev`](../../deploy/.env.dev:12) `SSH_USER=root`, `SSH_KEY=./deploy/ssh-keys/root.private.key` |
| CI user/key references (7 steps) | [`deploy.yml`](../../.github/workflows/deploy.yml:128) — `username: deployer` + `key: ${{ secrets.DROPLET_SSH_KEY }}`; **these stay unchanged** |
| CI header still describes the old key | [`deploy.yml`](../../.github/workflows/deploy.yml:28) lines 28–29 ("matches `deployer.pub`") |
| Secrets table still describes the old key | [`deploy/README.md`](../../deploy/README.md:168) §8.1 `DROPLET_SSH_KEY` row |
| `.env` comments still suggest switching to `deployer` | [`deploy/.env.example`](../../deploy/.env.example:27) lines 27–28, `deploy/.env.dev` lines 9–10 |
| `docs/Specs/*` `deployer@aisztens.hu` examples | **remain correct** — no change needed |
| Baseline | `6463284`; working tree clean except `.idea/workspace.xml` |

---

## 3. Changes

| # | File | Change |
|---|---|---|
| 1 | [`.github/workflows/deploy.yml`](../../.github/workflows/deploy.yml:28) | **Comments only** (no logic): the secrets block describes `DROPLET_SSH_KEY` as the passphrase-less deploy key whose public half is installed in `deployer`'s `authorized_keys`. `username: deployer` in all 7 steps stays. |
| 2 | [`deploy/README.md`](../../deploy/README.md:165) | §8.1 secrets table: `DROPLET_SSH_KEY` = the deploy key (`deploy/ssh-keys/root.private.key`), passphrase-less, public half in `/home/deployer/.ssh/authorized_keys`. §1 (line 73–77): mention the key file next to the `SSH_KEY` guidance. |
| 3 | [`deploy/ssh-keys/README.md`](../../deploy/ssh-keys/README.md:1) | Note that `root.private.key` is the **deploy key** (gitignored): used locally as `root`, in CI as `deployer`. |
| 4 | [`deploy/.env.example`](../../deploy/.env.example:27) / `deploy/.env.dev` | Comment tidy: the local deploy uses `root` with the pinned key (drop the "switch to `deployer`" hint); example `SSH_KEY` = `./deploy/ssh-keys/root.private.key`. |
| 5 | docs/history + docs/milestones | New history entry + milestone recording the key switch. |

No change to [`deploy/deploy.sh`](../../deploy/deploy.sh:1) (it already resolves `SSH_USER`/`SSH_KEY` from the selected env file) and none to the workflow's SSH logic.

---

## 4. Operator steps (manual)

**4a. Authorise the new key for `deployer` on the droplet** (run with the existing root access):

```bash
KEY='ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAINI4k0yp3DLE2O6vwgsGcA4J0OXBDQ2NvPJPPOtsGGf3 aisztens.hu-root-no-passphrase'
ssh -i deploy/ssh-keys/root.private.key -o IdentitiesOnly=yes root@ssh.aisztens.hu "
  install -d -m 700 -o deployer -g deployer /home/deployer/.ssh
  grep -qxF '$KEY' /home/deployer/.ssh/authorized_keys 2>/dev/null || echo '$KEY' >> /home/deployer/.ssh/authorized_keys
  chmod 600 /home/deployer/.ssh/authorized_keys; chown deployer:deployer /home/deployer/.ssh/authorized_keys
"
```

**4b. GitHub secret** — Settings → Secrets and variables → Actions → **`DROPLET_SSH_KEY`**: paste the contents of `deploy/ssh-keys/root.private.key`. `DROPLET_HOST` / `INFRA_ENV_*` unchanged.

---

## 5. Security trade-offs (acknowledged)

- `deployer` is sudo- + docker-group capable, so key-based CI access to `deployer` is effectively privileged; that is the pre-existing design (the key is now passphrase-less and stored as a repo secret).
- The key is also used for `root` logins locally, so **one** key grants both. Rotating it invalidates both paths.
- Optional hardening (deferred): restrict the entry in `deployer`'s `authorized_keys` with `from=` / `restrict` / `command=`.

---

## 6. Verification

```bash
# The same key must log in as deployer (CI path) and as root (local path)
ssh -i deploy/ssh-keys/root.private.key -o IdentitiesOnly=yes deployer@ssh.aisztens.hu 'id -un'
ssh -i deploy/ssh-keys/root.private.key -o IdentitiesOnly=yes root@ssh.aisztens.hu 'id -un'

# Local deploy goes through the pinned key, no passphrase prompt
bash deploy/deploy.sh ps dev
```

CI: **Actions → Deploy to droplet → Run workflow (app_env=dev)** must pass all 7 SSH/SCP steps (still as `deployer`).

---

## 7. Flow

```mermaid
flowchart LR
    K[deploy/ssh-keys/root.private.key] --> L[deploy/.env.dev SSH_USER=root]
    K --> S[GitHub secret DROPLET_SSH_KEY]
    S --> A[deployer authorized_keys on droplet]
    L --> D1[deploy.sh local deploy]
    A --> D2[deploy.yml 7 steps username=deployer]
    D1 --> R[root@ssh.aisztens.hu]
    D2 --> U[deployer@ssh.aisztens.hu]
```
