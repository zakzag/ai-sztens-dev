# Instructions 

# Documentation

- Every time a chat is opened and plan discussed, code implemented, 
  the summary of the changes need to be written in a documentation file, 
  in folder: docs/history/, 
  filename must be: \<YYYY-MM-DD--HH-ii-ss\>-\<short description\>.md

# Milestones

- Whenever a chat produces a plan or implementation that meets ANY of the
  following criteria, the AI MUST also create a milestone document:
    * a non-trivial bug fix (a bug whose root cause was not obvious from the
      first symptom and required investigation or a server-side diagnosis);
    * a large or risky change that touches multiple files, services, or
      deployment artefacts;
    * a feature whose design decisions need to be preserved for future
      readers (i.e. anything a future contributor would need context for).

- Milestone location: `docs/milestones/`.

- Milestone filename: `<YYYY-MM-DD--HH-ii-ss>-<short-kebab-description>.milestone.md`.
  Use English in the filename. Use lowercase, ASCII, kebab-case for the
  short description. Example:
  `docs/milestones/2026-09-28--12-34-10-caddy-restart-loop-and-mem-limits.milestone.md`.

- Milestone body language: ENGLISH only, regardless of the language used in
  the chat. The milestone is project documentation that must be readable
  by anyone joining the repo later; the chat transcript is not.

- Milestone length: target **at most one printed page** (~500–700 words).
  Go over this only if the topic genuinely cannot be expressed in less
  without losing meaning. Prefer tables and short bullet lists over prose.

- Milestone required structure:
    1. **Problem / feature** — what was broken or what was needed.
    2. **Measured data / evidence** — concrete numbers, log excerpts, or
       reproduction steps that justify the diagnosis (skip if not applicable
       to a pure feature).
    3. **Root cause or design rationale** — why the problem happened, or
       what alternatives were considered for the feature.
    4. **Solution / implementation** — what was actually done; list of
       changed files with a one-line description of each change.
    5. **Outcome and how to verify** — what the end state looks like, and
       the exact commands or manual steps a future operator can run to
       confirm the change works as intended.
    6. **Follow-ups (optional)** — known limitations, deferred items, or
       things to revisit.

- The milestone is in addition to (not a replacement for) the
  `docs/history/` entry required by the Documentation rule above. The
  history entry records the day-to-day narrative; the milestone records
  the decision-grade summary that survives project memory.

# Specs doksik karbantartása

- A `docs/Specs/` mappa fájljai (pl. `Caddy-Reverse-Proxy.md`,
  `Functional-Specification.md`) **élő dokumentumok**: a projekt aktuális
  állapotát írják le, nem egy adott pillanatét. Ha a leírt komponens vagy
  konfiguráció megváltozik, a kapcsolódó specs doksit is frissíteni kell
  a változással egy időben.

- Minden specs doksi fejlécében (`**Utolsó frissítés:**` sor) szerepeljen
  a dátum, és a frissítéskor ez a dátum is frissüljön.

- Amikor a kód vagy a konfiguráció változik, az AI-nak kötelező
  megkeresnie az érintett specs doksit, és javasolnia kell a frissítést
  a változás befejezésével együtt. Tipikus esetek:

    * `infra/caddy/Caddyfile` vagy `deploy/deploy.sh:render_caddyfile()`
      változása → `docs/Specs/Caddy-Reverse-Proxy.md` frissítése.
    * `infra/docker-compose.yml` bármely service blokkjának változása
      (port, volume, network, függőségek) → a kapcsolódó specs doksi
      (jelenleg: `Caddy-Reverse-Proxy.md`) frissítése.
    * `infra/postgres/init/*.sh` változása → a `docs/Specs/`-ben
      megjelenő postgres-specifikus doksi frissítése (ha létezik,
      egyébként a doksi csak a kódból derül ki).
    * `deploy/bootstrap.sh` vagy `deploy/deploy.sh` új funkcióinak
      hozzáadása → a kapcsolódó specs doksi frissítése.

- Ha egy specs doksi leírt komponense **teljesen elavulttá válik**
  (a projektből kikerül, vagy más módon oldódik meg), a doksit át kell
  helyezni a `docs/Specs/outdated/` mappába, és a fejlécben jelezni kell
  az elavulás okát és dátumát.

- A specs doksi frissítésének elmulasztása **soha** ne legyen opcionális:
  ha a kód és a doksi eltérnek, a jövőbeli olvasó (fejlesztő vagy AI)
  félrevezető információk alapján dolgozik, és ez debugging-órákba vagy
  rossz implementációs döntésekbe kerülhet.

