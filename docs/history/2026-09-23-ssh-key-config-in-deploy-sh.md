# 2026-09-23 — SSH key configuration in `deploy/deploy.sh`

## Problem

Running `./deploy/deploy.sh upload` against `api.aisztens.hu` failed with:

```
[deploy] Uploading /mnt/e/projects/AI/2026-08-31-ai-sztens-dev -> root@api.aisztens.hu:/opt/aisztens ...
root@api.aisztens.hu: Permission denied (publickey).
```

`ssh` was authenticating as `root`, but no key in `~/.ssh/` (and no key in
`ssh-agent`) matched an entry in the droplet's `/root/.ssh/authorized_keys`.
The script had no way to point ssh at a specific private key — it relied on
ssh-agent + `~/.ssh/id_*` defaults.

## Changes

### `deploy/deploy.sh`

- Added an optional `SSH_KEY` variable sourced from `deploy/.env`.
- SSH/SCP invocations now use:
  - `-o IdentitiesOnly=yes` — prevents ssh from offering every agent key on
    each connection (avoids `Too many authentication failures` and makes
    failures unambiguous).
  - `-i "$SSH_KEY"` only when `SSH_KEY` is non-empty — otherwise ssh falls
    back to agent + `~/.ssh` defaults.
- `rsync` now uses `-e "${SSH[*]}"` so the same key is used for the upload
  too.

### `deploy/.env` / `deploy/.env.example`

- Added a documented `SSH_KEY=` slot with an example value, leaving it empty
  by default so existing setups keep working unchanged.

### `deploy/README.md`

- Documented the new `SSH_KEY` knob in the "Local preparation" step.

## How to fix the failing deployment

Three options, ordered from cleanest to fastest:

1. **Pin the key explicitly** (recommended, especially if the bootstrap
   hasn't run yet on the droplet):
   ```bash
   # 1. Upload the matching public key to the droplet's root
   #    via the DigitalOcean recovery console, e.g.:
   #      mkdir -p /root/.ssh && chmod 700 /root/.ssh
   #      echo "$(cat ~/.ssh/aisztens_deployer.pub)" >> /root/.ssh/authorized_keys
   #      chmod 600 /root/.ssh/authorized_keys
   #
   # 2. Tell the script which private key to use:
   #      echo 'SSH_KEY=/home/<you>/.ssh/aisztens_deployer' >> deploy/.env
   #
   # 3. Verify:
   ssh -i ~/.ssh/aisztens_deployer root@api.aisztens.hu echo OK
   #
   # 4. Run bootstrap:
   ./deploy/deploy.sh bootstrap
   ```

2. **Run bootstrap via the DO recovery console first**, so
   `/root/.ssh/authorized_keys` already contains the deployer key — then
   either rely on `ssh-agent` (`ssh-add ~/.ssh/aisztens_deployer`) or pin
   the key in `deploy/.env`.

3. **Keep using ssh-agent** — leave `SSH_KEY=` empty in `deploy/.env`,
   make sure `ssh-add -l` lists the key whose public half matches an entry
   installed by `deploy/bootstrap.sh`.

After bootstrap succeeds, the canonical setup (also used by the GitHub
Actions workflow in `.github/workflows/deploy.yml`) switches `SSH_USER` to
`deployer` and re-runs the same key from there.

## Update (2026-09-23 evening) — root cause was the key format

The first attempt still failed. Investigation revealed:

- The file placed at `deploy/ssh-keys/id_aisztens_krak` is a **PuTTY
  Private Key (PPK v2, ed25519, AES-256-CBC encrypted)**, not OpenSSH PEM.
- `file` confirms: `PuTTY Private Key File, version 2, algorithm
  ssh-ed25519`.
- Even with the script pinned to `SSH_KEY=.../id_aisztens_krak` and
  `chmod 600`, OpenSSH cannot load the file → it never offers a public key
  to the server → `Permission denied (publickey)`.

### Fix (Windows host + WSL Debian, key `id_aisztens_krak`)

1. Make sure PuTTY is installed on Windows. `C:\Progs\PuTTY\puttygen.exe`
   was used here.
2. Run the helper added in this commit, from PowerShell:
   ```powershell
   powershell -ExecutionPolicy Bypass -File scripts\convert-ppk-to-openssh.ps1
   ```
   The script:
   - calls `puttygen.exe ... -O private-openssh` (PuTTYgen prompts for
     the passphrase — type it, press Enter);
   - copies the resulting OpenSSH key into WSL at `~/.ssh/id_aisztens_krak`
     with `chmod 600`;
   - verifies with `ssh-keygen -y -f ~/.ssh/id_aisztens_krak` and prints
     the public half.
3. `deploy/.env` is already updated to point at that path:
   ```
   SSH_KEY=/mnt/e/projects/AI/2026-08-31-ai-sztens-dev/deploy/ssh-keys/id_aisztens_krak
   ```
   but **after step 2** it is cleaner to change it to the WSL-internal
   path so the deploy script never touches the (still-PPK) Windows file:
   ```
   SSH_KEY=/home/tkovari/.ssh/id_aisztens_krak
   ```
4. Sanity-check before running the real deploy:
   ```bash
   wsl -e bash -c 'ssh -i /home/tkovari/.ssh/id_aisztens_krak \
       -o IdentitiesOnly=yes root@api.aisztens.hu echo OK'
   ```
   Should print `OK` (the droplet must already have the matching public
   half in `/root/.ssh/authorized_keys`; if not, paste it in via the DO
   recovery console first).
5. Then run:
   ```bash
   ./deploy/deploy.sh bootstrap
   ```

### Files added / changed

- `deploy/deploy.sh` — added `SSH_KEY` plumbing and `IdentitiesOnly=yes`.
- `deploy/.env` / `deploy/.env.example` — documented `SSH_KEY`.
- `deploy/README.md` — Local preparation step mentions `SSH_KEY`.
- `scripts/convert-ppk-to-openssh.ps1` — new helper to convert the
  PuTTYgen key into OpenSSH PEM inside WSL (interactive passphrase).
- `scripts/_convert-ppk.sh`, `scripts/_fix-ssh-key.sh`,
  `scripts/_install-puttygen.sh`, `scripts/_inspect-key.sh` —
  debugging aids kept for reference; safe to delete after this commit.
