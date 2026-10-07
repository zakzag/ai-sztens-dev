# `scripts/` — helper scripts

**Single source of truth** for the helper scripts in this repository. Every other document
(root [`README.md`](../README.md), [`docs/Specs/*`](../docs/Specs), [`deploy/README.md`](../deploy/README.md), …)
links here instead of describing a script inline. When you add, rename or remove a script,
update this file and the matching sub-folder README.

## Layout

```text
scripts/
├── README.md            # this file — the script index (source of truth)
├── dev-stack.sh         # local Docker stack            (bash)
├── dev-stack.ps1        # Windows entry point for dev-stack.sh
├── init.sh              # AI-agent instruction sync     (bash)
├── init.ps1             # AI-agent instruction sync     (Windows PowerShell)
├── test-syntax.ps1      # PowerShell syntax guard for init.ps1
├── env-test/            # .env validation suite        → env-test/README.md
├── ssh/                 # local SSH key tooling        → ssh/README.md
└── test/                # container stack smoke suite  → test/README.md
```

## Root scripts

### `dev-stack.sh` / `dev-stack.ps1` — local stack helper

Brings up the developer's local Docker stack (api + postgres, Caddy disabled) with one
command. It seeds `infra/.env.local` from `infra/.env.example` on first run and exports
`APP_ENV=local` so the API picks `apps/api/.env.local`.

- **Subcommands:** `up` (default), `down`, `ps`, `logs [service]`, `restart`, `help`.
- **Exit codes:** `0` success, `1` fatal error (docker missing, port in use, …).
- **Pre-flight:** requires `docker` + `docker compose` v2 and the two compose files.

```bash
scripts/dev-stack.sh up          # bash (Linux / WSL / Git Bash / macOS)
pwsh scripts/dev-stack.ps1 up    # Windows wrapper (delegates to bash via WSL)
```

### `init.sh` / `init.ps1` — AI-agent instruction sync

Interactive, idempotent generator: concatenates the `.roo/rules/*.md` sources into the chosen
agent's instruction file — Copilot → `.github/copilot-instructions.md`, Cursor →
`.cursor/rules/project.mdc`, Claude Code → `CLAUDE.md` — keeps a single `.bak` when the content
changes, and appends the generated path to `.gitignore`.

The source of truth is `.roo/rules/`; never edit a generated file by hand. Exit codes: `0`
success or user quit, `1` fatal error.

```bash
scripts/init.sh                  # bash
scripts/init.ps1                 # Windows PowerShell
```

### `test-syntax.ps1` — PowerShell syntax guard

Parses `scripts/init.ps1` with the PowerShell AST parser and exits non-zero on any parse
error. A cheap pre-flight check after editing the init scripts.

```powershell
powershell -File scripts/test-syntax.ps1
```

## Folders

| Folder | What it is | Documentation |
|---|---|---|
| [`test/`](test/README.md) | Container-level smoke suite for the `infra/docker-compose.yml` stack (api / postgres / caddy / monitor). Wired to `pnpm test:stack`. | [`test/README.md`](test/README.md) |
| [`env-test/`](env-test/README.md) | `.env` validation: an offline syntax/consistency checker plus an explicit live-access checker. | [`env-test/README.md`](env-test/README.md) |
| [`ssh/`](ssh/README.md) | Local SSH key tooling (PPK → OpenSSH conversion, key inspection, passphrase removal). | [`ssh/README.md`](ssh/README.md) |

## Conventions

- **Bash first.** The functional scripts are bash. The `.ps1` files are thin Windows wrappers
  that locate a real bash (Git for Windows / MSYS2), forward arguments verbatim and mirror the
  exit code — see [`deploy/deploy.ps1`](../deploy/deploy.ps1) for the reference pattern.
- **LF line endings.** `.gitattributes` forces `*.sh text eol=lf`; CRLF breaks the bash scripts.
- **No executable bit required.** Run them with an explicit interpreter (`bash <script>`), which
  is also how `package.json` invokes the test suites.
- **Windows:** use `.\scripts\...\*.ps1` from PowerShell or `bash scripts/.../*.sh`; never
  double-click a `.sh` (Windows opens a throwaway Git Bash window that cannot resolve the path).

## Documentation rule

When another document needs to mention a script, it should **link to this README** (or the
matching sub-folder README) rather than restating the script's interface, subcommands or
internals. Project-level overview: [`README.md`](../README.md).
