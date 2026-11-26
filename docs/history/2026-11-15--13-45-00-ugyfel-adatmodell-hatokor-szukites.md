# Ügyfél-adatmodell terv — hatókör-szűkítés

**Dátum:** 2026-11-15 13:45
**Érintett dokumentum:** [`docs/temp/2026-11-15-ugyfel-adatmodell-es-naplo-terv.md`](../plans/2026-11-15--13-15-00-ugyfel-adatmodell-es-naplo-terv.md)

## Kiindulás

A 2026-11-15-ös tervezési dokumentum nyolc tabos mockupra épült, számlázási
profillal, szerződés-nyilvántartással, valamint a „cégenként külön vagy közös
tábla" kérdés teljes kifejtésével.

## Változások

| # | Kérés | Végrehajtás |
|---|-------|-------------|
| 1 | Szerződés-tab nem használt | A tab, a `documents` / `document_versions` / `contract_acceptances` táblák, a hozzájuk tartozó enumok (`document_method`, dokumentum-kódok), az `acceptance` audit-művelet, a mermaid entitások és a döntés-azonosítók (`SA-D11`, `SA-D13`) törölve |
| 2 | Áttekintés tab egyszerűsítése | `trial_ends_at` oszlop, a `proba ≤ 7 nap` származtatott érték, a próbaidő- és teendő-figyelmeztetés említései törölve; a tab csak státusz, státuszváltás dátuma, szolgáltatások, elsődleges kapcsolattartó, utolsó aktivitás |
| 3 | Számlázási adat nem tárolt | `customer.billing_profiles` tábla és minden pénzügyi mező törölve (`payment_method`, `billing_cycle`, `monthly_price`, `list_price`, `currency`, `payment_term_days`, `billing_emails`); a korábbi `billing` séma `service` sémává alakult, díjazás nélkül; a `haviDij` származtatott érték és a listában megjelenő díj törölve |
| 4 | Nincs cégenkénti tábla | A korábbi 3. és 4. fejezet (kérdésfelvetés, változat-összehasonlítás, indoklás) és a 7. fejezet (döntési fa) teljesen törölve; a közös tábla `customer_id`-vel a dokumentum kiindulópontjaként, tényként szerepel |

## Szerkezeti következmények

- Fejezetszámozás újraosztva: `3. Javasolt adatbázis-struktúra`, `4. Mermaid — entitás-diagram`, `5. Nyitott kérdések` (6 kérdés), `6. Következő lépések`.
- Belső hivatkozások (`lásd 8. pont, N. kérdés`) átíródtak az új számozásra (`5. pont`).
- A mockup-hibák listája 10 → 8 elemre csökkent (a számlázási és a cégenkénti
  fejezetre hivatkozó pontok törölve/átfogalmazva).
- Az elnevezési konvenció példái (`billing_profiles`, `trialEndsAt`, `probaVege`)
  semleges példákra cserélődtek.

## Utólagos pontosítás — felhasználók céghez kötése

| Korábbi | Új |
|---|---|
| `iam.users` (platform-szintű) + `iam.customer_users` (tagság, több cég) | egyetlen tábla: **`iam.customer_users`**, kötelező `customer_id` FK-val, `ON DELETE CASCADE` |
| `membership_role` / `membership_status` enum | `customer_user_role` / `customer_user_status` |
| `contacts.user_id` | `contacts.customer_user_id` (+ összetett FK, hogy ugyanahhoz a céghez tartozzon) |
| `invited_by_user_id` | `invited_by_operator_id` (`iam.operators`) |
| `author_type` érték `user` | `customer_user` |

A `users` elnevezés eltűnt a dokumentumból; a mermaid entitás `CUSTOMER_USERS`
lett, a `USERS` entitás törölve, a `customer_users` index `(customer_id)`-re
változott, az e-mailre globális `UNIQUE lower(email)` index került.

## Nyitott maradt

A `docs/temp/12_ugyfelek_admin_mockup.html` mockup továbbra is tartalmazza a
szerződés-tabot és a számlázási blokkokat; a kód nincs érintve, mivel ez a
dokumentum csak tervezési javaslat (nincs migráció, nincs API).
