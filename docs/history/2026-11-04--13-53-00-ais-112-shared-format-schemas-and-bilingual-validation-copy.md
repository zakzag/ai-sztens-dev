# AIS-112 — közös formátum-sémák + kétnyelvű validációs copy

**Dátum:** 2026-11-04
**Ticket:** AIS-112 (AIS-103 sub-task)
**Terv:** [`docs/plans/2026-11-04--00-45-00-ais-112-shared-format-schemas-and-hungarian-zod-messages-plan.md`](../plans/2026-11-04--00-45-00-ais-112-shared-format-schemas-and-hungarian-zod-messages-plan.md)
**Milestone:** [`docs/milestones/2026-11-04--13-53-00-ais-112-shared-validation-schemas.milestone.md`](../milestones/2026-11-04--13-53-00-ais-112-shared-validation-schemas.milestone.md)

## Mit kért a ticket

A formátum-ellenőrzés (e-mail, telefon E.164, adószám, IBAN, postai kód, dátum) **egy** helyen
legyen, és a felhasználó **magyar** hibaüzenetet kapjon. DoD: minden séma unit tesztelve
(érvényes / határérték / érvénytelen / üres / whitespace), adószám ellenőrző összeg, IBAN
ellenőrző összeg, telefonszám HU formákból E.164-re normalizálva, magyar üzenet a UI-ban
(egy RHF mező teszt), és zöld `@callback/shared` teszt.

## A fordulópont: a nyelvről szóló szabály

A első terv-változat a magyar szöveget a shared sémákba tette. A felhasználói pontosítás után
(„UI magyar, belső hiba angol”) ez nem volt jó: a `details[].message` a szerver fejlesztői
szövege ([`docs/Specs/API-Convention.md`](../Specs/API-Convention.md:83)), ezért a magyar
szöveg nem szivárogathat a szerver processzbe.

Megoldás: **egy szabály, két nyelv**. A `validation-message.const.ts` katalógus minden kulcsra
`en` és `hu` szöveget tart (totális record → egy hiányzó fordítás nem fordul le), a sémák pedig
**parse-időben** oldják fel a szöveget:

```ts
context.addIssue({ code: ZodIssueCode.custom, message: resolveMessage('IDENTIFIER') });
```

A locale default értéke `en`. A böngésző bundle-ben pontosan **két** hívás dönt:

| Hol | Hívás | Hatás |
| --- | --- | --- |
| `apps/admin/src/main.tsx` | `configureValidationLocale('hu')` | minden séma-üzenet magyarul |
| `apps/admin/src/pages/api-keys/ui/ApiKeyForm.tsx` | `zodResolver(schema, { errorMap: VALIDATION_ERROR_MAP })` | a zod **generált** issue-jai (`too_small`, `invalid_string`, …) is magyarul |

A `apps/api` egyiket sem hívja, tehát a `ZodBodyPipe` a zod default angol szövegét adja vissza —
a DoD és a szerződés is teljesül.

## Új fájlok (`packages/shared/src/contract/common/`)

| Fájl | Tartalom |
| --- | --- |
| `format.const.ts` | limitek, patternek, URL-protokoll whitelist, IBAN/adószám konstansok |
| `format-schema.interface.ts` | `TextSchemaOptions`, `IdentifierSchemaOptions` |
| `format-check.helper.ts` | `addValidationIssue`, `patternCheck` — parse-időben oldják fel a copy-t |
| `validation-message.{interface,const,helper}.ts` | a kétnyelvű katalógus + `resolveMessage`, `formatMessage`, locale-kezelés |
| `validation-error-map.{logic,const}.ts` | `VALIDATION_ERROR_MAP` (locale-aware `ZodErrorMap`) |
| `text.schema.ts` | `trimmedStringSchema`, `nonEmptyTextSchema`, `identifierSchema` |
| `email.schema.ts`, `url.schema.ts` | trim + lowercase e-mail; csak `http(s)` URL |
| `phone.helper.ts`, `phone.schema.ts` | `libphonenumber-js` (HU default) → E.164 transzform |
| `hu-tax-number.helper.ts`, `.schema.ts` | `XXXXXXXX-Y-ZZ` + ellenőrző számjegy |
| `hu-postal-code.schema.ts` | 4 számjegy |
| `iban.helper.ts`, `iban.schema.ts` | normalizálás + iteratív mod-97 |
| `date-only.helper.ts`, `.schema.ts` | `ÉÉÉÉ-HH-NN` **és** valós naptári nap |

Plusz `packages/shared/src/lib/date-only.ts` — a naptári nap ⇄ ISO instant konverzió (lokális
éjfél), amit eddig csak az admin `lib/date.ts` ismert.

## Viselkedésváltozások

1. **`createApiKeySchema` trimel** (`D6`): a `'   '` név most `400 VALIDATION_FAILED`, nem
   kerül `'   '` a DB-be; a `'  kulcs  '` érték trimmelve megy tovább.
2. **Az admin form-séma a shared kérés-sémából származik** (`D1`/`D2`):
   `createApiKeySchema.omit({description, expiresAt}).extend({…})`. A
   `API_KEY_FORM_VALIDATION_MESSAGES` és az `isExpiryInputAccepted` **törlődtek** — a limitek,
   a pattern és a szövegek egy helyen élnek.
3. Az `API_KEY_IDENTIFIER_MESSAGE` (angol szöveg-literál a sémában) törlődött; helyette a
   katalógus `IDENTIFIER` kulcsa.
4. Az admin teszt-setup `configureValidationLocale('hu')`-t hív, hogy a tesztek a valós UI
   nyelvét lássák.

## Tesztek

| Csomag | Eredmény |
| --- | --- |
| `@callback/shared` | **22 suite / 335 teszt** zöld (11 új spec) |
| `@callback/admin` | **267 teszt** zöld, benne a DoD-s RHF mező teszt (`ApiKeyForm`: magyar `REQUIRED`, magyar `IDENTIFIER`, magyar `TOO_LONG`) |

Az adószám-algoritmust három publikált, valós adószámon hitelesítettük (Magyar Telekom
`10773381-2-44`, OTP `10537914-4-44`, Richter `10484823-2-44`): mindhárom az
`(10 - Σ digitᵢ·wᵢ mod 10) mod 10` képletet adja `w = [9,7,3,1,9,7,3]` súlyokkal. Az IBAN
három valós példán (HU/DE/GB) és egy elrontott ellenőrző jegyű páron megy át.

## Dokumentáció

- [`docs/Specs/API-Convention.md`](../Specs/API-Convention.md:1): §1 katalógus-sorok + új §1.0
  („Rejection copy — one catalogue, two languages”), §3 `message` pontosítás, `Utolsó frissítés`.
- [`docs/Specs/UI-Architecture.md`](../Specs/UI-Architecture.md:1): új §4.3 („Form schemas and
  validation copy”), `Utolsó frissítés`.

## Nyitott pont

A `apps/api` `ConflictAppError` `details[].message`-e (`'This identifier is already taken.'`)
továbbra is kézzel írt angol szöveg. Nem hiba (a UI soha nem rendereli), de ha egységes
katalógust akarunk a szerver oldalon is, az egy következő, kis ticket.
