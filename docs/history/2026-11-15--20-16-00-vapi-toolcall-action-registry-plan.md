# Vapi tool-call fogadás + akció-registry — terv

**Dátum:** 2026-11-15 20:16
**Terv dokumentum:** [`docs/plans/2026-11-15--20-15-00-vapi-tool-call-action-registry-plan.md`](../plans/2026-11-15--20-15-00-vapi-tool-call-action-registry-plan.md)

## Kérés

Egyetlen végponton fogadni a Vapi kéréseit biztonsági réteg nélkül, a kérésből
eldönteni melyik cégről van szó, akciót futtatni egy **regiszterből** (bővíthető),
és a Vapi által elvárt választ visszaadni. Ehhez internetes kutatás a Vapi
payload-formátumokról, majd egy terv `.md` Mermaid diagrammal.

## Kutatás (élő Vapi dokumentáció, curl-lel letöltve)

| Oldal | Megállapítás |
| --- | --- |
| `docs.vapi.ai/server-url/events` | közös boríték: `{ "message": { "type", "call", ... } }`; csak 4 típusra vár válasz: `assistant-request`, `tool-calls`, `transfer-destination-request`, `knowledge-base-request` |
| ugyanott | `tool-calls`: `toolCallList[]` (`id`, `type`, `function.name`, `function.arguments`), válasz: `{ "results": [ { "name", "toolCallId", "result": "<JSON string>" } ] }` |
| ugyanott | `end-of-call-report`: `endedReason` + `artifact.transcript` / `artifact.messages` / `artifact.recording` |
| ugyanott | `assistant-request` esetén **7,5 s** fix válaszlimit (telefónia-cap) |
| `docs.vapi.ai/tools/custom-tools` | Function tool = `type: "function"` + `server.url` + `parameters` JSON-séma; tool-onként timeout állítható |
| `docs.vapi.ai/server-url/setting-server-urls` | a Vapi **Custom Credential**-t / saját HTTP headert használ — **nem** HMAC-ot |
| `docs.vapi.ai/api-reference/calls/create` | `metadata` az assistantön és `assistantOverrides`-on → a `call` objektumban visszajön |

**Következmény a meglévő kódra:** a [`vapi-signature.guard.ts`](../../apps/api/src/vapi-webhooks/vapi-signature.guard.ts:36)
HMAC (`X-Vapi-Signature`) feltevése nem egyezik a Vapi valós mechanizmusával — ezt a
terv későbbi ütemre teszi, az MVP egyszerű megosztott headert használ.

## Terv tartalma (összefoglalva)

- **Egy végpont:** `POST /api/vapi/webhooks` + `VapiEventDispatcher` (`message.type` → handler).
- **Tenant-feloldás:** `call.metadata.customerId` → telefonszám alapú `customers` lookup → `unresolved`.
- **Akció-registry:** `Map<name, { description, parameters: ZodSchema, handler }>`; a Vapi tool-definíciók
  a registry-ből generálódnak (`GET /api/vapi/tools`), így új akció = egy fájl + `register()`, dispatcher-változás nélkül.
- **3 MVP akció:** `lookupCustomer`, `createNote` (→ `activity.activities`), `requestCallback`.
- **DB:** `vapi.vapi_calls` + `vapi.tool_invocations` (2 tábla, Drizzle migrációval).
- **Válasz:** `{ results: [ { name, toolCallId, result } ] }`, a `result` JSON-string.
- **Kimarad most:** hitelesítés, jogosultság, előfizetés, sor/retry, `assistant-request`, audit-integráció.
- Két Mermaid diagram: komponens-flowchart és tool-call szekvencia.

## Utólagos részletesítés

A terv kibővítve implementációs mélységre: Vapi-oldali beállítási checklist, mind a
hat eseménytípus wire contractja, a tenant/akció/paraméter döntési lánc, fájlonkénti
implementációs lista kód-skeccsekkel (shared Zod séma, `ActionRegistry`,
`TenantResolver`, `VapiEventDispatcher`, 3 handler), 3 táblás `vapi` séma DDL-szerűen,
HTTP- és `result`-szintű hibakód tábla, teszttábla, 9 lépéses sorrend elfogadási
kritériumokkal, env változók, kézi ellenőrzés.

Új megállapítás a részletesítésből: a **hívott telefonszám → cég** mappinghez kell egy
`vapi.phone_numbers` tábla (mert a `customers` táblában nincs cégszintű telefonszám, a
`contacts` telefon kontakt-szintű), és a `zod-to-json-schema` dependency szükséges a
registry → Vapi tool-definíció generáláshoz (Zod 3 mellett nincs natív `toJSONSchema`).

## Megjegyzés

A kutatáshoz letöltött Vapi `.md` oldalak (`docs/temp/_vapi-*.md`) ideiglenesek voltak,
a terv összeállítása után törölve; a hivatkozások a tervben URL-ként szerepelnek.
