# AIS-170 — kód szerinti ellenőrzés + commitolás

**Dátum:** 2026-11-08 20:10 · **Ticket:** AIS-170 (subtasks: AIS-171, AIS-172, AIS-173, AIS-174)
· **Plan:** [`docs/plans/2026-11-08--13-40-00-admin-page-consistency-audit-plan.md`](../plans/2026-11-08--13-40-00-admin-page-consistency-audit-plan.md)

## Miről szólt ez a menet

Nem termelt új funkciót: a kérdés az volt, hogy az **AIS-170 készen van-e a kód szerint**, és ha igen,
akkor a lokális, még commitolatlan munka kerüljön be a git történetbe ticket szerinti commitokkal, a
Jira pedig kapja meg a „mi készült el" rekordot.

## Ellenőrzés (nem státusz, hanem kód)

| DoD pont | Eredmény |
| --- | --- |
| `PageShell` a `packages/ui`-ban, minden admin oldal ezen megy át | ✅ `packages/ui/src/components/page-shell/*`; fogyasztók: `ApiKeysPage`, `PlaceholderPage`, `CallsPlaceholderPage`, `NotFoundPage`, create/view/edit overlay; kivétel `LoginPage` |
| Az `api-keys` egyetlen mutáló felület-mintája (3 overlay route, URL-lel nyitható) | ✅ `route-registry.tsx` 3 child entry, `breadcrumbLabel` + `resolveBreadcrumbLabel` |
| `ApiKeyEditForm.tsx` törölve, szerkesztés `ApiKeyEditDialog`-ban `useAppForm`-mal + toast | ✅ `ui/ApiKeyEditDialog.tsx` + `ui/ApiKeyEditDialogForm.tsx` |
| `ApiKeyDetailPage.tsx`, `ApiKeyDeleteDialog.tsx` törölve; törlés a view overlay-ből | ✅ `ApiKeyViewDialog.tsx` footer + lokális `useState` + `closeDialog`; a legacy route a catch-all 404-re esik |
| Nincs oldalszintű `isSaved` / `isStale` `Alert` | ✅ csak JSDoc-magyarázat említi |
| Specs + fejléc-dátumok | ✅ `pnpm quality:docs` → 0 violation |
| `docs/history` + milestone | ✅ 4 history + 4 milestone a 4 subtaskhoz |
| Kapuk | ⚠️ 5/6 — lásd lent |

## Kapuk (futtatva)

| Parancs | Eredmény |
| --- | --- |
| `pnpm quality` | 0 violation (layers, knip, tokens, themes, field-errors, docs) |
| `pnpm typecheck` | zöld (shared, ui, api-client, notifications, api, web, admin) |
| `pnpm -r lint` | zöld |
| `pnpm -r build` | zöld |
| `pnpm --filter @callback/ui test` | 49 fájl / 519 teszt |
| `pnpm --filter @callback/admin test` | 48 fájl / 547 teszt |
| `pnpm test:quality` | **környezeti hiba**: Node 20.19.2 alatt a `node --test` nem oldja fel a `"scripts/quality/*.test.mjs"` globot (a repo `engines`: `>=24.9.0`); nem a változás következménye |

## Commitok

| Commit | Cím | Tartalom |
| --- | --- | --- |
| `54ad78c` | `style(ui): add the four glass appearances with backdrop and sheen` | glass token-készlet, fotó háttér, `sheen-glass`, theme gate (refs AIS-164/166/169) |
| `5b87538` | `docs(history): record the glass appearance and pager spacing changes` | glass history/milestone/plan |
| `b6763d5` | `docs(rules): document the glass token contract and confirmation exception` | `.roo/rules/react.coding-standards.md` (AIS-173 §6.3) |
| `0824940` | `AIS-170: refactor(admin): unify page surfaces behind PageShell and overlays` | 44 fájl: `PageShell`, 3 overlay, törlések, tesztek |
| `f5c7e92` | `AIS-170: docs(specs): record the unified admin surface and its exceptions` | 19 fájl: specs + plans + history + milestones |

A `$null` nevű, PowerShell-redirectből maradt artifact törölve; a working tree a menet végére tiszta.

## Jira

- AIS-171, AIS-172, AIS-173, AIS-174: státusz **Done** volt, de **nem** volt „mi készült el" komment
  (AIS-172-n csak egy előfeltétel-pontosítás) → mindegyik kapott fájl-táblás, commit-hivatkozásos
  összefoglalót.
- AIS-170: DoD-tábla + futtatott kapuk + commit-lista. A story státusza **To Do** maradt: a zárás
  (tranzakció a Done-ba) külön döntés, a komment jelzi, hogy zárható.
