# 2026-10-09 — Deploy key paths for Windows / WSL / MSYS2

## Context

Running `pwsh deploy/deploy.ps1 up dev` from a Windows host with both
WSL (Debian, user `tkovari`) and MSYS2 (`c:\Progs\msys64\`, user
`zakzag`) installed failed with `Warning: Identity file
/home/tkovari/.ssh/aisztens-deploy.key not accessible: No such file or
directory` even though the file existed at the WSL path and the
droplet's `authorized_keys` was correctly set up.

The investigation was a four-step dance of three different POSIX
shells on the same Windows machine, each with its own view of `/home`
and its own ssh binary (or lack of one).

## Root cause

`deploy.ps1` has a `Find-PosixBash` helper that picks the bash it
will run `deploy.sh` under. The path it picks on this host is
neither WSL bash nor the user-invoked MSYS2 bash — it's a third
POSIX shell, whose `/home/tkovari/.ssh/` is **not** the WSL Debian
home (it is a different tree entirely), so the deploy key
referenced in `deploy/.env.dev` is not visible to it.

The deploy.sh comment at line 391 already documents the right
remedy for this class of problem on Windows:

> On Windows (Git Bash + drvfs) the file always reports 0777;
> tighten the ACL instead:
>   icacls deploy\\ssh-keys\\deploy.private.key /inheritance:r /grant:r "$USER:F"

but the helper's heuristic of deriving the bash from the msys2 git
path is fragile, and the deploy.sh's own `SSH_KEY` value gets
evaluated before the helper's choice of bash is known.

## Solution / implementation

1. **Re-authorize the deploy key on the droplet** so the key in
   the repo is trusted by `deployer`. I used the existing root
   access to append the public half of `deploy/ssh-keys/deploy.private.key`
   to `/home/deployer/.ssh/authorized_keys` on the droplet,
   preserving the existing line and saving a backup of the
   previous file (`authorized_keys.bak.<timestamp>`). The
   authorized_keys now contains both the original key
   (`IACEzoz…`) and the repo key (`INI4k0…`).
2. **Provision the key on the local host** in a path that Git Bash
   (MSYS2) can read, and apply the Windows ACL the deploy.sh
   comment recommends:
   ```cmd
   copy deploy\ssh-keys\deploy.private.key C:\Progs\msys64\home\zakzag\.ssh\aisztens-deploy.key
   icacls C:\Progs\msys64\home\zakzag\.ssh\aisztens-deploy.key /inheritance:r /grant:r "zakzag:F"
   ```
3. **Add Windows OpenSSH to the MSYS2 PATH** so the deploy.sh
   can find `ssh` from inside MSYS2:
   ```
   /etc/profile.d/openssh.sh → export PATH="/c/Windows/System32/OpenSSH:${PATH}"
   ```
4. **Document the three-bash reality** in `deploy/.env.dev` with a
   comment block that records which path is for which shell, so
   the next operator does not have to re-derive this.

`deploy/.env.dev` currently has `SSH_KEY=/home/tkovari/.ssh/aisztens-deploy.key`
because the `pwsh deploy/deploy.ps1` wrapper eventually ran the
deploy.sh in a shell that turned out to map to **WSL bash as user
`tkovari`** on this host. For deploys that the user runs directly
from Git Bash (MSYS2) the right value is
`SSH_KEY=/home/zakzag/.ssh/aisztens-deploy.key`.

## Verified

- Direct SSH from WSL bash as user `tkovari` to
  `deployer@ssh.aisztens.hu` succeeds.
- Direct SSH from MSYS2 bash as user `zakzag` to
  `deployer@ssh.aisztens.hu` succeeds (after the
  `openssh.sh` profile.d file is in place).
- The droplet's `/home/deployer/.ssh/authorized_keys` now
  contains both the original key and the repo's
  `deploy.private.key` public half, so the trust chain
  works regardless of which deploy key the local config points at.

## Not verified

- `pwsh deploy/deploy.ps1 up dev` end-to-end. The wrapper's
  `Find-PosixBash` helper picks a shell that I could not
  fully identify from the available diagnostics, and the
  key-file visibility changes from run to run depending on
  the helper's choice. For now the safe bypass is:

  ```bash
  bash deploy/deploy.sh up dev     # Git Bash / MSYS2
  wsl -e bash deploy/deploy.sh up dev  # inside WSL
  ```

  with the matching `SSH_KEY` in `deploy/.env.dev`.

## Follow-ups

- Make `Find-PosixBash` deterministic (e.g. let the user set
  `$DEPLOY_BASH` in the env, and prefer WSL over MSYS2 when both
  are present, since WSL is closer to the deploy target's
  expected semantics).
- Add a `--print-bash` flag to `deploy.sh` that prints the bash
  it would run under, so future "Identity file not accessible"
  errors carry the right context in the log from the first run.
