# Email Engine — profilépítő engine terve

**Dátum:** 2026-10-15
**Típus:** terv (tervezési dokumentum)
**Kapcsolódó fájl:** [`docs/temp/email-engine-plan-1-deepseek-v4-pro.md`](../temp/email-engine-plan-1-deepseek-v4-pro.md)

## Összefoglaló

A feladat az [`Email-modul-MVP.md`](../temp/Email-modul-MVP.md) alapján egy olyan
**profilépítő engine** megtervezése volt, amely az onboarding során (R1, A12/D50)
a bekötött Gmail-postafiók múltbeli levelezéséből felépíti a cég profilt adó
adatbázist. A terv kizárólag az inicializálást fedi le; az újonnan érkező leveleket
feldolgozó és a profilt frissítő modulok nem részei, de a terv úgy készült, hogy
azok változtatás nélkül ráépülhessenek.

## Amit a terv tartalmaz

- **Pipeline:** lineáris, moduláris csővezeték — letöltés → normalizálás →
  AI-kinyerés → aggregálás → perzisztálás.
- **Komponensek:** `ProfileBuildOrchestrator`, `EmailSource`, `EmailNormalizer`,
  `InformationExtractor`, `ProfileAggregator`, `ProfileRepository`.
- **Interfészek:** `IEmailSource`, `IEmailNormalizer`, `IInformationExtractor`,
  `IProfileAggregator` (feldolgozás), valamint `IProfileProvider`,
  `IProfileUpdater`, `IEmailStore` (perzisztencia) a későbbi modulok számára.
- **Adatbázis táblák:** `mailboxes`, `mailbox_settings`, `contacts`,
  `contact_style_profiles`, `owner_style_profiles`, `knowledge_entries`, `emails`,
  `email_contacts`, `email_analyses`, `classification_rules`, `profile_build_runs`.
- **Diagramok:** komponens diagram és szekvencia diagram Mermaid formátumban.
- **Egyéb:** hibakezelés/idempotencia/újrafuttatás, valamint a kapcsolat az MVP
  adatmegőrzési táblájával.

## Változtatott / létrehozott fájlok

| Fájl | Változás |
| :--- | :--- |
| `docs/temp/email-engine-plan-1-deepseek-v4-pro.md` | Új tervezési dokumentum létrehozása |
| `docs/plans/2026-10-15--02-15-46-email-engine-profile-builder-plan.md` | Ez a history-bejegyzés |
