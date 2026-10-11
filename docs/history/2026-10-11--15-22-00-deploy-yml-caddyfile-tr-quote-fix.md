# Fix — `.github/workflows/deploy.yml` Render Caddyfile `tr -d \"'\"` quoting

**Date:** 2026-10-11 15:22 UTC
**Files touched:**

- [`.github/workflows/deploy.yml`](../../.github/workflows/deploy.yml) — the `Render Caddyfile` step's two `tr` invocations replaced with a single `tr -d "$_quote_chars"` whose value is set from ANSI-C `$'\"\047'`; explanatory comment added.
- [`docs/history/2026-10-11--15-22-00-deploy-yml-caddyfile-tr-quote-fix.md`](2026-10-11--15-22-00-deploy-yml-caddyfile-tr-quote-fix.md) — this entry.

---

## 1. Symptom (recap from the images.yml v2 milestone)

The previous milestone at [`docs/milestones/2026-10-11--15-13-45-images-yml-tr-quote-fix-v2.milestone.md`](../milestones/2026-10-11--15-13-45-images-yml-tr-quote-fix-v2.milestone.md) flagged this exact line as a separately-tracked follow-up:

> **Follow-up to address separately:** [`.github/workflows/deploy.yml:173–174`](../../.github/workflows/deploy.yml:173) still has the same `tr -d \"'\"` pattern in the Caddyfile render step. It will hit the same parse error on the next deploy run. Not patched in this commit (out of scope, separately tracked in the v2 history).

When the operator re-ran the build workflow, the same parse error text reappeared. The run log they pasted (the original `images.yml` symptom) was a **stale log from before commit `4587e78` was pushed**; the live `main` already had the `images.yml` Variant D fix (verified via `git show HEAD:.github/workflows/images.yml`). The real, still-present failure was in `deploy.yml:173–174`.

## 2. Evidence

| Source | Observation |
|---|---|
| `git grep -nE "tr -d" .github/workflows/deploy.yml` | Two matches at lines 173 and 174, each `tr -d '"' | tr -d \"'\"` (the unparseable form). |
| `bash -n` of an extracted copy of the unpatched `run:` block | `unexpected EOF while looking for matching ')'` exit 2 — same root cause as `images.yml`, different line number reported because the closing `)` of the `$(...)` is the first thing bash runs out of. |
| `git show HEAD:.github/workflows/images.yml` (control) | Already contains `tr -d $'\"\047'` (Variant D, fixed in 4587e78); confirms `images.yml` is fine and the second log emission was a stale view. |

## 3. Root cause

Identical to the `images.yml` bug: inside `$(...)`, `tr -d \"'\"` opens an unterminated single-quoted string. The two substitutions (`tr -d '"'` then `tr -d \"'\"`) read like a clean two-step, but the second one parses to `\"` (literal `"`) + `'` (opens SQ) + `\"` (literal, inside SQ), so bash hits EOF still looking for `'`.

Unlike `images.yml` (where the `domain=…` assignment was missing in addition), `deploy.yml` already had the `domain=`/`acme_email=` assignments; only the `tr` quote characters were broken. So this fix is **smaller**: one shell variable + two single-line command substitutions.

## 4. The fix

The `Render Caddyfile` step now reads:

```yaml
- name: Render Caddyfile
  run: |
    set -euo pipefail
    # Strip surrounding quotes (if any) from the DOMAIN / ACME_EMAIL values
    # written to infra/.env by the previous step. The two characters to
    # strip are `"` and `'`. Inside `$(...)` a literal `'` is impossible
    # to pass without one of { ANSI-C `$'\047'`, an intermediate shell
    # var, or switching to `awk`. We use the ANSI-C form so the source
    # line parses cleanly; do not "simplify" `\047` back to a literal `'`,
    # that regresses to `unexpected EOF while looking for matching ''`.
    _quote_chars=$'\"\047'
    domain="$(grep -E '^DOMAIN=' infra/.env | head -n1 | cut -d= -f2- | tr -d "$_quote_chars")"
    acme_email="$(grep -E '^ACME_EMAIL=' infra/.env | head -n1 | cut -d= -f2- | tr -d "$_quote_chars")"
    ...
```

Why the `_quote_chars` indirection here (different from `images.yml`, which inlines `$'\"\047'` directly): in `deploy.yml` the same character set is used twice (DOMAIN and ACME_EMAIL), and the indentation makes a 100-char single line hard to read. A named shell variable collapses both substitutions to one tidy line each and makes the intent obvious. The trap comment stays above so a future "simplify" doesn't inline a literal `'` into the var.

## 5. Validation

| Check | Result |
|---|---|
| `python -c "yaml.safe_load(open('.github/workflows/deploy.yml'))"` | parses |
| `bash -n` of the extracted patched `run:` block | exit 0 |
| End-to-end run against a fixture `infra/.env` + `infra/caddy/Caddyfile` | exits 0, `Caddyfile rendered for DOMAIN=example.com.` |
| The original two-`tr` line, run in isolation | reproduces `unexpected EOF …` (test is sensitive) |
| `git grep -nE "tr -d \"\\\\'\"" .github/workflows/` | no remaining matches in either workflow |

## 6. Why the bug was not caught in the v2 milestone's "follow-up" list

The v2 milestone correctly **flagged** the `deploy.yml` follow-up but the actual edit to fix it was out of scope and was not made there — exactly as the milestone stated. This entry closes the loop. The next GH deploy run will exercise the patched step.

## 7. Follow-ups (still open)

- Add a `bash -n` pre-flight to both `images.yml` and `deploy.yml` (extract each `run:` block, syntax-check it). Would have caught both this and the original v1 bug at PR time.
- Consolidate the `INFRA_ENV` parser into a small `scripts/parse-infra-env.sh` used by both workflows, so the trap is encoded once.
- Consider rotating the workflow `INFRA_ENV_*` secret-bearing deployer account if the rendered `infra/.env` ever leaked via a dump step (out of scope here, but a reminder).
