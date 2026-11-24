# AIS-14 R5 — the branch is pushed; the PR step needs a GitHub login

**Date:** 2026-11-23 23:49 (Europe/Budapest)
**Branch:** `AIS-14-company-admin` — pushed, remote head `d905439` (`git ls-remote` verified)
**Ticket:** AIS-14 (Story) · AIS-178 (`In Review`)
**Type:** release step — **partially executed, intentionally stopped before the merge**

## What was done

```text
git push origin AIS-14-company-admin
  -> d37d2d5..d905439  AIS-14-company-admin -> AIS-14-company-admin
git ls-remote --heads origin AIS-14-company-admin
  -> d905439a7d7904471b084a581612b4eaa643891f   refs/heads/AIS-14-company-admin
```

The branch now carries the whole close-out: R1's five defect fixes, the refreshed PR body, the
recorded `PATCH` decision and the story-level milestone — 18 commits on top of the last pushed state.

## What is blocked, and why

| Step | State |
| --- | --- |
| push | **done** |
| open the PR (R5.1) | **blocked** — `gh auth status` → “You are not logged into any GitHub hosts” |
| wait for the CI job `API e2e (envelope + OpenAPI gates, Postgres)` (R5.2–R5.3) | blocked with it |
| squash-merge with the title (R5.4) | blocked with it |
| Jira: `AIS-178` → `Done`, `AIS-14` → `Done` + DoD text, `AIS-17` → `Done` (R5.5) | **deliberately not done** — the board must never claim a closure the branch does not have |

`git push` works (the credential helper holds a token), but the `gh` CLI has no login, so no PR can be
created or merged from this session. Doing the merge by pushing directly to `main` was rejected: it
would skip the CI gate that proves the envelope/OpenAPI contract, which is exactly the check that
caught eleven new registry entries in slices e–f.

## How to finish (one command each)

```bash
gh auth login          # or: set GH_TOKEN=<pat>
gh pr create \
  --base main \
  --head AIS-14-company-admin \
  --title "AIS-14: feat(api): add the customer data layer with audit, contacts, tags, users and activities" \
  --body-file docs/plans/2026-11-23--pr-body-ais-178.md
```

Then, after the CI job is green:

1. confirm on the PR that `envelope-contract` and `openapi` passed (a registry entry without a route
   fails there, and slices e–f added eleven);
2. squash-merge with **the same title** as above (otherwise the ticket link is lost on `main`);
3. Jira, in this order:
   - `AIS-178` → **Done** — comment: merge commit hash, the 21 operations, the R1 numbers
     (3059 unit / 140 e2e) and the `D3` acceptance (duplicate `customerNumber` is unit-only);
   - `AIS-14` → **Done** — in the same edit replace the DoD line “`PATCH /:id` → `422`” with the
     three-line convention recorded in [`API-Convention.md`](../Specs/API-Convention.md:312) §4.3.1,
     and link the milestone
     [`2026-11-23--21-20-00-ais-14-customer-data-layer`](../milestones/2026-11-23--21-20-00-ais-14-customer-data-layer.milestone.md:1);
   - `AIS-17` → **Done** — its deliverable already shipped on 2026-11-22
     ([`Customers-Admin-Screens.md`](../Specs/Customers-Admin-Screens.md:1), `D1`–`D16`), so this is
     board drift, not open work; note that it is a child of **AIS-15**, not of AIS-14;
4. delete the branch **after** confirming the merge landed on `main`;
5. the first slice after this is **AIS-19** (`céglista`), the change that installs `zustand` (`D11`).

## Follow-ups

- The closeout plan's §11 checkboxes can only be ticked after step 2 above; until then R5 stays open
  on purpose.
- `docs/temp/12_ugyfelek_admin_mockup.html` and `docs/temp/_vapi-llms.txt` remain untracked scratch
  files and must never be staged.
