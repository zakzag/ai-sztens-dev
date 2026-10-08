# Milestone — one passphrase-less deploy key for local (`root`) and CI (`deployer`)

**Date:** 2026-10-07
**History:** [`../history/2026-10-07--15-35-00-deploy-key-root-and-deployer.md`](../history/2026-10-07--15-35-00-deploy-key-root-and-deployer.md)
**Plan:** [`../history/2026-10-07-deploy-root-ssh-key-plan.md`](../history/2026-10-07-deploy-root-ssh-key-plan.md)

## 1. Problem / feature

The deploy key was replaced with a new, dedicated, passphrase-less ed25519 key
(`deploy/ssh-keys/root.private.key`, comment `aisztens.hu-root-no-passphrase`). Both deploy paths had
to use it: the local `deploy/deploy.sh` (as `root@ssh.aisztens.hu`) and GitHub Actions (which
authenticates as `deployer`). Decision on review: **keep the CI on `deployer`** rather than switching
it to `root`, and authorise the new key for `deployer` instead.

## 2. Measured data / evidence

| Observation | Result |
|---|---|
| `deploy/.env.dev` | already `SSH_USER=root` + `SSH_KEY=./deploy/ssh-keys/root.private.key` — local path already wired |
| `deploy.yml` | `username: deployer` + `key: secrets.DROPLET_SSH_KEY` in **7** steps; unchanged by the decision |
| `ssh-keygen -y -f deploy/ssh-keys/root.private.key` (Windows OpenSSH) | `invalid format` |
| `C:\Progs\Git\usr\bin\ssh-keygen.exe -y -f …` | `error in libcrypto` |
| base64 payload decoded | `openssh-key-v1`, 274 bytes, all field lengths consistent |
| after trimming trailing whitespace per armour line | parses; prints `ssh-ed25519 AAAA…GGf3 aisztens.hu-root-no-passphrase` |
| Windows OpenSSH before the ACL fix | `UNPROTECTED PRIVATE KEY FILE` / `bad permissions` |
| `/home/deployer/.ssh/authorized_keys` | already contained the key's public half (`grep -c` = 1) |

## 3. Root cause / design rationale

The key file as saved carried **trailing whitespace on the PEM/armour lines** (e.g. after
`-----END OPENSSH PRIVATE KEY-----`), which OpenSSH rejects before it ever decodes the blob — the
base64 itself was intact. On Windows a second, independent gate applies: OpenSSH refuses any private
key whose ACL is broader than the current user, so the file had to be ACL-restricted before it could
be read at all.

Least privilege was chosen over convenience for CI: the workflow keeps the `deployer` user
(sudo + docker group) and merely swaps the key, so no workflow logic changes and the
`root`-only key is not handed to the CI secret for root logins.

## 4. Solution / implementation

| Changed file | Change |
|---|---|
| `.github/workflows/deploy.yml` | comments only: `DROPLET_SSH_KEY` = the passphrase-less deploy key, public half in `/home/deployer/.ssh/authorized_keys`; `username: deployer` unchanged |
| `deploy/README.md` | §1/§2/§8/§8.1/§8.4 updated for the new key, the local `root` login, and the root-key trade-off |
| `deploy/ssh-keys/README.md` | new "The deploy key" section (both login paths + the public half) |
| `deploy/.env.example`, `deploy/.env.dev` | `HOST`/`SSH_USER`/`SSH_KEY` comments rewritten (no more "switch to deployer") |
| `deploy/ssh-keys/root.private.key` (gitignored) | rewritten cleanly (LF, trailing whitespace stripped) + ACL restricted to the session user |

Droplet: the key was already authorised for `deployer`; ownership/mode re-asserted (0600,
`deployer:deployer`).

## 5. Outcome and how to verify

```bash
ssh -i deploy/ssh-keys/root.private.key -o IdentitiesOnly=yes root@ssh.aisztens.hu "id -un"
# → root
ssh -i deploy/ssh-keys/root.private.key -o IdentitiesOnly=yes deployer@ssh.aisztens.hu "id -un; groups"
# → deployer / deployer sudo docker
```

Remaining manual step: set the GitHub secret **`DROPLET_SSH_KEY`** to the new private key
(Settings → Secrets and variables → Actions). No `passphrase:` input is required. Then run
**Actions → Deploy to droplet → Run workflow (app_env=dev)** to confirm the 7 SSH/SCP steps.

## 6. Follow-ups

- **`deploy.sh` env-file mismatch (pre-existing, unrelated):** `COMPOSE_ARGS` is derived from the
  local repo, so it invokes `--env-file infra/.env.dev` on the droplet while the deploy ships that
  file to `infra/.env` → `couldn't find env file: /opt/aisztens/infra/.env.dev`. Fix by resolving the
  remote name to `infra/.env` or by shipping the per-env name.
- Optional hardening: restrict the key in `deployer`'s `authorized_keys` with `from=` / `restrict`.
- The key is passphrase-less by design; rotate it if it ever leaves the machine or the GitHub secret.
