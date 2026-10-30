# Milestone — `images.yml` `tr -d` quoting fix

**Date:** 2026-10-11
**Status:** Fixed locally; awaiting commit to `main`
**Files changed:** [`.github/workflows/images.yml`](../../.github/workflows/images.yml) (one line, plus explanatory comment)

---

## 1. Problem

The image-build workflow [`.github/workflows/images.yml`](../../.github/workflows/images.yml) failed its first shell step with:

```
/home/runner/work/_temp/<uuid>.sh: line 7: unexpected EOF while looking for matching `''
```

exit code 2. The run failed before any image was pushed to GHCR, so the
droplet deploy that depends on those images could not proceed.

## 2. Evidence

| Source             | Observation                                                                                                                                                                                              |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Workflow run log   | `Run set -euo pipefail` followed by `unexpected EOF …` on line 7 of the runner's temp script, exit 2.                                                                                                    |
| Local repro        | Copying the same `run:` block to a `.sh` file and running under `bash 5.2.37` reproduced the same error text and exit code.                                                                              |
| Tokenisation trace | Inside `$(...)` the token `tr -d \"'\"` produces `\"` (literal `"`) then `'` (opens a SQ) then `\"` (literal, inside the SQ) — the SQ is never closed, so the closing `)` of `$(...)` is also swallowed. |

## 3. Root cause

[`images.yml:111`](../../.github/workflows/images.yml:111) tried to
strip both single and double quotes from the parsed `DOMAIN` value
using two `tr` invocations. The first one (`tr -d '"'`) is fine. The
second one (`tr -d \"'\"`) is unparseable inside a `$(...)`: a single
quote always opens a single-quoted string, regardless of any
surrounding double quote. The string runs to EOF and bash aborts.

## 4. Solution

Store the two-character set in a shell variable and let the outer
double-quoted `$(...)` expand it:

```bash
_quote_chars="\"'"
domain="$(printf '%s\n' "$INFRA_ENV" | grep -E '^DOMAIN=' | head -n1 | cut -d= -f2- | tr -d "$_quote_chars" || true)"
```

A multi-line comment above these two lines explains the trap so future
"simplifications" do not regress it. The change is two lines plus the
comment; nothing else in the workflow is touched.

## 5. Verification

| Check                                                                                                                                     | Result                                                                  |
| ----------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `python -c "yaml.safe_load(open('images.yml'))"`                                                                                          | parses cleanly                                                          |
| 8-case bash unit test of the fixed line (unquoted, dq-wrapped, sq-in-value, dq-in-value, both-quotes, with-noise, no-domain, trailing-eq) | 8/8 PASS                                                                |
| Original buggy line, run in isolation                                                                                                     | reproduces `unexpected EOF …` (proves the test is sensitive to the bug) |

The fix is local to the working copy. To activate it: `git add
.github/workflows/images.yml docs/history/2026-10-11--14-39-17-images-yml-tr-quote-fix.md
docs/milestones/2026-10-11--14-39-30-images-yml-tr-quote-fix.milestone.md`
and merge.

## 6. Follow-ups

- A `bash -n` pre-flight over each `run:` block in `images.yml` and
  `deploy.yml` would catch the next quoting bug before the runner does.
- Long-term: move the `INFRA_ENV` parse to a small `awk`/`bash` script
  in `scripts/` so the workflow's `run:` blocks stay trivial.
- `INFRA_ENV_DEV` / `INFRA_ENV_PROD` validation could be stricter than
  the current `cut | head | tr` pipeline.
