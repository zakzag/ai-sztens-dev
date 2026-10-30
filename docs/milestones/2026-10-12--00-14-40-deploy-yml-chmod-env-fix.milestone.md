# Milestone — deploy.yml scp tar Permission denied fix (2026-10-12)

## 1. Problem / feature

After fixing the previous `deploy.yml` parse errors (commit
`49e5c5b`), the workflow file parsed, but the `appleboy/scp-action`
step aborted with `tar: can't open 'infra/.env': Permission denied`.
Without this step nothing reaches the droplet, so the live sites keep
serving stale images.

## 2. Measured data / evidence

GitHub Actions log excerpt from run after `49e5c5b`:

```
*** [command]/usr/bin/docker run --name fc5f21f994c7b8b2404427973edca825acc61e_fb192a --label fc5f21 ...
drone-scp version: v1.6.14
tar all files into /tmp/AWRacuBkDG.tar.gz
tar: can't open 'infra/.env': Permission denied
tar: error exit delayed from previous errors
exit status 1
```

The action's `tar` is invoked inside a docker container that does not
share the runner uid. The runner has `chmod 600` set on `infra/.env`
(written by step 3 of the workflow), so the foreign-uid tar cannot
read it.

## 3. Root cause / design rationale

`deploy.yml` step 3 (Render infra/.env from the matching secret) writes
the env file with `chmod 600` to honour the `deploy/README.md`
"owner-only readable" convention. That convention is **about the
file on the droplet**, where it persists and might be read by other
processes or local users. On the runner, the file is ephemeral and
sits only long enough to be picked up by the scp step.

The mismatch between "tight on the runner for paranoia" and "needs to
be readable by a foreign-uid tar" is what triggered the failure.

Alternatives considered:

- **Switch to `rsync-actions` or a direct `scp`/`sftp` step** —
  possible but a larger refactor; scp-action is already wired up and
  used everywhere else. Not worth it.
- **Pre-scp `chmod 644`, post-scp `chmod 600` on the runner** — does
  not help: the scp-action copies the file as-is with its mode, so
  whatever the runner mode is, that mode lands on the droplet.
- **Pre-scp `chmod 644` on the runner, post-scp `chmod 600` via a
  follow-up ssh-action on the droplet** — chosen. Smallest possible
  diff, preserves the documented droplet-side posture.

## 4. Solution / implementation

`.github/workflows/deploy.yml` only:

| Step                                     | Change                                                                                                                                                                                             |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Step 3                                   | `chmod 600` → `chmod 0644`. Comment expanded to document why.                                                                                                                                      |
| New step 5a (between scp and GHCR login) | `appleboy/ssh-action@v1.0.3` that `chmod 600`s `infra/.env` on the droplet, with a `set -euo pipefail` guard that fails the step if the file is missing (indicates the scp step silently lost it). |

No source code, no Docker image, no infra-as-code change. The 12-step
workflow is now 12 steps (one new), and `python -c "yaml.safe_load(...)"`
still returns success.

## 5. Outcome and how to verify

```bash
git add .github/workflows/deploy.yml
git commit -m "fix(ci): chmod 0644 infra/.env before scp, 0600 again on droplet"
git push origin dev
```

On the next deploy run:

- The "Tighten infra/.env permissions on the droplet" step should log
  `infra/.env on droplet is now mode 600 (was 644 after scp; ...)`.
- `images.yml` + `deploy.yml` should both go green in ~5 min.
- After the run:

  ```bash
  curl -s https://api.aisztens.hu/healthz
  # expected: {"status":"oks",...}
  ```

  ```bash
  # On the droplet
  stat -c '%a %n' /opt/aisztens/infra/.env
  # expected: 600 /opt/aisztens/infra/.env
  ```

## 6. Follow-ups

- Consider adding a smoke-test assertion that the droplet-side
  `infra/.env` mode is `600` after a deploy, so a future regression
  that re-relaxes the chmod on the runner without re-tightening on
  the droplet is caught before the secret can leak to other local
  users.
- The same fix may be needed for any other secret-bearing file in
  the future (e.g. if `secrets.json` or a kubeconfig ever ends up
  in the scp `source:` list). The pattern is: write 0644, scp,
  ssh-chmod-on-droplet.
- `deploy.yml` has now gone through two workflow-syntax fixes in two
  consecutive deploy attempts. Worth a separate hardening pass to
  `actionlint` the file and add it to a CI step.
