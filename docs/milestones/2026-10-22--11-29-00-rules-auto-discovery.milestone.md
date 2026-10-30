# `.roo/rules` auto-discovery in the init scripts

**Date:** 2026-10-22 · **Scope:** `scripts/init.ps1`, `scripts/init.sh`, `scripts/README.md`

## Problem

Both agent-instruction generators (`init.ps1`, `init.sh`) concatenated a hardcoded list of three
rule files. `.roo/rules/` had grown to five, so `react.coding-standards.md` and
`ts.coding-standards.md` were silently absent from every generated instruction file, and each new
rule file needed a code change in two scripts.

## Evidence

```text
.roo/rules/  ->  general.coding-standards.md, instructions.md, project-context.md,
                 react.coding-standards.md, ts.coding-standards.md   (5 files)
$SourceFiles ->  instructions.md, general.coding-standards.md, project-context.md  (3 files)
```

Additionally, `powershell -File scripts/init.ps1` aborted at the write step on Windows:

```text
[x] Váratlan hiba: Parameter set cannot be resolved using the specified named parameters.
```

## Root cause

1. The source set was a literal array instead of a directory listing — a maintenance liability.
2. Windows PowerShell 5.1 has **no `-LiteralPath`** on `Split-Path` or `New-Item`, so `Write-Target`
   threw `ParameterBindingException` on every run (the script had therefore never produced a file
   on this workstation, and the Cursor run additionally failed on `New-Item` because the
   `.cursor/rules/` directory did not exist yet).
3. Independently, the two scripts disagreed byte-wise: bash emitted the literal text
   `\xe2\x80\x94` instead of an em dash, dropped trailing blank lines, wrote no final newline,
   while PowerShell added a UTF-8 **BOM** and CRLF — the BOM breaks the Cursor `.mdc` frontmatter.
   These mismatches also made `.gitignore` entries duplicate (CRLF line ≠ LF line match).

## Design decision

- **Discovery**: every `*.md` directly under `.roo/rules/` (non-recursive, zero-byte and `~$*`
  temp files skipped).
- **Ordering**: `instructions.md` first, then all remaining files alphabetically — the general
  instructions must precede the specialised coding standards; `LC_ALL=C` in bash, case-insensitive
  sort in PowerShell so both agree.
- **No config file, no CLI flags** (the script stays interactive): adding a rule file must require
  zero script edits, and no second source of truth is introduced.
- **Byte-identical output** from both scripts (UTF-8 no BOM, LF, one trailing newline, identical
  header comment) so switching platform does not churn the generated file.

## Implementation

| File                | Change                                                                                                                                                                                                                                         |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `scripts/init.ps1`  | `$SourcePattern`/`$PrimarySourceName` constants; `Get-RuleSourceNames()` discovery + ordering; warning on missing `instructions.md`, fatal on empty dir; LF/no-BOM writes; `Split-Path -Path` + `New-Item -Path` fixes; diagnostics in `catch` |
| `scripts/init.sh`   | `SOURCE_PATTERN`/`PRIMARY_SOURCE_NAME` + `discover_source_files()`; sentinel read preserving trailing blank lines; `${EM_DASH}` via ANSI-C quoting; CRLF-tolerant `.gitignore` match                                                           |
| `scripts/README.md` | Documents the discovery + ordering contract                                                                                                                                                                                                    |

## Outcome & verification

Generated files now contain all five sources in the order
`instructions.md`, `general.coding-standards.md`, `project-context.md`,
`react.coding-standards.md`, `ts.coding-standards.md`, and both scripts produce identical bytes.

```bash
powershell -File scripts/test-syntax.ps1     # OK
bash -n scripts/init.sh                      # OK
scripts/init.ps1   # pick an agent -> 5 "## Source:" sections
scripts/init.sh    # same choice -> "A célfájl már naprakész" (idempotent cross-script)
diff <ps1 output> <sh output>                # empty
```

Edge cases exercised: missing `instructions.md` (warning, still generates), empty `.roo/rules/`
(exit 1 in both), temporary `zz-test.md` (picked up last).

## Follow-ups

- Sub-directories of `.roo/rules/` are still ignored; extend the helper if a nested layout appears.
- `scripts/init.ps1` and `scripts/init.sh` must stay in sync — any change to the header text or
  ordering has to be mirrored in both, otherwise the byte-identity guarantee (and the cross-script
  idempotency) breaks.
