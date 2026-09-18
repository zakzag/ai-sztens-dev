# Plan: Product Documentation Structure

- Date: 2026-09-16
- Status: Draft for review
- Scope: Define the documentation flow from business brainstorm to development, and fix the spec docs accordingly.

## 1. Goal

Establish a clear, non-duplicating documentation chain that leads from the initial
brainstorm to the actual implementation work, so the team knows exactly which document to
fill in next and which artifact is the single source of truth for each concern.

## 2. Decisions

| Decision | Choice                                                                                                                      |
|---|-----------------------------------------------------------------------------------------------------------------------------|
| Spelling fixes | Fixed typos and garbled words in [`docs/Specs/01-Brainstorming.md`](../Specs/01-Kickoff-meeting.md)                         |
| Functional documentation | A dedicated **functional specification** replaces a standalone `02-MVP.md`                                                  |
| MVP marking | Each function gets a **`MVP?`** column + priority (`P0/P1/P2`); the MVP scope is derived from it, not maintained separately |
| Documentation order | Business → Functional (WHAT) → Technical (HOW) → Implementation plan                                                        |
| Plan storage | All plans go to `docs/history/<YYYY-MM-DD>-<short-description>-plan.md`                                                     |

## 3. Documentation Flow

```
01-Brainstorming.md            (business questions: vision, market, service, pricing, roles)
        ↓
02-Functional-Specification.md (WHAT — functions from user + operator view, MVP flags)
        ↓
Technical design               (HOW — architecture, flowchart, framework-agnostic spec)
        ↓
Implementation plan            (docs/history/<date>-...-plan.md)
```

- [`01-Brainstorming.md`](../Specs/01-Kickoff-meeting.md) — meeting agenda / business decisions.
- [`02-Functional-Specification.md`](../Specs/02-Functional-Specification.md) — **single source of
  truth for functions**: user-visible functions (F1, F2, …), operator-visible functions
  (O1, O2, …), each tagged with `MVP?` and priority. MVP scope = all rows where `MVP? = Igen`.
- Technical docs — [`01-callback-assistant.md`](../01-callback-assistant.md),
  [`02-flowchart.md`](../02-flowchart.md),
  [`03-implementation-general.md`](../03-implementation-general.md) describe the HOW.

## 4. Key Insight: Functional Spec Is the Starting Point

- The functional spec answers **WHAT the user sees** and **WHAT the operator sees**
  (user stories / use cases), which is the starting point for development.
- The technical docs answer **HOW it is built** and depend on the functional spec.
- Keeping the MVP flag inside the functional spec avoids two parallel lists that drift apart.

## 5. Method: Choosing the Target Industry (Beachhead)

To decide which industry to start with, run a narrowing process:

1. **Quantitative filtering** — call volume, missed calls, administrative load per industry.
2. **Qualitative validation** — 5–10 problem-discovery interviews per candidate industry.
3. **Scoring matrix** — pain strength, frequency, willingness to pay, reachability,
   technical simplicity, regulation/GDPR, competition.
4. **Pilot** — test the top 1–2 candidates with a real demo.
5. **Record the decision** — lock the chosen niche in the decision log.

Rule of thumb: pick **one narrow, high-pain niche**, not several at once.

## 6. Documents Required Before Development Starts

- **Functional spec / PRD** — functions, user stories, acceptance criteria (the WHAT).
- **Data model / ER diagram** — `callback_requests`, `call_details`, `call_events`,
  `actions`, `notifications`, `bookings`.
- **API contract** — endpoints, request/response schemas, status codes (202, 422, …).
- **Integration contracts** — VAPI webhook payload, calendar/CRM/notification interfaces.
- **Implementation plan** in `docs/history/` — phases, module mapping, milestones, DoD.
- **Testing strategy** — unit/integration/e2e coverage with mocked VAPI.
- **Security + GDPR checklist** — recording consent, retention, DPA, rate limiting.
- **Observability + ops runbook** — logging, correlation ids, metrics, alerting.
- **Environments + CI/CD** — staging/prod, secrets, build/test/deploy pipeline.

## 7. Actions Taken

- Created [`docs/Specs/02-Functional-Specification.md`](../Specs/02-Functional-Specification.md)
  skeleton with `MVP?` + priority columns.
- Removed the redundant `docs/Specs/02-MVP.md` skeleton.
- Fixed spelling errors in [`docs/Specs/01-Brainstorming.md`](../Specs/01-Kickoff-meeting.md):
  - "Szé Kecske" → "Szépségszalonok"
  - "iparágazatnak" → "iparágnak", "kapasitás" → "kapacitás"
  - "iparágazat" → "iparág"
  - "szúkkadunk" → "szűkítünk", "szántunk" → "szánunk"
  - "Árüzem" → "Árazás"
  - "Rólapok" → "Szerepkörök"
  - "Ügyféli" → "Ügyfél"
  - "Hídjanak meg 3潜在nyes ügyfélnek" → "Hívjanak meg 3 potenciális ügyfelet"

## 8. Next Steps

- Fill in [`01-Brainstorming.md`](../Specs/01-Kickoff-meeting.md) decisions (vision, niche, scope).
- Fill in the function tables in [`02-Functional-Specification.md`](../Specs/02-Functional-Specification.md)
  with user/operator functions and MVP flags.
- Produce the missing technical artifacts (data model, API contract, integration contracts).
- Write the implementation plan in `docs/history/` before coding.
