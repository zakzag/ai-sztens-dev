# Fix: rsync `-e` re-uses `user@host`, leading to `bash: line 1: <host>: command not found`

## Date
2026-09-24

## Context
Running `./deploy/deploy.sh bootstrap` from WSL (Debian) against the production
droplet (`ssh.aisztens.hu`) failed while uploading the repository:

```
[deploy] Uploading ... -> root@ssh.aisztens.hu:/opt/aisztens ...
Enter passphrase for key '...': <twice>
bash: line 1: ssh.aisztens.hu: command not found
rsync: connection unexpectedly closed (0 bytes received so far) [sender]
rsync error: error in rsync protocol data stream (code 12) at io.c(232) [sender=3.4.1]
```

## Root cause
[`deploy/deploy.sh`](deploy/deploy.sh:32) originally built a single `SSH` array
that contained both the ssh command/options **and** the `user@host` pair:

```bash
SSH=(ssh -o ... ${SSH_KEY:+-i "$SSH_KEY"} "$SSH_USER@$HOST")
```

It then passed that array to rsync via `-e "${SSH[*]}"`
([`deploy/deploy.sh`](deploy/deploy.sh:41)).

rsync's `-e` flag expects only the remote shell command + its options.
rsync appends the destination host itself, so the effective remote command
became:

```
ssh -o ... -i <key> root@ssh.aisztens.hu ssh.aisztens.hu rsync --server ...
```

The remote shell then tried to execute `ssh.aisztens.hu` as a command, which
manifested as `bash: line 1: ssh.aisztens.hu: command not found`. The
authentication prompt appeared twice because rsync makes two attempts.

## Fix
Split the array: one for the ssh command (no host), one for the full
`user@host`. Use the command-only array in rsync's `-e`.
[`deploy/deploy.sh`](deploy/deploy.sh:37):

```bash
SSH_CMD=(ssh -o StrictHostKeyChecking=accept-new -o IdentitiesOnly=yes ${SSH_KEY:+-i "$SSH_KEY"})
SSH=("${SSH_CMD[@]}" "$SSH_USER@$HOST")
```

[`deploy/deploy.sh`](deploy/deploy.sh:47) now reads:

```bash
rsync -az --delete -e "${SSH_CMD[*]}" \
```

`SSH=("${SSH_CMD[@]}" "$SSH_USER@$HOST")` keeps the `"${SSH[@]}"` invocation
shape used by `upload()`'s `mkdir -p` call and `run_remote()` unchanged, so the
rest of the script (`bootstrap`, `up`, `down`, `restart`, `ps`, `logs`) was not
touched.

## Verification
- `bash -n deploy/deploy.sh` reports `syntax OK`.
- The next `./deploy/deploy.sh bootstrap` run is expected to upload the repo
  cleanly and then invoke `deploy/bootstrap.sh` as root on the droplet.

## Side notes / prerequisites
- WSL still needs `rsync` installed locally (the prerequisite is declared in
  [`deploy/deploy.sh`](deploy/deploy.sh:4) but is not always preinstalled):
  `apt-get install -y rsync openssh-client`.
- `deploy/.env` already had `SSH_KEY=/home/tkovari/.ssh/kalman-ssh-key-20260916.openssh.private.key`,
  which is why the ssh passphrase was prompted even before the rsync error
  surfaced.
