# Prompt: VAPI webhook biztonságos fogadása és prod CORS tisztítás

**Dátum:** 2026-10-02
**Típus:** archív felhasználói prompt
**Konverzió:** 2026-10-05 — `docs/prompts/2026-10-02-vapi-webhook-security.txt` → `.md` formátum

---

## Kontextus

A projekt egy NestJS + Fastify alapú monórepo (`apps/api`, `apps/web`, `apps/admin`, `packages/shared`), ami DigitalOcean dropleten Docker Compose-szal fut. A runtime stack 4 konténer: `api` (NestJS + Fastify :3000), `postgres`, `caddy` (reverse proxy + Let's Encrypt), `monitor` (curl-alapú watchdog). A deploy-t a [`deploy/deploy.sh`](../../deploy/deploy.sh) és a [`.github/workflows/deploy.yml`](../../.github/workflows/deploy.yml) végzi. A Caddyfile template-ből renderelődik a deploy során (a `<DOMAIN>` és `<ACME_EMAIL>` placeholder-eket a [`deploy/deploy.sh:render_caddyfile()`](../../deploy/deploy.sh) cseréli ki).

## A jelenlegi állapot

- A [`apps/api/src/`](../../apps/api/src/) jelenleg két modult tartalmaz: `callback-requests` (`POST /api/callback-requests`, `GET /api/callback-requests`, `GET /api/callback-requests/:id`, in-memory Map tároló) és `health` (`/healthz`, ami szándékosan a NestJS api globális prefixen kívül van).
- VAPI webhook fogadó controller **NINCS** — a `VAPI_WEBHOOK_SECRET` env változót a [`infra/.env.example`](../../infra/.env.example) definiálja (`change-me-vapi-secret` placeholder), és a droplet [`infra/.env`](../../infra/.env) fájljában is be van állítva, de **SENKI** nem olvassa.
- A Caddyfile ([`infra/caddy/Caddyfile`](../../infra/caddy/Caddyfile)) három site block-ot tartalmaz: `api.<DOMAIN>` (`reverse_proxy api:3000`), `web.<DOMAIN>` (static SPA + `handle /api/*` safety-net), `admin.<DOMAIN>` (ugyanaz). A Caddyfile **TEMPLATE**, a futó konténer a `Caddyfile.rendered`-et olvassa, amit a `deploy.sh` generál.
- A CORS a [`apps/api/src/main.ts:23`](../../apps/api/src/main.ts:23)-ban van: a `process.env.CORS_ORIGINS`-t split-eli, és ha a lista nem üres, explicit allow-list; ha üres, `origin: true` (legmegengedőbb).
- A droplet `CORS_ORIGINS` jelenleg: `https://api.aisztens.hu,https://web.aisztens.hu,https://admin.aisztens.hu` — az `api.aisztens.hu` felesleges, mert nincs onnan induló SPA.
- A `ConfigModule.forRoot({ isGlobal: true })` az [`apps/api/src/app.module.ts:10`](../../apps/api/src/app.module.ts:10)-ben — default `process.cwd()/.env`, prod-ban nem érhető el, mert a `**/.env` ki van zárva az image-ből ([`infra/app/.dockerignore:2`](../../infra/app/.dockerignore:2)). A prod értékek kizárólag a compose `environment:`-ből jönnek.
- A Caddy csak a host és path alapján route-ol, jelenleg nincs útvonal-szűkítés és nincs forrás-ellenőrzés.

## A felhasználó kérése

Az API-t csak a VAPI.com (webhook), a `web.aisztens.hu` és az `admin.aisztens.hu` hívhassa. Ez három jól elkülöníthető szabályt kever:

1. A VAPI webhook valódi védelme (HMAC aláírás + útvonal-szűkítés) — jelenleg **TELJESEN** hiányzik.
2. A böngészős CORS allow-list tisztítása — az `api.aisztens.hu` elem kikerül.
3. A publikus űrlap (`POST /api/callback-requests`) auth nélkülisége — ez a CORS-szal **NEM** oldható meg, mert a curl-re nincs hatással. Ez tudatosan vállalt trade-off.

> **FONTOS:** A CORS kizárólag böngészős kérésekre hat, a szerver-szerver hívásra (mint a VAPI webhook) **NEM**. A `vapi.com` felvétele a `CORS_ORIGINS`-be **HATÁSTALAN** és **RONTJA** a biztonságot, mert böngészős JS-t engedne a `vapi.com`-ról. **NE TEDD.**

## A megoldás

Három, egymásra épülő védelmi vonal:

1. **CORS allow-list** (böngészős SPA-k védelme): `https://web.aisztens.hu,https://admin.aisztens.hu`
2. **Caddy útvonal-szűkítés** (olcsó 405 a nyilvánvalóan rossz kérésekre): a `/api/vapi/*` útvonal CSAK `POST` + `X-Vapi-Signature` header esetén megy tovább a NestJS-hez, egyébként 405.
3. **NestJS HMAC guard** (tényleges védelem): `VapiSignatureGuard` ellenőrzi a `X-Vapi-Signature` headert a `VAPI/WEBHOOK_SECRET` alapján. A Caddy header matcher csak HEADereket lát, a body-t **NEM**, ezért a HMAC ellenőrzést a NestJS-nek kell elvégeznie.

## Implementációs lépések, három PR-re bontva

### PR #1 — VapiSignatureGuard skeleton (kis, önálló, nincs route engedélyezve)

- Hozz létre `apps/api/src/vapi-webhooks/` mappát a `callback-requests` testvér-bounded context mintájára.
- Fájlok: `vapi-webhooks.module.ts`, `vapi-webhooks.controller.ts` (egyelőre üres), `vapi-webhooks.service.ts` (üres), `vapi-signature.guard.ts`, `dto/vapi-event.dto.ts`.
- A `VAPI_WEBHOOK_SECRET` olvasása `ConfigService.get('VAPI_WEBHOOK_SECRET')` metódussal.
- A [`apps/api/src/main.ts:9`](../../apps/api/src/main.ts:9)-ben a `FastifyAdapter`-en engedélyezd a `rawBody`-t, mert a HMAC számításához a nyers JSON body kell (a parser különben módosítja a body-t). A Fastify-nél az `addContentTypeParser('application/json', { parseAs: 'string' })` kell, vagy a Nest `FastifyAdapter` `rawBody: true` flag-je.
- A `VapiSignatureGuard.canActivate` logikája:
    1. Secret olvasása (ha hiányzik → 500 fail-closed).
    2. `X-Vapi-Signature` + `X-Vapi-Timestamp` header olvasása (timestamp tolerance: 300 sec, opcionális `VAPI_WEBHOOK_TIMESTAMP_TOLERANCE_SEC` env-vel felülírható).
    3. Raw body lekérése a request-ből.
    4. ``expected = HMAC_SHA256(secret, `${timestamp}.${rawBody}`)`` hex formában.
    5. `timingSafeEqual(expected, signatureHeader)` — `crypto.timingSafeEqual`.
    6. Ha bármely lépés hibás → 401, **NE** 500 (így nem szivárogtatunk információt).
- Unit tesztek a `vapi-signature.guard.spec.ts` fájlban: helyes HMAC → 200, helytelen → 401, lejárt timestamp → 401, hiányzó secret → 500.
- A PR #1 végén a controller üres, tehát a futó rendszerre nincs hatás — rollback nincs mit csinálni.

### PR #2 — VapiWebhookController + Caddy route (közepes)

- A `VapiWebhookController` végpontjai: `POST /api/vapi/webhooks/tool-calls` és `POST /api/vapi/webhooks/end-of-call-report`. A tényleges feldolgozás most csak service-szintig megy: a service eltárolja az eseményt in-memory Map-ben (a `CallbackRequestsService` mintájára) és 200-zal válaszol. A tényleges üzleti logika (assistant indítás, status update) egy későbbi fázis.
- A controller a `@UseGuards(VapiSignatureGuard)` dekorátorral védett.
- A `VapiEventDto` Zod-validációhoz (`packages/shared/src/schemas/` mintára) — a pontos VAPI payload sémát a VAPI doksiból kell ellenőrizni implementációkor.
- A Caddyfile ([`infra/caddy/Caddyfile:43`](../../infra/caddy/Caddyfile:43)) `api.<DOMAIN>` blokkját egészítsd ki:

  ```caddyfile
  handle /api/vapi/* {
      @vapi_has_sig header X-Vapi-Signature *
      @vapi_post method POST
      handle_response @vapi_has_sig @vapi_post {
          reverse_proxy api:3000
      }
      respond "Method Not Allowed" 405
  }
  handle /api/* { reverse_proxy api:3000 }
  handle /healthz { reverse_proxy api:3000 }
  ```

- A [`deploy/deploy.sh:render_caddyfile()`](../../deploy/deploy.sh) placeholder-szinkron marad (nincs új `<...>` token).
- E2E teszt az `apps/api/test/vapi-webhooks.e2e-spec.ts` fájlban: teljes POST flow helyes signature-rel → 200, helytelen signature-rel → 401.
- A smoke teszt ([`scripts/test/lib/10-services.sh`](../../scripts/test/lib/10-services.sh)) bővítése: `curl -X POST /api/vapi/webhooks/test` endpointra helyes signature-rel → 200; Caddy 405-öt ad, ha `X-Vapi-Signature` header nélkül próbálkozunk.

### PR #3 — Prod CORS tisztítás + doksi (kis)

- [`infra/.env.example:15`](../../infra/.env.example:15) `CORS_ORIGINS` sor rövidítése: `CORS_ORIGINS=https://web.aisztens.hu,https://admin.aisztens.hu` (az `api.aisztens.hu` kikerül).
- Droplet [`infra/.env`](../../infra/.env) `CORS_ORIGINS` frissítése (compose restart nélkül, a deploy indítja).
- [`docs/Specs/Production-Runbook.md`](../Specs/Production-Runbook.md) §4.4 „Belső service-ek" bővítése: `curl -X POST` HMAC fejléccel példa, hogy az üzemeltető lássa, hogyan kell helyes webhookot küldeni.
- [`docs/Specs/Caddy-Reverse-Proxy.md`](../Specs/Caddy-Reverse-Proxy.md) §4 bővítése: a `/api/vapi/*` blokk dokumentálása.
- [`infra/.env.example`](../../infra/.env.example) `VAPI_WEBHOOK_SECRET` komment kiegészítése: „HMAC-SHA256 kulcs a VAPI webhook hitelesítéshez, rotáció: `docker compose up -d --no-build api`".

## Konvenciók és szabályok, amiket a kódnak követnie kell

- SOLID, clean coding: minden osztálynak egy felelőssége, függőségek absztrakciók felé (nem konkrét implementációk felé).
- A [`.roo/rules/general.coding-standards.md`](../../.roo/rules/general.coding-standards.md) szabályai: switch on strict mode, always handle errors, always write unit tests, always write documentation.
- A [`.roo/rules/instructions.md`](../../.roo/rules/instructions.md) szerint a kódnak módosítása után `docs/history/<YYYY-MM-DD--HH-ii-ss>-<short description>.md` bejegyzést kell írni, és ha a milestone-kritériumok (nem-triviális bugfix, nagy vagy kockázatos változás, design döntést megőrzendő feature) teljesülnek, akkor `docs/milestones/<YYYY-MM-DD--HH-ii-ss>-<short description>.milestone.md` is.
- A specs docs élő dokumentumok (`docs/Specs/`), a kód/config változásával együtt frissíteni kell a `Production-Runbook.md` és a `Caddy-Reverse-Proxy.md` fájlokat.
- A service-ek nevei (`callback-requests` mintájára) többes számban legyenek.
- A Vite dev proxy portok: web 5173, admin 5174, api 3000 — az [`apps/api/.env`](../../apps/api/.env) CORS listája most: `http://localhost:5173,http://localhost:5174,http://127.0.0.1:5173,http://127.0.0.1:5174` (ez nem változik).
- A commit üzenetek formátuma: rövid összefoglaló + opcionális body.
- A branch neve: `feat/vapi-webhook-security` (vagy PR-enként: `feat/vapi-signature-guard-skeleton`, `feat/vapi-webhook-controller-and-route`, `feat/prod-cors-cleanup-and-docs`).

## Verifikáció, amit a PR #2 + PR #3 deploy után futtatni kell

```bash
# 1. Helyes signature-rel → 200
SECRET="$(grep VAPI_WEBHOOK_SECRET /opt/aisztens/infra/.env | cut -d= -f2)"
BODY='{"message":{"id":"evt-123","type":"end-of-call-report","call":{"id":"call-456"}}}'
SIG=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "$SECRET" | sed 's/^.*= //')
curl -i -X POST "https://api.aisztens.hu/api/vapi/webhooks/end-of-call-report" \
  -H "Content-Type: application/json" \
  -H "X-Vapi-Signature: sha256=$SIG" \
  -d "$BODY"
# Expect: 200 OK

# 2. Helytelen signature → 401
curl -i -X POST "https://api.aisztens.hu/api/vapi/webhooks/end-of-call-report" \
  -H "Content-Type: application/json" \
  -H "X-Vapi-Signature: sha256=deadbeef" \
  -d "$BODY"
# Expect: 401 Unauthorized

# 3. Hiányzó signature → Caddy 405
curl -i -X POST "https://api.aisztens.hu/api/vapi/webhooks/end-of-call-report" \
  -H "Content-Type: application/json" \
  -d "$BODY"
# Expect: 405 Method Not Allowed (Caddy)

# 4. SPA CORS továbbra is működik
curl -i -H "Origin: https://web.aisztens.hu" \
  "https://api.aisztens.hu/api/callback-requests"
# Expect: 200 + access-control-allow-origin: https://web.aisztens.hu

# 5. api.aisztens.hu már nem CORS-olt
curl -i -H "Origin: https://api.aisztens.hu" \
  "https://api.aisztens.hu/api/callback-requests"
# Expect: nincs access-control-allow-origin header
```

## Kockázatok, amiket a kódnak kezelnie kell

- A VAPI HMAC séma verzióváltása: a guard konfigurálható séma-verziót támogasson (opcionális `VAPI_WEBHOOK_SIGNATURE_VERSION` env).
- A Fastify `rawBody` bekapcsolásának más endpointokra gyakorolt hatása: minimális, de a smoke tesztekben a `/healthz` és `/api/callback-requests` is legyenek benne.
- A secret soha **NE** kerüljön a konténer logjába: a guard **NEM** logolja a secretet, csak a valid/invalid státuszt és a `message.id`-t.
- A `VAPI_TIMESTAMP` tolerancia: ha nincs timestamp header, a guard 401-et ad, **NE** 200-at.

## Anti-célok (szándékosan nem tesszük)

- IP allowlist a Caddy szinten (a VAPI nem publikál fix IP-tartományt).
- A `vapi.com` felvétele a `CORS_ORIGINS`-be (hatástalan + biztonsági rést okoz).
- A `/api/callback-requests` POST authentikációja (a publikus űrlap auth nélküli a MVP-ben).

## Jóváhagyás előtt tisztázandó

1. A VAPI pontos HMAC séma: a `X-Vapi-Signature` header formátuma (`sha256=<hex>` vagy más), a body a nyers JSON-e vagy a `${timestamp}.${body}` concat-ot használja-e.
2. A PR-bontás (három PR) vagy egyszerre egyben.
3. A `VAPI_WEBHOOK_SECRET` rotáció mechanizmusa: `docker compose up -d --no-build api` (image rebuild nélkül).
