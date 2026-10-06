# 2026-10-05 10:16 — Prompt archive converted from `.txt` to `.md`

## What changed

- `docs/prompts/2026-09-18-droplet-setup.txt` → [`docs/prompts/2026-09-18-droplet-setup.md`](../prompts/2026-09-18-droplet-setup.md)
- `docs/prompts/2026-10-02-vapi-webhook-security.txt` → [`docs/prompts/2026-10-02-vapi-webhook-security.md`](../prompts/2026-10-02-vapi-webhook-security.md)
- Both `.txt` originals were deleted, so the archive folder now contains
  markdown files only.
- Stale reference fixed: [`docs/history/2026-09-21--16-46-30-droplet-deploy-infra-plan.md`](2026-09-21--16-46-30-droplet-deploy-infra-plan.md:6)
  pointed at the removed `.txt` path of the droplet-setup prompt.

## Why

The user asked for the two prompt files to be rewritten in markdown
(`„A … fájlok formátumát írd át .md-re!"`). The archived prompts are
reference material that gets read and linked from `docs/history/` and the
specs, so plain-text formatting made them harder to navigate (no headings,
no code fences, unlinked file paths).

## Formatting applied

| Aspect | Before | After |
|---|---|---|
| Title | none | `#` H1 heading per file |
| Metadata | none | date / type / conversion note block |
| Structure | flat prose, `-` and `1.` lines | headings, markdown lists, blockquote for the `FONTOS` warning |
| Commands | indented plain text | fenced ` ```bash ` and ` ```caddyfile ` blocks |
| File references | bare paths | relative markdown links to the code paths |

Wording was preserved verbatim (including the original typos such as
`módosíytani` and `noejs`); only markdown structure and emphasis were added.
The VAPI prompt's Caddy snippet and the 5-step verification script were kept
character-for-character inside their new code fences.

## Verification

- `dir /b docs\prompts` lists only `2026-09-18-droplet-setup.md` and
  `2026-10-02-vapi-webhook-security.md`.
- A repo-wide search for `2026-09-18-droplet-setup` and
  `2026-10-02-vapi-webhook-security.txt` returned no remaining references
  other than the conversion notes inside the two new `.md` files.

## Follow-ups

- `plans/2026-10-02-vapi-webhook-security.md` remains the derived
  implementation plan for the same topic; kept separate on purpose
  (prompt = raw archived request, plan = structured task breakdown).
