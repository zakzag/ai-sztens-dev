# 2026-10-22 11:29 — `.roo/rules` auto-discovery in the init scripts

## Trigger

[`scripts/init.ps1`](../../scripts/init.ps1:1) (and its bash twin) concatenated a hardcoded
3-entry list of rule files. `.roo/rules/` now holds 5 files, so
`react.coding-standards.md` and `ts.coding-standards.md` never reached any generated agent
instruction file. Every new rule file would have required a code change in two scripts.

## What changed

| File | Change |
|---|---|
| [`scripts/init.ps1`](../../scripts/init.ps1:41) | `$SourceFiles` array replaced by `$SourcePattern = '*.md'` + `$PrimarySourceName = 'instructions.md'`; new `Get-RuleSourceNames()` enumerates the directory and orders `instructions.md` first, everything else alphabetically; `Get-PresentSourceFiles()` emits forward-slash paths, warns when the primary file is missing and still fails when no `*.md` is found. |
| [`scripts/init.ps1`](../../scripts/init.ps1:158) | `Build-Content` normalises the output to exactly one trailing newline; the "Regenerate by running" comment is now identical in both scripts. |
| [`scripts/init.ps1`](../../scripts/init.ps1:198) | `Write-Target` writes UTF-8 **without BOM**, line endings untouched (`Set-Content` on PS 5.1 added a BOM + CRLF; the BOM would break the Cursor `.mdc` frontmatter). |
| [`scripts/init.ps1`](../../scripts/init.ps1:234) | `Ensure-GitignoreEntry` reads CRLF-tolerantly and rewrites with LF/no BOM, so an entry written by either script is recognised (previously PS↔sh runs appended `CLAUDE.md` twice). |
| [`scripts/init.ps1`](../../scripts/init.ps1:88) | Fixed `Split-Path -LiteralPath` → `Split-Path -Path`: Windows PowerShell 5.1 has no `-LiteralPath` on `Split-Path`, so every write run died with *"Parameter set cannot be resolved"*. The `catch` block now also prints the failing line. |
| [`scripts/init.sh`](../../scripts/init.sh:36) | Same discovery contract: `SOURCE_PATTERN` / `PRIMARY_SOURCE_NAME` constants + `discover_source_files()`, consumed by `check_source_files()` (stdout = file list, stderr = logs, `LC_ALL=C sort`). |
| [`scripts/init.sh`](../../scripts/init.sh:191) | `build_content()` reads each source with an `x` sentinel so trailing blank lines survive the command substitution; `write_target()` always ends the file with one newline. |
| [`scripts/init.sh`](../../scripts/init.sh:41) | Em dash is now `$'\xe2\x80\x94'` via `readonly EM_DASH` — the old `"...\xe2\x80\x94..."` produced the literal text `\xe2\x80\x94` inside every generated file. |
| [`scripts/init.sh`](../../scripts/init.sh:265) | `.gitignore` lookups via `tr -d '\r' | grep -qxF` so CRLF entries from a Windows editor still match. |
| [`scripts/README.md`](../../scripts/README.md:57) | Documents the discovery contract and the ordering rule. |

## Verified

```
powershell -File scripts/test-syntax.ps1          # OK
bash -n scripts/init.sh                           # OK
scripts/init.ps1 + scripts/init.sh (Claude)       # 5 × "## Source:" in the expected order
diff <ps1 output> <sh output>                     # empty - byte-identical
scripts/init.sh twice / init.ps1 after init.sh    # "A célfájl már naprakész" (idempotent both ways)
missing instructions.md                           # warning, output still generated
empty .roo/rules                                  # exit code 1 in both scripts
temporary .roo/rules/zz-test.md                   # picked up, emitted last
```

Generated artifacts (`CLAUDE.md`, `CLAUDE.md.bak`) and the `.gitignore` section they add were
removed again after verification.

## Notes

- The plan lives in
  [`docs/plans/2026-10-22--11-15-29-rules-auto-discovery-plan.md`](../plans/2026-10-22--11-15-29-rules-auto-discovery-plan.md).
- Sub-directories of `.roo/rules/` are still ignored (flat layout is the convention).
