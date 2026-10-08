# Deploy key switch — new passphrase-less key for local (`root`) and CI (`deployer`)

**Date:** 2026-10-07 15:35 (Europe/Budapest)
**Plan:** [`2026-10-07-deploy-root-ssh-key-plan.md`](2026-10-07-deploy-root-ssh-key-plan.md)
**Milestone:** [`../milestones/2026-10-07--15-35-00-deploy-key-root-and-deployer.milestone.md`](../milestones/2026-10-07--15-35-00-deploy-key-root-and-deployer.milestone.md)

## Request

The requester replaced the deploy private key with a **new, dedicated, passphrase-less** ed25519 key
(`deploy/ssh-keys/root.private.key`, comment `aisztens.hu-root-no-passphrase`, public half
`ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAINI4k0yp3DLE2O6vwgsGcA4J0OXBDQ2NvPJPPOtsGGf3`) and asked that
**both** deploy paths use it. Decision on review: **the CI keeps the `deployer` user** (least
privilege); the local deploy keeps `SSH_USER=root`.

## Changes

| File | Change |
|---|---|
| [`.github/workflows/deploy.yml`](../../.github/workflows/deploy.yml:26) | Comments only — the required-secrets block now describes `DROPLET_SSH_KEY` as the passphrase-less deploy key whose public half must be in `/home/deployer/.ssh/authorized_keys`; added the note that the same key is used locally as `root`. `username: deployer` unchanged in all 7 SSH/SCP steps. |
| [`deploy/README.md`](../../deploy/README.md:73) | §1 documents the pinned deploy key; §2 states the local deploy stays on `root`; §8 intro now keys off "the deploy key is authorised for `deployer`"; §8.1 `DROPLET_SSH_KEY` row rewritten (key file + authorized_keys prerequisite); §8.4 documents the root-key trade-off and the optional `authorized_keys` restriction. |
| [`deploy/ssh-keys/README.md`](../../deploy/ssh-keys/README.md:24) | New "The deploy key" section: what the key is, both login paths, its public half, and the "treat as a root credential" rule. |
| [`deploy/.env.example`](../../deploy/.env.example:27) | The `HOST`/`SSH_USER`/`SSH_KEY` comments describe the local `root` login and the passphrase-less key. |
| `deploy/.env.dev` (gitignored) | Same comment tidy. |

## Operator work performed

1. **Key file repaired.** `deploy/ssh-keys/root.private.key` as saved had **trailing whitespace on the
   armour lines**, which the OpenSSH parser rejected:
   - `ssh-keygen -y -f …` → `Load key …: invalid format` (Windows OpenSSH)
   - `"C:\Progs\Git\usr\bin\ssh-keygen.exe" -y -f …` → `error in libcrypto`
   - after trimming trailing whitespace per line: the key parses and prints its public half.
   The file was rewritten cleanly (LF, no stray spaces, single trailing newline); the intermediate
   copies were removed.
2. **Windows ACL hardened.** Windows OpenSSH refused the key as "too open"; inheritance was removed
   and only the session user granted: `icacls … /inheritance:r /grant:r "zakzag:F"`.
3. **Droplet:** `/home/deployer/.ssh/authorized_keys` already contained the key's public half
   (`grep -c` = 1) — verified rather than re-appended; permissions re-asserted (0600, `deployer:deployer`).

## Verification

```
ssh -i deploy/ssh-keys/root.private.key -o IdentitiesOnly=yes root@ssh.aisztens.hu "id -un; hostname"
# → root / AISztens-prod-ubuntu-s-1vcpu-1gb-fra1

ssh -i deploy/ssh-keys/root.private.key -o IdentitiesOnly=yes deployer@ssh.aisztens.hu "id -un; groups"
# → deployer / deployer sudo docker        (the CI login path)

bash deploy/deploy.sh ps dev
# config: DEPLOY_ENV=dev env_file=deploy/.env.dev … SSH_USER=root
# → authenticated over SSH as root; the remote compose call then failed on a
#   pre-existing env-file-path mismatch (see follow-ups)
```

## Findings / follow-ups

- **Pre-existing: `deploy.sh` uses the local per-env filename remotely.** `COMPOSE_ARGS` is computed
  from the *local* repo, so with `infra/.env.dev` present it runs
  `--env-file infra/.env.dev` on the droplet — where the deploy copies that file to `infra/.env`.
  Result: `couldn't find env file: /opt/aisztens/infra/.env.dev`. Unrelated to the key change, but it
  currently breaks `deploy/deploy.sh ps|up dev`; fix by resolving the remote name to `infra/.env`
  (or shipping `infra/.env.dev`).
- **GitHub secret still to set:** `DROPLET_SSH_KEY` must be replaced with the new key in
  Settings → Secrets and variables → Actions (no `passphrase:` needed — the key is passphrase-less).
- The key file must remain gitignored (`*.private.key`) and must never be echoed into a log.
