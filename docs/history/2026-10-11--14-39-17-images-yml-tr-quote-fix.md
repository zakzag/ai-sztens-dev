# Fix — `.github/workflows/images.yml` `tr -d` quoting (EOF parser abort)

**Date:** 2026-10-11 14:39 UTC
**Branch:** local working copy of `main` (4 commits behind `origin/main`)
**Files touched:** [`.github/workflows/images.yml`](../../.github/workflows/images.yml)

---

## 1. Symptom

Running the image-build workflow (`Build and push images`) failed at the
first step that has a shell `run:` block:

```
***[group]Run set -euo pipefail
/home/runner/work/_temp/5aa870a1-6f26-43a8-8f6a-d95de6534d25.sh: line 7: unexpected EOF while looking for matching `''
***[error]Process completed with exit code 2.
```

The error message blamed line 7, but the actual bug was on the line
ending in `tr -d \"'\"`. Bash reports the line where the parser finally
ran out of input, not the line where the unterminated quote was opened.

## 2. Root cause

[`images.yml:111`](../../.github/workflows/images.yml:111) in the
`Resolve APP_ENV and parse DOMAIN` step read:

```bash
domain="$(printf '%s\n' "$INFRA_ENV" | grep -E '^DOMAIN=' | head -n1 | cut -d= -f2- | tr -d '"' | tr -d \"'\" || true)"
```

The intent of the second `tr` was `tr -d "'"` (strip single quotes).
Inside a `$(...)` command substitution the author wrote `tr -d \"'\"`,
but tokenisation of the inner string is:

- `\"` → escaped double quote, becomes a literal `"`.
- `'` → **opens a single-quoted string** that never closes.
- `\"` → inside `'...'`, both characters are literal.

The single-quoted string swallows the rest of the line including the
closing `)` of the `$(...)`. Bash therefore hits EOF still looking for
the matching `'` and aborts. The first `tr -d '"'` is fine; the second
is what is broken.

I confirmed the analysis by extracting the exact line, dropping it into
a standalone `.sh`, and running it under `bash 5.2.37` — the same
`unexpected EOF while looking for matching `''`` (sometimes reported
as `)`) appeared at the right script line.

## 3. First attempt and why it failed

I initially replaced the second `tr` with a single
`tr -d "\"'\"`, reasoning that `"\""` is a DQ-quoted `"` and the bare
`'` would be closed by the surrounding DQ. This was wrong: a `'` is
`'` regardless of any surrounding DQ — the SQ it opens is closed only
by another `'`. The single-`tr` form was unparseable for the same
reason as the original two-`tr` form.

## 4. The actual fix (Variant A: pre-stored quote set)

The two characters `"` and `'` cannot be passed as a single `tr`
argument inside a `$(...)` without one of them escaping the other
quoting context. The cleanest workaround is to store them in a shell
variable and let the outer DQ expand the variable:

```bash
_quote_chars="\"'"
domain="$(printf '%s\n' "$INFRA_ENV" | grep -E '^DOMAIN=' | head -n1 | cut -d= -f2- | tr -d "$_quote_chars" || true)"
```

`tr` then receives the two-character set `"` and `'`. A long comment
above the two lines explains the trap so the next reader does not
"simplify" it back into a single-`tr` form.

## 5. Alternatives considered (validated locally, not chosen)

| Variant | Form                                                          | Verdict                                                                                        |
| ------- | ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| B       | `awk -F= '/^DOMAIN=/{gsub(/["\047]/,"",$2); print $2; exit}'` | Works; `gsub` deletes both characters; the `\047` octal avoids any single-quote-in-SQ problem. |
| D       | `tr -d $'"\047"'` (ANSI-C quoting)                            | Works; one line change, no extra variable.                                                     |
| A       | `tr -d "$_quote_chars"` with `_quote_chars="\"'"`             | **Chosen** — smallest diff, intent obvious, no language tricks.                                |

## 6. Validation

Standalone test with the exact line copied verbatim from the workflow,
8/8 cases pass:

| Case        | Input `INFRA_ENV`                 | Expected `domain` | Got               |
| ----------- | --------------------------------- | ----------------- | ----------------- |
| unquoted    | `DOMAIN=example.com`              | `example.com`     | `example.com`     |
| dq-wrapped  | `DOMAIN="example.com"`            | `example.com`     | `example.com`     |
| sq-in-value | `DOMAIN=it's-me.com`              | `its-me.com`      | `its-me.com`      |
| dq-in-value | `DOMAIN=he"said.com`              | `hesaid.com`      | `hesaid.com`      |
| both-quotes | `DOMAIN=a'b"c.com`                | `abc.com`         | `abc.com`         |
| with-noise  | `A=1\nDOMAIN=multi.host.com\nB=2` | `multi.host.com`  | `multi.host.com`  |
| no-domain   | `X=y`                             | (empty)           | (empty)           |
| trailing-eq | `DOMAIN=multi.host.com=`          | `multi.host.com=` | `multi.host.com=` |

Also `python -c "yaml.safe_load(...)"` confirms the workflow YAML
parses cleanly after the change.

## 7. Why this was not caught earlier

The merge that introduced the workflow (commit `a6310f7`, on
`docker-container-for-everything`) was reviewed and the more visible
`upper()` bug was fixed in `a0accd0`, but the `tr -d \"'\"` line
parsed correctly in YAML and only fails at runtime when bash gets hold
of it. The two-`tr` form looked fine to a casual reader and only the
runner exposed it. Future change to the same line should preserve the
`_quote_chars` indirection or switch to Variant B (`awk`).

## 8. Follow-ups

- Consider moving DOMAIN parsing to a small `bash` or `awk` script under
  `scripts/` so a typo here cannot break the whole image pipeline.
- Add a `bash -n` pre-flight to `images.yml` (e.g. extract each `run:`
  block and syntax-check it) — out of scope for this fix.
- The `INFRA_ENV_DEV` / `INFRA_ENV_PROD` secrets are still very large
  multi-line strings; `INFRA_ENV` validation in the same step could
  catch missing `DOMAIN=` earlier than the current `cut | head | tr`
  pipeline.
