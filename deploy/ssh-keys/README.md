# SSH public keys

Place one public key per user before running [`deploy/bootstrap.sh`](../bootstrap.sh):

| File | Purpose |
|---|---|
| `tkovari.pub` | Owner (sudo) |
| `krak.pub` | Colleague (sudo) |
| `aisztens.pub` | App runtime user (no sudo, can operate Docker) |
| `deployer.pub` | Deploy user (sudo) |

The private keys are the ones that "already exist" per the droplet plan; only the
**public** halves belong here. Real `*.pub` files are gitignored — commit only the
`.pub.example` placeholders.

Generate a key pair if needed:

```bash
ssh-keygen -t ed25519 -C "tkovari@callback" -f tkovari
```

Then copy the generated `tkovari.pub` next to this README.

## The deploy key

`deploy.private.key` (gitignored via `*.private.key`) is the **deploy key** — a
passphrase-less ed25519 key. It is the single key both deploy paths use, and they also
share the same account, `deployer`:

- **local** — [`deploy/deploy.sh`](../deploy.sh) (`deploy/.env.dev`: `SSH_USER=deployer`,
  `SSH_KEY=./deploy/ssh-keys/deploy.private.key`);
- **CI** — the GitHub Actions workflow uses the same key through the `DROPLET_SSH_KEY`
  secret and also logs in as `deployer`, so its public half must be present in
  `/home/deployer/.ssh/authorized_keys` on the droplet.

Because they are interchangeable, a deploy is reproducible with either path.

The one exception is `bootstrap` (install packages, create users): that is a hand-run,
one-off step which needs a root login — `SSH_USER=root ./deploy/deploy.sh bootstrap`.
The key is therefore also authorised for `root` at the SSH layer.

Its public half is:

```
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAINI4k0yp3DLE2O6vwgsGcA4J0OXBDQ2NvPJPPOtsGGf3 aisztens.hu-root-no-passphrase
```

It is passphrase-less by design (non-interactive CI), and because it opens a root shell
on the droplet when combined with the root login, treat the file as a root credential:
never commit it, keep it readable only by you (on Windows: `icacls <file> /inheritance:r
/grant:r "<you>:F"`), and rotate it if it leaks.
