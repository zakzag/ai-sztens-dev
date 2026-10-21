# AIS-64 — callback funkció eltávolítása (ticket létrehozás + blokkolók)

**Dátum:** 2026-10-21
**Típus:** Jira ticket-struktúra (story + subtaskok létrehozása)

## Létrehozott ticketek

| Ticket | Típus | Szülő | Tartalom |
|---|---|---|---|
| AIS-64 | Story | AIS-1 | Visszahívás (callback) funkció teljes eltávolítása az API-ból, az admin appból és az adatbázisból |
| AIS-65 | Subtask | AIS-64 | API: callback-requests modul, repository, séma-elemek eltávolítása |
| AIS-66 | Subtask | AIS-64 | Adatbázis: drop migráció + callback séma kivétele az init scriptekből és a smoke tesztekből |
| AIS-67 | Subtask | AIS-64 | Admin: dashboard, lib/api.ts és nav eltávolítása + placeholder |
| AIS-68 | Subtask | AIS-64 | Dokumentáció + Jira housekeeping (AIS-38 cancel, AIS-29 re-scope, AIS-57 minta csere) |
| AIS-69 | Subtask | AIS-64 | Publikus web űrlap + shared sémák (GATED — blokkoló döntés 1.) |

## Blokkoló döntések (a story indítása előtt)

1. **Publikus web űrlap:** `apps/web` a `POST /api/callback-requests`-re ír; a backend törlése elrontja.
   Javaslat: a web callback flow-t is töröljük (AIS-69).
2. **Adatvesztés:** a dev dropleten lehet sor a `callback.callback_requests`-ben; a drop migráció destruktív.
3. **AIS-29/AIS-38:** AIS-38 cancel, AIS-29 re-scope DB-migrációs workflow-ra (hogy AIS-56-nak maradjon szülője).
4. **AIS-57 minta-erőforrás:** `callback-requests` → `api-keys`.

## Sorrend

AIS-64 (AIS-65…AIS-69) az **első** implementálandó story — AIS-56 előtt.
