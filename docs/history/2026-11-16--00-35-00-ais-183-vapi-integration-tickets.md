# AIS-183 — Vapi integráció story + subtaskok

**Dátum:** 2026-11-16 00:35
**Terv:** [`docs/plans/2026-11-15--20-15-00-vapi-tool-call-action-registry-plan.md`](../plans/2026-11-15--20-15-00-vapi-tool-call-action-registry-plan.md)

## Létrehozott ticketek

| Ticket | Típus | Tartalom | Függ |
| --- | --- | --- | --- |
| AIS-183 | Story | Vapi webhook végpont + akció-registry (MVP) | AIS-18, AIS-177 |
| AIS-184 | Subtask | `vapi` séma: `vapi_calls`, `tool_invocations`, `phone_numbers` + repository-k | AIS-18 |
| AIS-185 | Subtask | akció-registry + 3 akció (`lookupCustomer`, `createNote`, `requestCallback`) | AIS-184, AIS-177 |
| AIS-186 | Subtask | webhook végpont, token guard, tenant resolver, dispatcher, válasz-mapper | AIS-185 |
| AIS-187 | Subtask | `GET /api/vapi/tools` a registryből | AIS-185 |
| AIS-188 | Subtask | hívás-perzisztencia (`end-of-call-report`, `status-update`) | AIS-186 |

## Kulcselemek a storyban

- **Előfeltételek külön táblázatban:** AIS-18 (`customers`, `contacts`, `operators`),
  AIS-177 (`activities`), AIS-14 (konvenciók) — blokkolóként jelölve.
- **Készítési sorrend:** AIS-184 → AIS-185 → AIS-186 → AIS-187 / AIS-188.
- **Döntések:** egy webhook végpont, token-guard (nem HMAC), `result` = JSON-string,
  üzleti hiba `results` elem, tenant a `call` objektumból.
- **Kézi beállítás** (Server URL, 3 tool, teszt-hívás) a story DoD része, nem külön ticket.
- A részletes wire contract, DDL és kód-skeccsek a tervben maradtak — a ticketek csak a
  szükséges minimumot tartalmazzák.

## Javítás — a repó tényleges adatmodell-mintája (2026-11-16 00:41)

Az első verzió „SQL séma létrehozása" nyelvezetet használt, ami nem felel meg a repó
gyakorlatának. A kód átnézése után a mintát rögzítettük:

| Réteg | Valós minta | Fájl |
| --- | --- | --- |
| Futásidejű alakok, validáció | **Zod sémák** a shared contractban, típusok `z.infer`-rel | `packages/shared/src/contract/api-keys/api-keys.schema.ts` |
| Tábla deklaráció | Drizzle **schema-as-code** (`pgSchema`, kiírt `snake_case` oszlopok, nevesített kényszerek, `TIMESTAMP_PRECISION`, `$inferSelect`/`$inferInsert`) | `apps/api/src/db/schema.ts` |
| SQL | **generált** (`db:generate`), kézzel nincs | `apps/api/drizzle/*.sql` |
| DB-hozzáférés | repository interfész + Drizzle impl, `@Inject(DATABASE)` | `apps/api/src/api-keys/api-keys.repository.ts` |
| Séma-teszt | `getTableConfig()` + a committed migráció szövege | `apps/api/src/db/schema.spec.ts` |

Ennek megfelelően átírtuk:

- **AIS-183** — új „Konvenciók" szekció (Zod minden futásidejű alakra, tábla a
  `db/schema.ts`-ben, repository-n át, `schema.spec.ts`), DoD frissítve;
- **AIS-184** — átnevezve „adatmodell (zod séma + tábla deklaráció) és repository-k";
  Zod sémalista, `db/schema.ts` deklaráció, repository-k, `schema.spec.ts` teszt;
- **AIS-185** — akciónkénti Zod param-sémák a shared contractban (`.strict()`),
  handlerek `schema.parse`-szal;
- **AIS-186** — a bejövő body `safeParse` a shared sémával (a `ZodBodyPipe` nem jó, mert a
  Vapi saját hibaformátumot vár), guard-config átírás;
- **AIS-187** — Zod → JSON Schema generálás;
- **AIS-188** — perzisztencia repository-n át, row → Zod alak `.parse()`-szal.

A terv `§5.3`-a is kiegészült ezzel a négy ponttal (zod séma / `db/schema.ts` deklaráció /
generált SQL / `schema.spec.ts`), és a benne lévő kódblokk mostantól explicit a
`db/schema.ts` deklaráció vázlata.

## OpenAPI hatás (2026-11-16 01:02)

A két új végpont raw (`@SkipEnvelope()`), ezért **nem** kerül be az `API_ENDPOINTS`-be, és a
Swagger-generátor nem publikálja őket (`endpoint-registry.test.ts`: „keeps exempt routes out
of the enveloped registry”). Azaz **az OpenAPI dokumentum tartalma nem változik**, de a
contract gate-ek igen:

| Fájl | Változás |
| --- | --- |
| `packages/shared/src/contract/endpoint.registry.ts` | két régi VAPI path törlése; `/api/vapi/webhooks` + `/api/vapi/tools` felvétele indoklással |
| `apps/api/src/common/http/envelope-exemptions.spec.ts` | dekorált route ⇄ `ENVELOPE_EXEMPTIONS` egyezés frissítése |
| `apps/api/test/envelope-exemptions.e2e-spec.ts` | modul-gráf kétirányú egyezés |
| `apps/api/test/envelope-contract.e2e-spec.ts`, `test/lib/controller-audit.ts` | audit a Nest metadatából |
| `apps/api/test/app-boot.e2e-spec.ts`, `apps/api/test/vapi-webhooks.e2e-spec.ts`, `apps/api/src/common/http/api-exception.filter.spec.ts` | path-frissítés / token guardra átírás |

Rögzítve: **AIS-186** (új „OpenAPI és contract gate-ek" szekció + DoD pont),
**AIS-187** (a `/api/vapi/tools` exempt bejegyzése), és egy magyarázó komment az AIS-183
story-n.
