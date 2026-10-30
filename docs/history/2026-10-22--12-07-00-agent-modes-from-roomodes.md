# 2026-10-22 12:07 — Zoo Code modes → Copilot / Cursor / Claude artefacts

## Trigger

The `jira-ticket-writer` custom mode existed only in Zoo Code's **global** state (JetBrains plugin
storage: `%APPDATA%\JetBrains\WebStorm2025.2\options\zoo-code-extension-storage.xml`, entry
`WeCode-AI.zoo-code` → JSON `customModes[]`). The VS Code-side
`…/globalStorage/zoocodeorganization.zoo-code/settings/custom_modes.yaml` was empty, so the mode was
invisible to any other agent and to other machines. The mode was moved to the repo root
[`.roomodes`](../../.roomodes:1) (project-level, `source: project`), and the init scripts had to
learn how to project it onto the other agents.

## What changed

| File                                                                | Change                                                                                                                                                                                                                      |
| ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `scripts/lib/agent-artifacts/generate.mjs`                          | New CLI (`--agent copilot\|cursor\|claude`, `--check`, `--dry-run`, `--root`): renders the instruction file plus the mode artefacts of the selected agent and writes them. Exit codes `0` / `1` / `2` (stale in `--check`). |
| `scripts/lib/agent-artifacts/yaml-lite.mjs`                         | Dependency-free YAML subset parser (maps, sequences, block scalars `\|`/`>`/`-`, flow lists, quotes, comments) with line-numbered errors.                                                                                   |
| `scripts/lib/agent-artifacts/roomodes.mjs`                          | `.roomodes` loader + validation (required fields, known tool groups, duplicate slugs).                                                                                                                                      |
| `scripts/lib/agent-artifacts/tools.mjs`                             | Zoo `groups` → Copilot / Claude tool identifiers.                                                                                                                                                                           |
| `scripts/lib/agent-artifacts/render-copilot.mjs`                    | `.github/chatmodes/<slug>.chatmode.md`.                                                                                                                                                                                     |
| `scripts/lib/agent-artifacts/render-claude.mjs`                     | `.claude/agents/<slug>.md`.                                                                                                                                                                                                 |
| `scripts/lib/agent-artifacts/render-cursor.mjs`                     | `.cursor/commands/<slug>.md` + `.cursor/rules/<slug>.mdc` (`alwaysApply: false`).                                                                                                                                           |
| `scripts/lib/agent-artifacts/render-body.mjs`                       | Shared `## Role` / `## When to use` / `## Workflow` body and helpers.                                                                                                                                                       |
| `scripts/lib/agent-artifacts/writer.mjs`                            | Idempotent writer (UTF-8 no BOM, LF, one trailing newline, `.bak`) + `.gitignore` synchroniser.                                                                                                                             |
| `scripts/lib/agent-artifacts/overrides.mjs` + `mode-overrides.json` | Per-mode `emit` and tool-list overrides (kept out of `.roomodes`, which must stay valid Zoo Code schema).                                                                                                                   |
| `scripts/init.sh`, `scripts/init.ps1`                               | Reduced to thin wrappers: repo-root resolution, `node` pre-flight, agent menu, then `node generate.mjs --agent <choice>`. All duplicated rendering/writing/gitignore code removed (~250 lines of shell).                    |
| `package.json`                                                      | `test:agents` → `node --test scripts/lib/agent-artifacts/`.                                                                                                                                                                 |
| `scripts/README.md`                                                 | New layout entry + rewritten init section (sources, outputs, CLI, exit codes, gitignore contract).                                                                                                                          |
| `docs/Specs/AI-Agent-Artifacts.md`                                  | New living spec for the pipeline.                                                                                                                                                                                           |

## Deviations from the plan

- **No `yaml` package.** `pnpm add -D yaml -w` fails in this workspace
  (`ERR_PNPM_VIRTUAL_STORE_DIR_MAX_LENGTH_DIFF`, would require recreating `node_modules`). Instead
  `yaml-lite.mjs` implements exactly the subset a `.roomodes` file uses, with 12 unit tests. If the
  package is added later, only that one module changes.
- **`.github/chatmodes/` and `.claude/agents/` are generated, not hand-written** — same policy as
  the existing instruction files (gitignored, regenerated from the sources).
- `init.ps1` needed a UTF-8 **BOM**: without it Windows PowerShell 5.1 parses the file as ANSI and
  the Hungarian messages break the string literals ("The string is missing the terminator"). The
  file is written with BOM again.

## Verified

```text
node --test scripts/lib/agent-artifacts/        -> 34 tests, 0 failures
bash -n scripts/init.sh                         -> OK
powershell -File scripts/test-syntax.ps1        -> OK
printf '1\n' | bash scripts/init.sh             -> .github/copilot-instructions.md
                                                   + .github/chatmodes/jira-ticket-writer.chatmode.md
printf '2\n' | bash scripts/init.sh             -> .cursor/commands/jira-ticket-writer.md
                                                   + .cursor/rules/jira-ticket-writer.mdc
                                                   + .cursor/rules/project.mdc (unchanged -> parity with the old generator)
printf '3\n' | bash scripts/init.sh             -> CLAUDE.md + .claude/agents/jira-ticket-writer.md
echo 3 | powershell -File scripts/init.ps1      -> same files, same bytes
second run                                      -> "A célfájl már naprakész" (idempotent)
grep -cxF <path> .gitignore                     -> 1 for every generated file (no duplicates)
git check-ignore -v <generated file>            -> resolves to the marker section
git check-ignore -v .roomodes                   -> not ignored (stays tracked)
```

## Manual follow-up (not done by the script)

Delete the global copy of the mode (Zoo Code → Modes → Edit modes → `Jira Ticket Writer` → Delete)
so the slug exists exactly once. Fallback only with WebStorm closed, after backing up
`zoo-code-extension-storage.xml`.
