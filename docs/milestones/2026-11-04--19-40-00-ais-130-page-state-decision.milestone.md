# AIS-130 — Page-state rule closed: URL first, Query second, Zustand last

**Date:** 2026-11-04 · **Ticket:** AIS-130 (parent AIS-129) · **Scope:** rules + specs, no product code

## 1. Problem

The page-state rule lived in **two documents that contradicted each other**:

- [`react.coding-standards.md`](../../.roo/rules/react.coding-standards.md:139) §6 made a page-local
  Zustand store **mandatory** (with a `createStore` code sample);
- [`UI-Architecture.md`](../Specs/UI-Architecture.md:375) §5 said `zustand` stays **uninstalled**, and
  the §7 dependency table listed it as `planned`.

Neither side was illustrated: `apps/admin/src/pages/**` contained **no** `*.store.ts` at all. A
developer starting a new page could not decide between a URL parameter, the query cache and a store,
which is exactly the ambiguity the ticket set out to close.

## 2. Measured evidence (2026-11-04)

| Fact | Evidence |
| --- | --- |
| `zustand` in no manifest | `Select-String -Pattern zustand` over all six `package.json` files: 0 hits |
| No page store exists | recursive `apps/admin/src` listing: 0 `*.store.ts` |
| List state already lives in the URL | [`use-list-params.ts`](../../apps/admin/src/features/api/use-list-params.ts:1) (AIS-119) |
| State-plan table already complete | 4 rows: `api-keys`, `LoginPage`, `PlaceholderPage`, `/calls` |

## 3. Decision and rationale

**`zustand` is not installed.** No page has transient UI state today, so the package would be an
unused dependency that `pnpm quality:dead-code` (knip) turns red, and AIS-105 **D1** forbids adding a
dependency that nothing needs.

| Option | Outcome | Verdict |
| --- | --- | --- |
| A — no install, conditional rule, factory stays a reference sample | no unused dependency, no knip exception, no new test | **chosen** |
| B — install now plus an unused `api-keys.store.ts` + knip exception | dead code in the repo, a gate exception that hides it | rejected |
| C — install and convert an existing `useState` to a store | product-code churn on a page that does not need it | rejected |

**Trigger:** the first AIS-129 page with genuine transient UI state installs the package, flips the
§7 row to `installed` and ships the store tests (init → patch → selector) **in the same change**.

## 4. Implementation

| File | Change |
| --- | --- |
| [`.roo/rules/react.coding-standards.md`](../../.roo/rules/react.coding-standards.md:139) | §6 rewritten: 4 buckets **in decision order** (URL → Query → page store → `useState`), §6.1 the three-question test, §6.2 URL rules, §6.3 store rules, §6.4 "`zustand` is not installed yet (AIS-130)", §6.5 server-state rules. Every remaining "three buckets" phrasing made conditional (§0.3, §0.4, §1, §3, §12, §13) |
| [`docs/Specs/UI-Architecture.md`](../Specs/UI-Architecture.md:27) | new `AIS-130 (2026-11-04)` header block **quoting** the rule's order; §5 intro points at rule §6; §5 closing paragraphs and the `zustand` note conditionalised; §7 note records the decision and the trigger |
| [`docs/plans/2026-11-04--19-30-00-ais-130-page-state-rule-closure-plan.md`](../plans/2026-11-04--19-30-00-ais-130-page-state-rule-closure-plan.md:1) | the executed plan, including the full new §6 text |

**Unchanged:** `apps/admin/**`, `packages/**`, `knip.json`, `.dependency-cruiser*`, CI workflows.

## 5. Outcome and verification

The two documents can no longer disagree: the specs **quote** the rule instead of paraphrasing it, and
the state plan of every page stays in one table.

```bash
git diff --name-only   # rules + specs + plan + history + milestone
pnpm quality           # all four gates (layers, dead code, tokens, field errors) stay green
```

Manual check: read rule §6.1 and answer "where does this state go?" for a filter, a selected row and a
form error — no follow-up question should be needed.

## 6. Follow-ups

- `zustand` installation, the `installed` §7 row and the first store tests land with AIS-129's first
  page that needs transient UI state.
- The §7 table's "Why" cell still mentions a *global session store*; the session currently lives in
  `auth/` and moves to `app/session/` with the cookie session (AIS-74).
