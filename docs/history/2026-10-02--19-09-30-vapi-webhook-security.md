# 2026-10-02 — VAPI webhook biztonság + prod CORS tisztítás

## Összefoglaló

Három, egymásra épülő védelmi vonalat hoztunk létre a bejövő VAPI
webhookok számára, és a CORS allow-listet visszavágtuk a ténylegesen
SPA-t futtató hostokra. A három védelmi vonal:

1. **CORS allow-list** (böngészős SPA-k): `CORS_ORIGINS` a
   `web.<DOMAIN>` + `admin.<DOMAIN>` hosztokra szűkült; az
   `api.<DOMAIN>` elem kikerült, mert nincs onnan induló SPA.
2. **Caddy útvonal-szűkítés** (olcsó 405 a nyilvánvalóan rossz
   kérésekre): a `handle @vapi_match` (`path /api/vapi/*` + `header
   X-Vapi-Signature *` + `method POST`) csak a helyes alakú kéréseket
   proxy-zza; minden más `/api/vapi/*` 405-öt kap, mielőtt a Fastify
   egy request slotot foglalna.
3. **NestJS HMAC guard** (tényleges kriptográfiai védelem): az
   `apps/api/src/vapi-webhooks/vapi-signature.guard.ts` újraszámolja
   a HMAC-SHA256-ot a `${X-Vapi-Timestamp}.${rawBody}` payload felett
   a `VAPI_WEBHOOK_SECRET` kulccsal, és `crypto.timingSafeEqual`-lel
   hasonlítja a `X-Vapi-Signature` headerhez.

A Caddy csak HEADereket lát, body-t NEM, ezért a HMAC ellenőrzést a
NestJS végzi. A `main.ts:bootstrap()` mostantól `rawBody: true` flaget
ad a `FastifyAdapter`-nek, hogy a Fastify a byte-exact body-t
`request.rawBody`-ként adja vissza — a JSON parser különben
megváltoztatná a body-t (kulcs-sorrend, unicode escape-ek, whitespace),
és érvénytelenítené a signature-et.

## Változtatott fájlok

| Fájl | Változás |
|---|---|
| [`apps/api/src/vapi-webhooks/vapi-signature.guard.ts`](../../apps/api/src/vapi-webhooks/vapi-signature.guard.ts) | Új HMAC-SHA256 + timestamp + raw body guard, fail-closed a hiányzó secretre, egységes 401 a kliens hibákra |
| [`apps/api/src/vapi-webhooks/vapi-webhooks.service.ts`](../../apps/api/src/vapi-webhooks/vapi-webhooks.service.ts) | In-memory event store (CallbackRequestsService mintára); a tényleges üzleti logika későbbi fázis |
| [`apps/api/src/vapi-webhooks/vapi-webhooks.controller.ts`](../../apps/api/src/vapi-webhooks/vapi-webhooks.controller.ts) | `POST /api/vapi/webhooks/tool-calls` + `POST /api/vapi/webhooks/end-of-call-report` a `@UseGuards(VapiSignatureGuard)` dekorátor mögött |
| [`apps/api/src/vapi-webhooks/vapi-webhooks.module.ts`](../../apps/api/src/vapi-webhooks/vapi-webhooks.module.ts) | Új bounded context (callback-requests testvér) |
| [`apps/api/src/vapi-webhooks/dto/vapi-event.dto.ts`](../../apps/api/src/vapi-webhooks/dto/vapi-event.dto.ts) | TypeScript interfész (`VapiEvent`) — csak a minimum mezőket rögzíti, a VAPI payload többi részét átengedi. **Nincs Zod** (sem futásidejű validáció): a 2026-10-06-i korrekció tisztázza ezt, lásd lentebb |
| [`apps/api/src/vapi-webhooks/vapi-signature.guard.spec.ts`](../../apps/api/src/vapi-webhooks/vapi-signature.guard.spec.ts) | Unit tesztek: helyes/helytelen/stale/missing-secret/rossz hex/raw body hiányat |
| [`apps/api/test/vapi-webhooks.e2e-spec.ts`](../../apps/api/test/vapi-webhooks.e2e-spec.ts) | E2E: 200 helyes signature, 401 helytelen/hiányzó/stale |
| [`apps/api/src/main.ts`](../../apps/api/src/main.ts:13) | `FastifyAdapter({ rawBody: true })` a HMAC számításhoz |
| [`apps/api/src/app.module.ts`](../../apps/api/src/app.module.ts:8) | `VapiWebhooksModule` import + regisztráció |
| [`infra/caddy/Caddyfile`](../../infra/caddy/Caddyfile:42) | `api.<DOMAIN>` blokk kiegészítve a `@vapi_match` named matcher + `/api/vapi/*` 405 fallback + explicit `/healthz` handle |
| [`infra/.env.example`](../../infra/.env.example:16) | `CORS_ORIGINS` rövidítés (csak web + admin); `VAPI_WEBHOOK_SECRET` komment kiegészítés a rotáció mechanizmussal |
| [`infra/.env`](../../infra/.env:17) | Ugyanaz a deploy source-of-truth oldalon (gitignored) |
| [`apps/api/.env.example`](../../apps/api/.env.example) | **Érintetlen** — a dev Vite proxy portok maradnak |
| [`docs/Specs/Caddy-Reverse-Proxy.md`](../../docs/Specs/Caddy-Reverse-Proxy.md) | §4.1 táblázat + új §4.4 a kétvonalas védelemről + mermaid diagram + rotáció parancs |
| [`docs/Specs/Production-Runbook.md`](../../docs/Specs/Production-Runbook.md) | §4.4 curl példa: 405 az edge-ről, 200 helyes signature-rel, 401 helytelennel |
| [`scripts/test/lib/10-services.sh`](../../scripts/test/lib/10-services.sh) | 5. és 6. smoke check: Caddy 405 + NestJS 200 HMAC round-trip |

## Anti-célok (szándékosan kihagyva)

- **IP allowlist** a Caddy szinten: a VAPI nem publikál fix
  IP-tartományt, ezért nem lenne karbantartható.
- **`vapi.com` a `CORS_ORIGINS`-ben**: a CORS csak böngészős
  kérésekre hat; a `vapi.com` felvétele böngészős JS-t engedne a
  domainről, biztonsági rést okozna, miközben a tényleges
  webhook-hitelesítéshez (HMAC) semmit nem adna.
- **`POST /api/callback-requests` authentikáció**: a publikus űrlap
  MVP-ben auth nélküli (tudatos trade-off, a CORS NEM oldja meg —
  curl-re nincs hatással).

## Verifikáció (deploy után)

```bash
SECRET="$(grep VAPI_WEBHOOK_SECRET /opt/aisztens/infra/.env | cut -d= -f2)"
BODY='{"message":{"id":"evt-123","type":"end-of-call-report","call":{"id":"call-456"}}}'
TS="$(date +%s)"
SIG="$(printf '%s' "${TS}.${BODY}" | openssl dgst -sha256 -hmac "${SECRET}" | sed 's/^.*= //')"

# 1. Helyes signature → 200
curl -i -X POST "https://api.aisztens.hu/api/vapi/webhooks/end-of-call-report" \
  -H "Content-Type: application/json" \
  -H "X-Vapi-Timestamp: ${TS}" \
  -H "X-Vapi-Signature: sha256=${SIG}" \
  -d "$BODY"

# 2. Helytelen signature → 401
curl -i -X POST "https://api.aisztens.hu/api/vapi/webhooks/end-of-call-report" \
  -H "Content-Type: application/json" \
  -H "X-Vapi-Timestamp: ${TS}" \
  -H "X-Vapi-Signature: sha256=deadbeef" \
  -d "$BODY"

# 3. Hiányzó signature → Caddy 405 (az edge-ről, NestJS-t nem éri el)
curl -i -X POST "https://api.aisztens.hu/api/vapi/webhooks/end-of-call-report" \
  -H "Content-Type: application/json" \
  -d "$BODY"

# 4. SPA CORS továbbra is működik
curl -i -H "Origin: https://web.aisztens.hu" \
  "https://api.aisztens.hu/api/callback-requests"
# Expect: 200 + access-control-allow-origin: https://web.aisztens.hu

# 5. api.aisztens.hu már nem CORS-olt
curl -i -H "Origin: https://api.aisztens.hu" \
  "https://api.aisztens.hu/api/callback-requests"
# Expect: nincs access-control-allow-origin header
```

A 3-as ellenőrzés egyben a Caddy `@vapi_match` named matcher
szintaxisának füstpróbája is. Ha a Caddy `@vapi_match` blokkban a
`path` direktíva nem path-prefixként viselkedik, a `path /api/vapi/*`
illesztés csendben meghibásodhat — a smoke teszt ezt is kimutatja.

## Következő lépések (nem része ennek a változtatásnak)

- A tényleges üzleti logika (assistant indítás, status update,
  follow-up akciók) a `VapiWebhooksService` helyett egy új
  `VapiEventProcessorService`-be kerüljön, és a Postgres
  perzisztenciával együtt valósuljon meg.
- A VAPI pontos payload-sémáját integrációkor a VAPI doksiból kell
  pontosítani (jelenleg a `VapiEvent` interfész mindent átenged, ami a
  minimum mezőkön kívül van — ez szándékos, hogy ne törjünk el, ha a
  VAPI új mezőt vezet be). Ha futásidejű validáció kell, az a Zod séma
  bevezetését jelenti, ami még nem történt meg.

## Korrekció — 2026-10-06

Ez a bejegyzés a **szándékot** írja le, de a munka nagy része ekkor még soha nem futott le.
A 2026-10-06-i audit (lásd [`docs/history/2026-10-06--12-45-00-vapi-webhook-runtime-fix.md`](2026-10-06--12-45-00-vapi-webhook-runtime-fix.md))
négy hibát talált, amelyek közül három önmagában is használhatatlanná tette a feature-t:

1. a guard `import type { ConfigService }` miatt a Nest nem tudta feloldani a dependenciát
   (`UnknownDependenciesException`) — **az egész API nem indult el**;
2. a `rawBody: true` a `FastifyAdapter`-nek lett átadva (ahol nem létezik) a Nest
   *alkalmazás* opció helyett — emiatt a `tsc` bukott, és a `request.rawBody` sosem lett kitöltve;
3. a Fastify adapter Bufferként adja a raw body-t, a guard viszont stringet várt → minden valódi
   webhook 401-et kapott volna;
4. a smoke checkek `log`-ot hívtak (nem létező függvény) → a teljes smoke suite elszállt a 4. check után.

Ezen felül a deployed droplet még mindig a VAPI előtti image-et futtatja
(`POST /api/vapi/webhooks/end-of-call-report` → 404 a NestJS-től), tehát a Caddyfile-módosítás
és a modul **soha nem került élesbe**. A fenti táblázat „Zod `passthrough()`” sora téves volt:
a DTO mindvégig TypeScript interfész volt.