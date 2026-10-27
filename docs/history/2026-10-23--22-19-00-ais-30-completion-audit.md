# AIS-30 készültség-audit és lezárás

**Dátum:** 2026-10-23 22:19 (Europe/Budapest)
**Típus:** verifikáció + Jira státuszváltozás (nem kódváltozás)
**Érintett Jira issue:** `AIS-30` (Story) és subtaskjai: `AIS-39`, `AIS-40`, `AIS-41`, `AIS-42`

## Kérés

„Nézd meg, hogy az AIS-30 minden subtaskja kész van-e — ténylegesen, nem státusz alapján; ha igen, tedd a story-t `Done` státuszba.”

## Módszer

A Jira státuszok helyett a repóban ellenőriztem a leszállított artefaktumokat, majd újrafuttattam a
teszt-suites-okat.

| Subtask | Artefaktum a repóban |
| --- | --- |
| AIS-39 | `apps/api/src/db/schema.ts` — `platform.api_keys` (8 oszlop) + named unique `api_keys_identifier_key`; `apps/api/drizzle/0002_minor_domino.sql`, `meta/0002_snapshot.json`, `meta/_journal.json` commitolva |
| AIS-40 | `apps/api/src/api-keys/` — controller (`GET /api/api-keys`, `GET /api/api-keys/:identifier`, `POST` 201), service, repository (+ interfész), mapper, DTO, error-guard, module; `isIdentifierConflict()` a `cause` láncon olvassa a `23505` SQLSTATE-ot → 409; `test/api-keys.e2e-spec.ts` |
| AIS-41 | `apps/admin/src/pages/api-keys/` — `ApiKeysPage`, `ApiKeyForm` (5 mező, 409 → `identifier` mező, pending állapot), `ApiKeysTable`; `features/api-keys`, `entities/api-key`; `/api-keys` route az `App.tsx` `ProtectedLayout`-jában |
| AIS-42 | `docs/Specs/Local-Development.md` §6.1–6.9 teljes walkthrough + `Database-Local.md` §3.1 pointer + `docs/history/2026-10-21--23-19-00-ais-42-dev-howto.md` |

## Futtatott ellenőrzések

```text
pnpm --filter @callback/api test       → 19 suites / 194 tests PASS
pnpm --filter @callback/api test:e2e   →  5 suites /  23 tests PASS
                                          (az api-keys suite a Node 20.19.2 gate miatt self-skip)
pnpm --filter @callback/admin test     → 10 files  /  87 tests PASS
docker compose … ps                    → Docker Desktop nem fut → élő DB-ellenőrzés nem ismételhető
```

## Eredmény

Mind a 4 subtask szállítmánya ténylegesen elkészült → **AIS-30 átállítva `In Progress` → `Done`**
(transition id 41). A döntés indoklása és a bizonyíték-tábla kommentként felkerült az issue-ra.

## Nyitott megjegyzések

- **AIS-42 státusza továbbra is `In Review`**: a munka kész, de a review-lépés nem része ennek az
  auditnak, ezért nem mozgattam. Ha nincs külön review, `Done`-ba tehető.
- A DB-t igénylő ellenőrzések (migráció alkalmazása, `api-keys` e2e) ebben a futásban nem
  ismételhetők meg: a Docker Desktop nem futott, a `test:e2e` `api-keys` suite-ja pedig Node ≥ 24.9-et
  igényel (`test/lib/app-module-gate.ts`). A statikus szerződés (schema + migráció + snapshot) és a
  2026-10-21-i manuális smoke (201 / 200 / 409 / 400 / 404) a `docs/history/` bejegyzésekben rögzítve.
