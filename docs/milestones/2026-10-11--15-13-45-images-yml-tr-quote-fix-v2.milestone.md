# Milestone v2 — `images.yml` `tr` quoting (Variant D) + missing `domain=`

**Date:** 2026-10-11 15:13 UTC
**Status:** Applied locally; awaiting commit to `main`
**Files changed:** [`.github/workflows/images.yml`](../../.github/workflows/images.yml) — one `run:` block; one line of effective code plus an explanatory comment.

**Supersedes:** [v1 milestone](2026-10-11--14-39-30-images-yml-tr-quote-fix.milestone.md) — same bug, Variant A, never committed, and on-disk file had a second layered bug (missing `domain=` assignment) that v1 would not have caught.

---

## 1. Problem

The image-build workflow [`.github/workflows/images.yml`](../../.github/workflows/images.yml) failed its first shell step with `unexpected EOF while looking for matching ''` (exit 2), blocking every push to `dev` and every manual `workflow_dispatch` that ran the build. The downstream `deploy.yml` workflow depends on the images this workflow produces, so the deploy path was also blocked.

## 2. Evidence

| Source         | Observation                                                                                                                                                                                                                         |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GH Actions log | `/home/runner/work/_temp/<uuid>.sh: line 7: unexpected EOF while looking for matching ''`, exit 2.                                                                                                                                  |
| Local repro    | `bash -n` of the exact `domain=…` line from the runner produced the same error text and exit code.                                                                                                                                  |
| Tokenisation   | Inside `$(…)`, `tr -d \"'\"` parses as `\"` (literal `"`), `'` (opens SQ), `\"` (literal, inside SQ) — the SQ is never closed, so the closing `)` of `$(…)` is swallowed, so bash hits EOF.                                         |
| Second bug     | The on-disk `run:` block tested `[ -z "$domain" ]` but no longer assigned `$domain`. Without bug #1 masking it, bug #2 would have made the step fail at the guard with "DOMAIN is not set in INFRA_ENV_${app_env^^}." on every run. |

## 3. Solution

Restored the missing `domain=…` assignment and used ANSI-C quoting for the `tr` character set:

```bash
domain="$(printf '%s\n' "$INFRA_ENV" | grep -E '^DOMAIN=' | head -n1 | cut -d= -f2- | tr -d $'\"\047' || true)"
```

`$'\047'` is the octal code for `'`, so a literal `'` is **never typed** in the source. The two characters passed to `tr` are `"` and `'`. A 7-line comment above the line documents the trap so a future reviewer does not "simplify" `\047` back to `'` and reintroduce the bug.

## 4. Why Variant D over Variant A

| Criterion                            | Variant A (`_quote_chars="\"'"`)     | Variant D (`$'\"\047'`) — chosen                                            |
| ------------------------------------ | ------------------------------------ | --------------------------------------------------------------------------- |
| Effective code lines                 | 2                                    | 1                                                                           |
| New shell variable                   | yes                                  | no                                                                          |
| Diff in YAML                         | wider                                | narrower                                                                    |
| Robustness to "simplify this" review | fragile (extra var invites inlining) | opaque `\047` octal survives casual review                                  |
| Behavioural correctness              | 8/8 cases pass                       | 8/8 cases pass                                                              |
| Footgun if mis-edited                | regresses to original parse error    | regresses to a _different_ parse error, less likely to be misread as "fine" |

## 5. Verification

| Check                                                                                                                   | Result                                            |
| ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| `python -c "yaml.safe_load(open('.github/workflows/images.yml'))"`                                                      | parses                                            |
| `bash -n` of the extracted `run:` block                                                                                 | no error                                          |
| 8-case bash unit test (unquoted, dq-wrapped, sq-in-value, dq-in-value, both-quotes, with-noise, no-domain, trailing-eq) | 8/8 PASS                                          |
| Original buggy `tr -d \"'\"` line, run in isolation                                                                     | reproduces `unexpected EOF …` (test is sensitive) |
| Guard `if [ -z "$domain" ]` actually fires on the no-domain case                                                        | exits 1 with the expected error                   |

## 6. Outcome

- `images.yml` first step parses cleanly under bash, sets `domain` correctly, and exits non-zero with a clear message if the secret is missing or the line is malformed.
- The same `tr -d \"'\"` pattern in [`.github/workflows/deploy.yml:173–174`](../../.github/workflows/deploy.yml:173) is **not** fixed in this commit (out of scope, separately tracked). It will produce the same parse error on the next deploy workflow run.
- The earlier local history and milestone describing Variant A are kept for context but should be marked superseded when this v2 is merged.

## 7. Follow-ups

- Patch the matching `tr -d \"'\"` in `deploy.yml:173–174` with the same `tr -d $'\"\047'`.
- Add a `bash -n` pre-flight to both workflows (extract each `run:` block, syntax-check it before the runner does).
- Move the `INFRA_ENV` parse to a small script in `scripts/` so the trap is encoded once.
