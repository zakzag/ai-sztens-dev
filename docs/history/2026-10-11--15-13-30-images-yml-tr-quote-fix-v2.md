# Fix v2 — `images.yml` `tr` quoting (Variant D) + missing `domain=` assignment

**Date:** 2026-10-11 15:13 UTC
**Files touched:**

- [`.github/workflows/images.yml`](../../.github/workflows/images.yml) — restored the `domain=…` pipeline, replaced the broken `tr -d \"'\"` with `tr -d $'\"\047'` (Variant D), added an explanatory comment that names the trap.
- [`docs/history/2026-10-11--15-13-30-images-yml-tr-quote-fix-v2.md`](2026-10-11--15-13-30-images-yml-tr-quote-fix-v2.md) — this entry.
- [`docs/milestones/2026-10-11--15-13-45-images-yml-tr-quote-fix-v2.milestone.md`](../milestones/2026-10-11--15-13-45-images-yml-tr-quote-fix-v2.milestone.md) — decision-grade summary.

**Supersedes (in spirit):** the earlier local-only `Variant A` plan from
[`docs/history/2026-10-11--14-39-17-images-yml-tr-quote-fix.md`](2026-10-11--14-39-17-images-yml-tr-quote-fix.md) and
[`docs/milestones/2026-10-11--14-39-30-images-yml-tr-quote-fix.milestone.md`](../milestones/2026-10-11--14-39-30-images-yml-tr-quote-fix.milestone.md) — that work described the right bug but
chose Variant A (extra `_quote_chars` shell var) and, on the on-disk
file at the time of the second session, was incomplete: the
`domain=…` assignment had been removed without restoring it, so
even with the quoting fixed, the step would exit 1 with "DOMAIN is
not set…" on every run.

---

## 1. Symptom (recap)

GitHub Actions run for `Build and push images` failed in step 1 with:

```
/home/runner/work/_temp/<uuid>.sh: line 7: unexpected EOF while looking for matching ''
Process completed with exit code 2.
```

Bash blames the line where input runs out, not where the unclosed
quote was opened; the unterminated `'` was actually inside the
`tr -d \"'\"` argument of the `domain=…` command substitution
earlier in the same `run:` block.

## 2. Root cause

Two layered bugs, both inside the same `run:` block of
[`.github/workflows/images.yml:96`](../../.github/workflows/images.yml:96):

| #   | Bug                                                                                                                                                | Effect                                                                                                                                       |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `tr -d \"'\"` inside `$(…)`                                                                                                                        | `'` opens an unterminated SQ; the closing `)` of `$(…)` is swallowed; bash aborts with `unexpected EOF`.                                     |
| 2   | The `domain=…` assignment was missing from the on-disk `run:` block (the guard `if [ -z "$domain" ]` was still there but `$domain` was never set). | Even after fix #1, the step would still exit 1 with "DOMAIN is not set in INFRA_ENV_${app_env^^}." on every run, breaking every image build. |

Both are required for the workflow to work end-to-end.

## 3. Local validation of the parsing trap

Extracted the exact line from the runner log (including the
unbalanced `tr -d \"'\"`) into `tmp-repro.sh` and ran:

```
$ bash -n tmp-repro.sh
tmp-repro.sh: line 4: unexpected EOF while looking for matching ''
```

Identical wording and code path to the GitHub runner error.
Confirmed it is a pure parser-level bug (one line, one missing
quote), not a missing-secret / wrong-env / runner-shell issue.

## 4. The fix

Replaced the `run:` block of the `Resolve APP_ENV and parse DOMAIN`
step with:

```bash
set -euo pipefail
app_env="${{ inputs.app_env || 'dev' }}"
if [ -z "$INFRA_ENV" ]; then
  echo "ERROR: INFRA_ENV_${app_env^^} secret is empty." >&2
  exit 1
fi
# Extract DOMAIN from the multi-line INFRA_ENV_* secret, stripping any
# surrounding quotes an operator may have added. DO NOT "simplify" the
# `tr` argument: inside `$(...)` a literal `'` is impossible to pass
# without one of { ANSI-C `$'\047'`, an intermediate shell var, or
# switching to `awk`. We use the ANSI-C form ($'\"\047' == " and ').
# A previous version used `tr -d \"'\"` here, which opened an
# unterminated single-quoted string at runtime and aborted parsing
# with `unexpected EOF while looking for matching ''` on the runner.
domain="$(printf '%s\n' "$INFRA_ENV" | grep -E '^DOMAIN=' | head -n1 | cut -d= -f2- | tr -d $'\"\047' || true)"
if [ -z "$domain" ]; then
  echo "ERROR: DOMAIN is not set in INFRA_ENV_${app_env^^}." >&2
  exit 1
fi
```

Rest of the step (the three `echo … >> "$GITHUB_OUTPUT"` lines) is
unchanged.

## 5. Why Variant D (`$'…'`) over Variant A (`_quote_chars`)

| Criterion                              | Variant A (`_quote_chars`)                    | Variant D (`$'…'`)                                                        |
| -------------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------- |
| Diff size                              | 2 lines + comment                             | 1 line (with embedded `\047`) + comment                                   |
| New shell variable                     | yes                                           | no                                                                        |
| Reads naturally in a YAML diff         | less so (extra indirection)                   | yes — the character set is visible inline                                 |
| Robust to future "simplify this" edits | fragile (someone may inline the two-char var) | the `\047` octal is opaque enough to survive casual review                |
| Equivalent behaviour                   | yes (validated 8/8)                           | yes (validated 8/8, see below)                                            |
| Footgun if "simplified"                | regresses to the original bug                 | regresses to a different parse error; less likely to be misread as "fine" |

Both variants are correct; Variant D was chosen because it is a
**smaller diff** and the `\047` octal makes accidental "cleanup"
harder. A long comment above the line documents the trap.

## 6. Validation (after the patch)

| Check                                                        | How                                                                                                    | Result                                                                         |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| YAML parses                                                  | `python -c "import yaml,sys;yaml.safe_load(open('.github/workflows/images.yml'));print('ok')"`         | ok                                                                             |
| The `run:` block parses under `bash -n`                      | extract block to a temp `.sh`, run `bash -n`                                                           | no error                                                                       |
| 8-case bash unit test of the new `tr` line                   | unquoted / dq-wrapped / sq-in-value / dq-in-value / both-quotes / with-noise / no-domain / trailing-eq | 8/8 pass (same fixture used by the v1 history)                                 |
| Original buggy line, run in isolation                        | `bash -n` of the old line                                                                              | reproduces `unexpected EOF …` (proves the test is sensitive to the regression) |
| The `[ -z "$domain" ]` guard actually catches the empty case | 8th case ("no-domain")                                                                                 | exits 1 with the expected error message                                        |

The tests are re-runnable from a Windows / bash-on-Windows shell;
the only non-portable piece was writing the fixture through
PowerShell here-strings, which we worked around by writing the
fixture to disk via `write_to_file` and then running `bash` against
it.

## 7. Why this was not caught earlier

| Layer         | What happened                                                                                                                                                                                                                                                  |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Review-time   | The two-`tr` form (`tr -d '"'` and `tr -d \"'\"`) reads plausibly to a human reviewer; the first `tr` is valid, so the eye does not check the second as carefully.                                                                                             |
| YAML parse    | The workflow file parses cleanly — the bug is a **runtime bash** bug, not a YAML quoting bug.                                                                                                                                                                  |
| Local repro   | The history file from the earlier session describes the same `bash -n` repro I re-ran, but the file was never committed, so the CI never saw the fix.                                                                                                          |
| Secondary bug | The `domain=…` assignment was silently lost in a subsequent edit; the `[ -z "$domain" ]` guard remained, so the workflow would have failed at the guard, not at parse time, and that failure was masked by the earlier parse-time failure (which fires first). |

## 8. Follow-ups

- Same `tr -d \"'\"` pattern lives in `.github/workflows/deploy.yml:173–174`. Apply the same `tr -d $'\"\047'` fix there (out of scope for this commit but flagged for the next).
- Add a `bash -n` pre-flight to both workflows (extract each `run:` block, syntax-check it) — would have caught this at PR time.
- Long-term: move the `INFRA_ENV` parse to a small `awk`/`bash` script under `scripts/` so workflow `run:` blocks stay trivial and the trap is encoded once.
