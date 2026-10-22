# Zoo Code modes projected onto Copilot, Cursor and Claude Code

**Date:** 2026-10-22 · **Scope:** `.roomodes`, `scripts/lib/agent-artifacts/`, `scripts/init.*`, `docs/Specs/AI-Agent-Artifacts.md`

## Problem / feature

The `jira-ticket-writer` Zoo Code custom mode lived only in Zoo Code's **global** state and was
therefore invisible to GitHub Copilot, Cursor and Claude Code. Needed: move the mode to project
level and make the init scripts project every `.roomodes` mode onto the other agents.

## Evidence

| Location | State before |
| --- | --- |
| repo `.roomodes` | absent |
| `%APPDATA%\JetBrains\WebStorm2025.2\options\zoo-code-extension-storage.xml` → entry `WeCode-AI.zoo-code` | contained the mode (JSON `customModes[]`) |
| `…/Code/User/globalStorage/zoocodeorganization.zoo-code/settings/custom_modes.yaml` | `customModes: []` |

The mode is now project-level in the root `.roomodes` (`source: project`).

## Design rationale

- **Root `.roomodes` stays the single source of truth** — it is what Zoo Code itself reads, and the
  UI edits it. The generator therefore *reads* it and never writes it, so the UI and the script can
  never fight over the same file.
- **One Node implementation behind both wrappers.** Rendering in PowerShell *and* bash had already
  produced three classes of divergence (BOM, CRLF, duplicated `.gitignore` lines); the mode pipeline
  would have doubled that. `init.sh` / `init.ps1` are now thin interactive wrappers around
  `generate.mjs`, and the earlier byte-identity hacks disappeared with the duplicated code.
- **No YAML dependency.** `pnpm add -D yaml -w` fails in this workspace
  (`ERR_PNPM_VIRTUAL_STORE_DIR_MAX_LENGTH_DIFF`); `yaml-lite.mjs` implements the subset a
  `.roomodes` file uses (12 tests). Swapping in the package later touches one module.
- **Honest per-agent mapping.** Copilot has chat modes, Claude has subagents, Cursor has neither —
  it gets a `/<slug>` command plus an on-demand `.mdc` rule (`alwaysApply: false`). No agent is
  forced into a fake "mode".
- **Generator-only settings live in `mode-overrides.json`**, not in `.roomodes`: the Zoo Code UI may
  rewrite that file and drop unknown keys.

## Implementation

| File | Change |
| --- | --- |
| `scripts/lib/agent-artifacts/generate.mjs` | CLI: `--agent`, `--root`, `--dry-run`, `--check` (exit 2 = stale) |
| `…/yaml-lite.mjs` | dependency-free YAML subset parser |
| `…/roomodes.mjs` | `.roomodes` loader + validation (required fields, groups, duplicate slug) |
| `…/tools.mjs`, `…/overrides.mjs`, `…/mode-overrides.json` | group → tool mapping, per-mode overrides |
| `…/render-body.mjs`, `…/render-copilot.mjs`, `…/render-claude.mjs`, `…/render-cursor.mjs` | artefact renderers |
| `…/rules.mjs` | `.roo/rules/*.md` discovery + instruction-file rendering (moved out of the shells) |
| `…/writer.mjs` | idempotent write, `.bak`, `.gitignore` sync (and `.bak` pairs, CRLF-tolerant, never `.roomodes`) |
| `scripts/init.sh`, `scripts/init.ps1` | thin wrappers (menu + `node` pre-flight); `init.ps1` re-saved with a UTF-8 BOM (PS 5.1 needs it) |
| `package.json` | `test:agents` |
| `scripts/README.md`, `docs/Specs/AI-Agent-Artifacts.md` | documentation |

## Outcome and how to verify

```bash
pnpm test:agents                                  # 34 tests green
printf '1\n' | bash scripts/init.sh               # Copilot: instructions + chatmode
printf '2\n' | bash scripts/init.sh               # Cursor: project.mdc + command + rule
printf '3\n' | bash scripts/init.sh               # Claude: CLAUDE.md + subagent
echo 3 | powershell -File scripts/init.ps1        # same bytes
node scripts/lib/agent-artifacts/generate.mjs --agent cursor --check   # 0 = up to date, 2 = stale
grep -cxF .github/chatmodes/jira-ticket-writer.chatmode.md .gitignore   # 1 (no duplicates)
git check-ignore -v .roomodes                     # no match: the source stays tracked
```

Generated files: `.github/copilot-instructions.md`, `.github/chatmodes/<slug>.chatmode.md`,
`.cursor/rules/project.mdc`, `.cursor/commands/<slug>.md`, `.cursor/rules/<slug>.mdc`,
`CLAUDE.md`, `.claude/agents/<slug>.md` — all gitignored together with their `.bak` pairs.

## Follow-ups

- **Manual step:** delete the global copy of the mode (Zoo Code → Modes → Edit mode → Delete), so
  the slug exists once. Fallback: edit `zoo-code-extension-storage.xml` with WebStorm closed, after
  a backup.
- Verify the exact Copilot / Claude tool identifiers against the product docs on each upgrade
  (`tools.mjs`); override per mode in `mode-overrides.json` if they change.
- Optional: wire `--check` into CI to catch stale artefacts; add `.roo/rules-<slug>/` when a mode
  needs longer mode-specific rules.
