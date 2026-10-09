# Milestone — env merge (old clone → current repo) + `.env` test suite

**Date:** 2026-10-07
**Plan:** [`../history/2026-10-07-env-merge-old-new-and-env-tests-plan.md`](../history/2026-10-07-env-merge-old-new-and-env-tests-plan.md)
**History:** [`../history/2026-10-07--12-57-00-env-merge-and-env-test-suite.md`](../history/2026-10-07--12-57-00-env-merge-and-env-test-suite.md)

## 1. Problem / feature

Two local clones of AIsztens existed. The old clone
(`2026-08-31-ai-sztens-dev-old`) had single-env `.env` files with **valid
credentials** and the four user SSH public keys; the current clone had the
**new three-env structure** (`.env.local` / `.env.dev` / `.env.prod`) but a
missing `deployer` sudo user, stale comments, and no public keys. The goal was
to reconcile both into the current repo without losing any real credential,
keeping the new structure as the source of truth, and to add a way to test the
`.env` files themselves.

## 2. Measured data / evidence

Inventoried every `.env` file in both clones (gitignored files included, and
the `.env.example` headers used as the structural reference):

| Location | Old clone | Current clone |
|---|---|---|
| `deploy/.env` | `SUDO_USERS=tkovari,krak,deployer`, `SSH_KEY=/home/tkovari/.ssh/kalman-…` | `deploy/.env.dev` had `SUDO_USERS=tkovari,krak` |
| `infra/.env` | `CORS_ORIGINS` included `https://api.aisztens.hu` | `infra/.env.dev` had web+admin only (new) |
| `apps/*` | none (old admin was Angular) | per-env files present |
| `deploy/ssh-keys/` | `tkovari.pub`, `krak.pub`, `aisztens.pub`, `deployer.pub` | none |

Discrepancies confirmed against docs:
[`Three-Env-Verification.md`](../Specs/Three-Env-Verification.md:298) §3.4–3.5
states `api.aisztens.hu` must be absent from CORS;
[`deploy/README.md`](../../deploy/README.md:100) and
[`bootstrap.sh`](../../deploy/bootstrap.sh:1) list `deployer` as a sudo user.

## 3. Root cause / design rationale

The current repo was produced by the five-step three-env separation, which
renamed the flat `.env` files but did not re-derive their contents from the
old operator clone, and did not carry over the key material. Two values had
legitimately changed during that separation (the CORS list was tightened by
the VAPI webhook security work), so "old data wins" would have been wrong.

Design decision: **new structure is authoritative**; old values are imported
only where they fill a gap. Each of the six discrepancies was decided
individually with the requester.

## 4. Solution / implementation

| Changed file | Change |
|---|---|
| [`deploy/.env.dev`](../../deploy/.env.dev:1) | `SUDO_USERS=tkovari,krak,deployer`; seed banner replaced; `SSH_KEY` kept repo-local |
| [`infra/.env.dev`](../../infra/.env.dev:1) | stale header rewritten; CORS stays web+admin (2 origins) |
| [`deploy/ssh-keys/`](../../deploy/ssh-keys/README.md:1) | added `tkovari.pub`, `krak.pub`, `aisztens.pub`, `deployer.pub` |
| [`scripts/env-test/check-env-syntax.sh`](../../scripts/env-test/check-env-syntax.sh:1) | new offline checker (syntax, duplicates, sourcing, required keys, placeholders, SPA↔infra cross-check) |
| [`scripts/env-test/check-env-live.sh`](../../scripts/env-test/check-env-live.sh:1) | new live checker (SSH, Postgres, HTTPS, secret/CORS/sudo/pub-key) |
| [`scripts/env-test/*.ps1`](../../scripts/env-test/check-env-syntax.ps1:1) | Windows wrappers |
| [`scripts/env-test/README.md`](../../scripts/env-test/README.md:1) | new documentation |
| [`deploy/README.md`](../../deploy/README.md:1), [`scripts/test/README.md`](../../scripts/test/README.md:1), [`README.md`](../../README.md:36) | per-env naming + link to the new suite |

Out of scope: prod files stay dormant, `infra/.env.local` stays auto-seeded,
no credential rotation.

## 5. Outcome and how to verify

The current repo keeps the new per-env structure, all valid credentials, all
four public keys, and `deployer` is a sudo user again. Verify with:

```bash
# offline — must be green anywhere
bash scripts/env-test/check-env-syntax.sh

# live — explicit, hits the dev droplet
bash scripts/env-test/check-env-live.sh --dry-run
bash scripts/env-test/check-env-live.sh
```

Windows: `pwsh scripts/env-test/check-env-syntax.ps1`.

## 6. Follow-ups

- [`scripts/test/lib/00-prelude.sh`](../../scripts/test/lib/00-prelude.sh:54)
  still defaults the smoke suite to `infra/.env`; prefer `infra/.env.local`
  when present.
- `deploy/.env.prod` and `infra/.env.prod` remain dormant until a prod
  droplet is provisioned.
- `apps/api/.env.dev` keeps its placeholder VAPI secret by design (compose
  injects the real one from `infra/.env.dev`).
