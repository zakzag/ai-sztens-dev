# AI Agent Artefacts

**Utolsó frissítés:** 2026-10-22

Living specification for how the repository feeds the coding agents (Zoo Code, GitHub Copilot,
Cursor, Claude Code). Source of truth for the sources, the generated files and the rules that
govern them.

## 1. Roles

```text
authored (tracked)                     generated (gitignored, except .roomodes)
├── .roo/rules/*.md            ──┐
├── .roomodes                    ├──> scripts/lib/agent-artifacts/generate.mjs ──> per-agent files
└── scripts/lib/agent-artifacts/ ┘
    └── mode-overrides.json
```

| Kind                    | Files                                                                                                                        | Tracked             | Who writes it                                         |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------- | ----------------------------------------------------- |
| Rules                   | `.roo/rules/*.md`                                                                                                            | yes                 | humans                                                |
| Modes                   | `.roomodes` (repo root)                                                                                                      | yes                 | the Zoo Code UI (or humans) — **never** the generator |
| Overrides               | `scripts/lib/agent-artifacts/mode-overrides.json`                                                                            | yes                 | humans                                                |
| Generator               | `scripts/lib/agent-artifacts/*.mjs`                                                                                          | yes                 | humans                                                |
| Agent instruction files | `.github/copilot-instructions.md`, `.cursor/rules/project.mdc`, `CLAUDE.md`                                                  | **no** (gitignored) | the generator                                         |
| Agent mode artefacts    | `.github/chatmodes/<slug>.chatmode.md`, `.cursor/commands/<slug>.md`, `.cursor/rules/<slug>.mdc`, `.claude/agents/<slug>.md` | **no** (gitignored) | the generator                                         |

## 2. Entry points

| Entry point                                                                       | Purpose                                                                |
| --------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `scripts/init.sh` (bash)                                                          | interactive wrapper: agent menu → `node generate.mjs --agent <choice>` |
| `scripts/init.ps1` (Windows PowerShell)                                           | same, byte-for-byte identical output                                   |
| `node scripts/lib/agent-artifacts/generate.mjs --agent <copilot\|cursor\|claude>` | non-interactive generation                                             |
| `--check`                                                                         | no writes; exit `2` when any artefact is stale (CI guard)              |
| `--dry-run`                                                                       | no writes; prints what would be written                                |
| `pnpm test:agents`                                                                | `node --test scripts/lib/agent-artifacts/`                             |

Requirements: Node.js on `PATH`. The generator has **no third-party dependencies** — the YAML
subset parser (`yaml-lite.mjs`) covers what a `.roomodes` file contains.

## 3. Rules pipeline (`.roo/rules` → instruction file)

- Sources: every `*.md` directly under `.roo/rules/` (non-recursive); zero-byte files and `~$*`
  temp files are skipped.
- Order: `instructions.md` first, then byte order (`a < b`), so the general rules precede the
  specialised standards.
- Each source renders as `---` + `## Source: <path>` + verbatim content.
- Cursor additionally gets the `.mdc` frontmatter (`globs:` empty, `alwaysApply: true`).
- Missing `instructions.md` → warning only; no `*.md` at all → error (exit 1).

## 4. Modes pipeline (`.roomodes` → per-agent artefacts)

`.roomodes` stays in the Zoo Code schema. The generator reads it and maps each mode to the
closest native equivalent of that product:

| Agent          | Artefact                               | Frontmatter                                   | Semantics                   |
| -------------- | -------------------------------------- | --------------------------------------------- | --------------------------- |
| Zoo Code       | `.roomodes` (the source itself)        | —                                             | native custom mode          |
| GitHub Copilot | `.github/chatmodes/<slug>.chatmode.md` | `description`, `tools`                        | selectable chat mode        |
| Cursor         | `.cursor/commands/<slug>.md`           | —                                             | invocable `/<slug>` command |
| Cursor         | `.cursor/rules/<slug>.mdc`             | `description`, `globs:`, `alwaysApply: false` | on-demand rule              |
| Claude Code    | `.claude/agents/<slug>.md`             | `name`, `description`, `tools`                | project subagent            |

Body (shared by all artefacts): `## Role` (`roleDefinition`), `## When to use` (`whenToUse`),
`## Workflow` (`customInstructions`, omitted when empty).

### 4.1 Tool mapping

Zoo Code `groups` → agent tool identifiers (`tools.mjs`). Verify against the product docs on every
agent upgrade.

| Zoo group | Copilot `tools`                            | Claude `tools`                                |
| --------- | ------------------------------------------ | --------------------------------------------- |
| `read`    | `codebase`, `search`, `usages`, `problems` | `Read`, `Grep`, `Glob`                        |
| `edit`    | `editFiles`                                | `Edit`, `Write`                               |
| `command` | `runCommands`, `runTasks`                  | `Bash`                                        |
| `browser` | `fetch`                                    | `WebFetch`, `WebSearch`                       |
| `mcp`     | `mcpServers`                               | `mcp__*` (default), explicit list recommended |

### 4.2 Overrides

`mode-overrides.json` (keyed by mode slug) allows, without touching the Zoo Code schema:

```json
{
  "jira-ticket-writer": {
    "emit": [
      "copilot-chatmode",
      "claude-agent",
      "cursor-command",
      "cursor-rule"
    ],
    "copilotTools": ["codebase", "editFiles", "runCommands", "mcpServers"],
    "claudeTools": ["Read", "Edit", "Bash", "mcp__atlassian"]
  }
}
```

- `emit` — which artefacts to generate (unknown values are rejected),
- `copilotTools` / `claudeTools` — full replacement of the computed tool list.

## 5. Write contract

- UTF-8 **without BOM**, LF line endings, exactly one trailing newline.
- Idempotent: byte-identical content is not rewritten (`A célfájl már naprakész`).
- Changed content: the previous file is kept next to it as `<path>.bak` (single, overwritten).
- `--check` never writes; it reports `Elavult: <path>` and exits `2`.

## 6. `.gitignore` contract

The generator appends **every generated path and its `.bak`** to the section

```text
# --- AI agent instruction files (autogenerated by scripts/init.*) ---
# Source of truth: .roo/rules/ and .roomodes
```

- idempotent (an existing line is never duplicated; CRLF entries from older Windows runs match),
- the marker section is created when missing, the file is rewritten with LF/no BOM,
- **`.roomodes` is never added** — it is the authored source and stays tracked,
- a missing `.gitignore` only produces a warning.

## 7. Do / don't

| Do                                                                    | Don't                                                                                              |
| --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Edit `.roo/rules/*.md` and `.roomodes`                                | Edit `CLAUDE.md`, `project.mdc`, `*.chatmode.md`, `.claude/agents/*`, `.cursor/commands/*` by hand |
| Re-run `scripts/init.sh` / `scripts/init.ps1` after changing a source | Copy a mode definition into an agent file manually                                                 |
| Put generator-specific settings into `mode-overrides.json`            | Add unknown keys to `.roomodes` (the Zoo Code UI may drop them)                                    |
| Use `--check` in CI to detect stale artefacts                         | Commit generated artefacts                                                                         |

## 8. Related documents

- [`scripts/README.md`](../../scripts/README.md:1) — script index and CLI details.
- [`docs/plans/2026-10-22--11-48-30-jira-mode-project-migration-plan.md`](../plans/2026-10-22--11-48-30-jira-mode-project-migration-plan.md:1)
  — the migration plan that introduced this pipeline.
