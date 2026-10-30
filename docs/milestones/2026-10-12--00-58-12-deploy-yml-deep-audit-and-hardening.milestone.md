# Milestone — deploy.yml deep audit and hardening (2026-10-12)

## 1. Problem / feature

After the four-bug fix chain that restored real deploys
(parse errors -> chmod on .env -> `command:` no-op -> `envs:` missing),
the user asked for a deeper audit of `.github/workflows/deploy.yml` to
surface any remaining issues before another push. A scripted
actionlint-style review was run over the file, identifying one real
bug (BUG-5), two medium bugs (BUG-6, BUG-7), and four warnings
(WARN-1..4). All seven were fixed in a single commit.

## 2. Measured data / evidence

- YAML parsed cleanly (`python -c "yaml.safe_load(...)" -> OK`).
- 12 steps total; 8 appleboy action invocations, all previously
  floating at `@v0.1.7` / `@v1.0.3`.
- `env.APP_ENV` helper added at workflow level; 4 previous inline
  expressions replaced with `${{ env.APP_ENV }}` reads.
- New `for key in APP_ENV IMAGE_TAG GHCR_OWNER REGISTRY; do grep ... ; done`
  guard in the render-env step; raises if the secret contains any of
  those keys.
- New `printf '%s' "$domain" | grep -q '|'` guards in the
  Render Caddyfile step.
- `actions/checkout@v4` now has `persist-credentials: false`.

## 3. Root cause / design rationale

The audit found one class of bug that would have been silently
catastrophic the day someone added `prod` to the push branches
(BUG-5) and a class of bug that would have produced silently wrong
container images the day someone forgot the precedence rule and put
`IMAGE_TAG=` into a secret (BUG-7). Both were latent, not visible in
the current run, but reachable by single-line edits in the wrong
direction. The other items are hardening against
history-repeating-itself (the very file we just spent an hour
debugging was originally working because `command:` happened to be
the right key name in an older action version).

## 4. Solution / implementation

`.github/workflows/deploy.yml` is the only code change (5 edits):

1. Added workflow-level `env.APP_ENV` with the full fallback chain
   (operator input -> upstream dispatch input -> upstream
   `head_branch` -> direct push `ref_name` -> 'dev').
2. Replaced 4 inline `inputs.app_env || ...` expressions with
   `${{ env.APP_ENV }}` reads.
3. Added the secret-key-collision guard in the render-env step.
4. Added the `|` character guard in the Render Caddyfile step.
5. SHA-pinned both appleboy action versions and added
   `persist-credentials: false` to the checkout step.

Plus:

- `docs/Specs/Production-Runbook.md` and
  `docs/Specs/Caddy-Reverse-Proxy.md` headers updated with the new
  `Utolsó frissítés` (last updated) entry referencing this work, per
  the project rule that specs doksik must be kept in sync with the
  code they describe.

## 5. Outcome and how to verify

```bash
git add .github/workflows/deploy.yml \
        docs/Specs/Production-Runbook.md \
        docs/Specs/Caddy-Reverse-Proxy.md
git commit -m "fix(ci): deploy.yml deep audit pass (BUG-5..7, WARN-1..4) + specs sync"
git push origin dev
```

Expected on the next deploy run:

- `concurrency.group` reads `deploy-dev` (unchanged behaviour today).
- `Render infra/.env` step succeeds; if any of the four
  pre-write keys were in the secret, it would now fail loudly with
  a precise message instead of silently overwriting them.
- `Render Caddyfile` step succeeds; if `DOMAIN` or `ACME_EMAIL` ever
  contained `|`, it would now fail loudly.
- All 8 appleboy action invocations run from a SHA-pinned image;
  the version comment is preserved for humans.
- `actions/checkout` does not leave a writable GITHUB_TOKEN in the
  runner's git config.

To verify the BUG-5 fix would have caught the future regression:
add `prod` to `push.branches:` in `images.yml`, push a test commit
to `prod`, and confirm that the deploy workflow's
`concurrency.group` is `deploy-prod` (not `deploy-dev`).

## 6. Follow-ups

- The same deep-audit pass should be run on `.github/workflows/images.yml`
  and `.github/workflows/ci.yml`. The actionlint-style check
  performed here was ad-hoc; making it a permanent CI step would
  catch this class of bug at PR time. Consider a
  `.github/workflows/audit-workflows.yml` that runs `actionlint` on
  every push to `dev` and `main`.
- The `Bash`/shellcheck discipline in the workflow scripts would
  benefit from a `shellcheck` pass. `shellcheck` is not currently
  installed in this environment.
- `appleboy/ssh-action` v2+ may add native OIDC support, which
  would let us drop the static `DROPLET_SSH_KEY` secret entirely.
  Track the upstream changelog.
- The smoke-test step still uses a bash script that lives at
  `scripts/test/stack-smoke.sh`; this means the deploy workflow has
  an implicit dependency on a file that the runner does not have
  (no checkout of `scripts/` in the deploy workflow's
  `sparse-checkout`). It works because the script is `bash`'d on
  the droplet, not on the runner, but is fragile. Consider either
  adding `scripts/test` to the sparse-checkout list (so the
  script is at least visible in the runner for `bash -n` checks)
  or shipping the script as part of the `infra/` tree.
