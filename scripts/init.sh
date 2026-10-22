#!/usr/bin/env bash
# ------------------------------------------------------------------------------
# init.sh — AI agent artefact sync (thin wrapper)
#
# Source of truth:
#   - .roo/rules/*.md  -> concatenated into the agent instruction file
#   - .roomodes        -> one artefact per project-level custom mode
#     (authored in the Zoo Code UI; this script never writes that file)
#
# All rendering, writing and `.gitignore` bookkeeping lives in
# scripts/lib/agent-artifacts/generate.mjs, so this wrapper and its PowerShell
# twin produce exactly the same bytes.
#
# Generates for ONE agent per run:
#   1) GitHub Copilot -> .github/copilot-instructions.md
#                        + .github/chatmodes/<slug>.chatmode.md per mode
#   2) Cursor         -> .cursor/rules/project.mdc
#                        + .cursor/commands/<slug>.md and .cursor/rules/<slug>.mdc per mode
#   3) Claude Code    -> CLAUDE.md + .claude/agents/<slug>.md per mode
#
# Every generated file AND its .bak counterpart is appended to the
# ".gitignore" section of the same name (idempotently, no duplicates).
#
# Behaviour:
#   - interactive only (no CLI flags),
#   - idempotent: unchanged files are not rewritten,
#   - a single .bak is kept next to each changed file.
#
# Exit codes:
#   0 = success / user chose quit
#   1 = fatal error (no .roo/rules, node missing, generator failure)
# ------------------------------------------------------------------------------

set -euo pipefail

readonly SCRIPT_NAME="init.sh"
readonly RULES_DIR=".roo/rules"
readonly ROOMODES_FILE=".roomodes"
readonly GENERATOR="scripts/lib/agent-artifacts/generate.mjs"

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

log_info()  { printf '\033[36m[i]\033[0m %s\n' "$*" >&2; }
log_ok()    { printf '\033[32m[+]\033[0m %s\n' "$*" >&2; }
log_warn()  { printf '\033[33m[!]\033[0m %s\n' "$*" >&2; }
log_error() { printf '\033[31m[x]\033[0m %s\n' "$*" >&2; }

# Walk upwards until the repository root is found, so the script can be started
# from any subdirectory inside the monorepo.
cd_to_repo_root() {
  local dir
  dir="$(pwd)"
  while true; do
    if [[ -d "${dir}/${RULES_DIR}" || -f "${dir}/${ROOMODES_FILE}" ]]; then
      cd "${dir}"
      return 0
    fi
    if [[ "${dir}" == "/" || "${dir}" == "." || -z "${dir}" ]]; then
      return 1
    fi
    dir="$(dirname "${dir}")"
  done
}

# ---------------------------------------------------------------------------
# Interactive prompt
# ---------------------------------------------------------------------------

# Prints the chosen agent key ("copilot", "cursor", "claude" or "quit") on
# STDOUT; the menu itself goes to STDERR so `$(prompt_agent)` stays clean.
prompt_agent() {
  local choice
  while true; do
    {
      printf '\n'
      log_info 'Melyik AI coding agentet használod?'
      printf '   1) GitHub Copilot\n'
      printf '   2) Cursor\n'
      printf '   3) Claude Code\n'
      printf '   q) Quit (kilépés, semmi nem változik)\n'
      printf '\nVálasz [1/2/3/q]: '
    } >&2

    if ! IFS= read -r choice; then
      log_error 'Nincs válasz a bemeneten.' >&2
      return 1
    fi

    case "${choice}" in
      1|copilot|Copilot) printf 'copilot'; return 0 ;;
      2|cursor|Cursor)   printf 'cursor';  return 0 ;;
      3|claude|Claude)   printf 'claude';  return 0 ;;
      q|Q|quit|Quit)     printf 'quit';    return 0 ;;
      *) log_warn "Ismeretlen válasz: '${choice}'. Újra kérdezem." >&2 ;;
    esac
  done
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

main() {
  if ! cd_to_repo_root; then
    log_error "Nem találom a ${RULES_DIR}/ mappát vagy a ${ROOMODES_FILE} fájlt. Futtasd a projekt gyökeréből."
    exit 1
  fi
  log_info "Repo gyökér: $(pwd)"

  if ! command -v node >/dev/null 2>&1; then
    log_error 'A "node" nem érhető el a PATH-ban — a generátor Node-ot igényel.'
    exit 1
  fi
  if [[ ! -f "${GENERATOR}" ]]; then
    log_error "Hiányzó generátor: ${GENERATOR}"
    exit 1
  fi

  printf '\n--- Melyik AI agent? ---\n' >&2
  local agent
  agent="$(prompt_agent)" || exit 1
  if [[ "${agent}" == 'quit' ]]; then
    log_info 'Kilépés, semmi nem változott.'
    exit 0
  fi

  printf '\n--- Generálás (%s) ---\n' "${agent}" >&2
  if ! node "${GENERATOR}" --agent "${agent}"; then
    log_error 'A generálás sikertelen.'
    exit 1
  fi

  log_ok 'Kész.'
  log_info "Ne feledd: a forrás a ${RULES_DIR}/ és a ${ROOMODES_FILE} — ne szerkeszd a generált fájlokat."
  log_info "Újrafuttatás: scripts/${SCRIPT_NAME} (vagy scripts/init.ps1 Windows-on)."
}

main "$@"
