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
