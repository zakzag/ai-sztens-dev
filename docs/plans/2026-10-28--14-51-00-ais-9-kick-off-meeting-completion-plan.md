# AIS-9 — Finishing the Kick-off Meeting spec

**Ticket:** AIS-9 "Kick Off Meeting kidolgozása" (Story, Jira status: **Done**, description = the file path only, last updated 2026-10-19)
**Target artefact:** [`docs/Specs/Kick-off-Meeting.md`](../Specs/Kick-off-Meeting.md) — 94 lines, Hungarian, 7 sections, meeting date 2026-09-15
**Author:** implementation plan, 2026-10-28

---

## 1. Current state — measured

The document exists and is the oldest spec in the repository. Of its 20 checklist
items, **13 are unchecked**, and the unchecked ones are not cosmetic: they are the
business decisions the document was created to capture.

| Line | Open item | Kind |
|---|---|---|
| [31](../Specs/Kick-off-Meeting.md:31) | "Melyik iparágnak van a legnagyobb szüksége erre?" — inline note: `!! Legnagyobb? Nem tudom.` | business decision |
| [33](../Specs/Kick-off-Meeting.md:33) | "MVP célközönség:" — inline note: `!! meghatározni` | business decision |
| [59](../Specs/Kick-off-Meeting.md:59) | LLM model choice | **already decided in practice** (VAPI-hosted) |
| [60](../Specs/Kick-off-Meeting.md:60) | Voice technology (Vapi / Retell / ElevenLabs / own) | **already decided: VAPI** |
| [61](../Specs/Kick-off-Meeting.md:61) | Integration layer (Make.com / LangChain / own backend) | **already decided: own NestJS backend** |
| [62](../Specs/Kick-off-Meeting.md:62) | Database + CRM sync | **partly decided: Postgres + Drizzle; no CRM in MVP** |
| [71](../Specs/Kick-off-Meeting.md:71) | Cost structure (API cost per average customer) | business decision |
| [72](../Specs/Kick-off-Meeting.md:72) | Service fee / premium over the technology cost | business decision |
| [83](../Specs/Kick-off-Meeting.md:83) | Customer onboarding process | business decision |
| [91](../Specs/Kick-off-Meeting.md:91)–[93](../Specs/Kick-off-Meeting.md:93) | Three action items with `[Név] / [Feladat]` placeholders | bookkeeping |
| [94](../Specs/Kick-off-Meeting.md:94) | "Következő ülés dátuma: `[Dátum]`" | bookkeeping |

Additional defects found:

1. **No `**Utolsó frissítés:**` header.** The project rule for `docs/Specs/` requires it, so the
   document cannot be recognised as a living spec.
2. **Dangling reference:** [line 44](../Specs/Kick-off-Meeting.md:44) points at
   `Kick-off-Meeting-AI-draft.md`, which does not exist anywhere in the repository.
3. **Stale framing:** §7 asks for "tasks for the first 14 days" relative to a 2026-09-15
   meeting; those windows closed weeks ago and the items were never converted to Jira.
4. **Second spec blocked by the same gap:** [`Functional-Specification.md:16`](../Specs/Functional-Specification.md:16)
   still reads `- [ ] **Célközönség (niche):** [kiválasztott iparág]`, so the niche decision is
   missing in *two* living documents.
5. **Possible factual drift:** §3 lists the callback-request form + call state machine as MVP,
   but the callback feature was removed from the codebase (AIS-64, 2026-10-21). The doc must
   state intent, not implementation, or it contradicts the code.
6. **Jira bookkeeping:** the ticket is marked **Done** while 13 items are open.

---

## 2. Gap classification

* **Class A — already answered by the shipped system, only never written back** (§4 tech stack).
  Nobody has to decide anything; the code is the evidence.
* **Class B — genuinely undecided business questions** (niche, unit economics, service fee,
  onboarding). These cannot be derived from code and must not be invented.
* **Class C — document hygiene and bookkeeping** (header, dangling link, placeholders, Jira status).

---

## 3. Work packages

### WP1 — Write back the Class A decisions (§4) — *no stakeholder input needed*
For each unchecked §4 line, check it and add one sentence of evidence plus a pointer to the
spec that owns the fact:

| §4 line | Answer to record | Evidence to cite |
|---|---|---|
| LLM | The model is chosen inside VAPI per assistant, not in this repo; the backend stores only the outcome | [`apps/api/src/vapi-webhooks/`](../../apps/api/src/vapi-webhooks/) |
| Voice | **VAPI** (speech-to-speech orchestration; STT→LLM→TTS inside the provider) | [`Caddy-Reverse-Proxy.md`](../Specs/Caddy-Reverse-Proxy.md), `vapi-webhooks` module + HMAC `VapiSignatureGuard` |
| Integration layer | **Own backend** (NestJS + Fastify); no Make.com, no LangChain | [`Infrastructure-Docker.md`](../Specs/Infrastructure-Docker.md), `apps/api` |
| Database | **PostgreSQL 17 + Drizzle ORM**, schema `platform`; **no CRM sync in the MVP** | [`Database-Local.md`](../Specs/Database-Local.md), [`apps/api/drizzle/`](../../apps/api/drizzle/) |

### WP2 — Niche / MVP target segment (§2, lines 31 & 33) — *owners: Kálmán + Tamás*
Decision meeting, 30 minutes. Recommended default to confirm or reject: **dental practices** —
it is already the demo scenario in §7, has high inbound volume, no reception capacity, and the
booking need is simple enough for the MVP. Output: one sentence in the doc **and** the same value
in [`Functional-Specification.md:16`](../Specs/Functional-Specification.md:16).

### WP3 — Unit economics (§5, lines 71–72) — *owner: Tamás (research) + Kálmán (pricing)*
Produce a cost-per-call table (VAPI per-minute + LLM + TTS + phone number + infra share) and from
it the pricing rule (fixed monthly + overage). Both numbers stay in the doc, the research goes to
`docs/history/` if it needs detail.

### WP4 — Customer onboarding flow (§6, line 83) — *owners: Kálmán + Tamás*
Five steps with an owner and an exit criterion each (e.g. data collection → assistant
configuration → test call → go-live → first-week review). Reuse the concrete configuration
artefacts that already exist (assistant prompt, webhook URLs, API keys).

### WP5 — Action items (§7, lines 91–94) — *owner: whoever runs the ticket*
Replace the `[Név] / [Feladat] / [Dátum]` placeholders: either fill them with a real owner and
date, or (preferred) move them into Jira and keep the doc as a decisions record, leaving a single
line "Open actions: see the AIS backlog".

### WP6 — Document hygiene — *no input needed*
* Add `**Utolsó frissítés:** 2026-10-28` and a one-line status (`living document`).
* Remove the `!! …` inline notes by turning them into either a decision or a clearly labelled
  open question with an owner and a deadline.
* Fix the dangling `Kick-off-Meeting-AI-draft.md` reference (delete the sentence or point at the
  real vision document in [`../Specs/outdated/`](../Specs/outdated/)).
* Make §3 explicit that it describes the **intended** MVP, and link the current implementation
  status instead of implying it ships today.

### WP7 — Consistency pass — *no input needed*
Cross-check against the living specs named in WP1 plus
[`API-Convention.md`](../Specs/API-Convention.md) and [`Local-Development.md`](../Specs/Local-Development.md);
fix contradictions in whichever document is wrong, and bump `**Utolsó frissítés:**` in every file
touched (Specs rule).

### WP8 — Closing — *no input needed*
History entry under `docs/history/`, plus a milestone **only if** the niche and pricing decisions
land (they are design decisions future readers need). Finally: AIS-9 in Jira must stop saying
**Done** while boxes are open — either it moves back to *In Progress*, or WP2–WP4 are completed
first and then it stays *Done*.

---

## 4. Sequencing and effort

| Step | Depends on | Effort |
|---|---|---|
| 1. WP6 + WP1 + WP7 (doc-only, one commit) | nothing — start today | ~2 h |
| 2. WP2 + WP4 decision meeting | Kálmán + Tamás (30 min) | 30 min + 1 h writing |
| 3. WP3 cost model and pricing rule | VAPI/LLM price research | ~3 h |
| 4. WP5 + WP8 | steps 1–3 | ~30 min |

Steps 1 and 4 are safe to do without any business input; steps 2–3 need the owners, because
inventing a niche or a price would propagate straight into `Functional-Specification.md` and the
sales material.

---

## 5. Acceptance criteria (what "AIS-9 done" means)

- [ ] Zero `- [ ]` boxes remain, or every remaining one is an explicitly labelled open question
      with an owner and a deadline.
- [ ] No `!!`, `[Név]`, `[Feladat]` or `[Dátum]` placeholder text anywhere in the file.
- [ ] §4 matches the shipped stack line by line, each with a spec pointer.
- [ ] `Functional-Specification.md:16` carries the same niche value as §2.
- [ ] `**Utolsó frissítés:**` present; every internal link in the file resolves.
- [ ] §3 does not claim implemented behaviour the code does not have (callback removal, AIS-64).
- [ ] History entry written; Jira status consistent with the actual state.

---

## 6. Risks

* **Invented facts.** The biggest risk is filling §2/§5 with plausible-but-unagreed numbers. Every
  Class B item needs a named owner's confirmation, not an AI guess.
* **Silent contradiction.** This is the oldest document in the repo; it references a stack that has
  since moved on. WP7 exists specifically to stop the doc from becoming a fourth source of truth
  next to `Functional-Specification.md`, `Infrastructure-Docker.md` and `API-Convention.md`.
* **Ticket hygiene.** Marking a ticket Done to close a sprint, while the deliverable has 13 open
  boxes, makes the Jira board untrustworthy — the same failure mode we removed from the API
  contract work.
