# Terv: VAPI webhook biztonság és prod CORS tisztítás

**Dátum:** 2026-10-02 (Europe/Budapest)
**Státusz:** megvalósítva — a 2026-10-06-i audit szerint az első implementáció nem futott le
(guard DI, `rawBody` opció, Buffer raw body, smoke checkek); a javítás és a hiányzó tesztek
(`vapi-webhooks.service.spec.ts`, `vapi-webhooks.controller.spec.ts`, boot teszt) elkészültek.
Lásd: [`docs/history/2026-10-06--12-45-00-vapi-webhook-runtime-fix.md`](../docs/history/2026-10-06--12-45-00-vapi-webhook-runtime-fix.md)
**Szerző:** architect mode (Zoo)
**Érintett területek:** [`infra/caddy/Caddyfile`](../../infra/caddy/Caddyfile:42), [`apps/api/src/`](../../apps/api/src/), [`infra/.env.example`](../../infra/.env.example:33), [`docs/Specs/Production-Runbook.md`](../../docs/Specs/Production-Runbook.md)

---

## 0. Miért kell ez?

A felhasználó kérése: az API-t **csak a VAPI webhook, a web.aisztens.hu és az admin.aisztens.hu hívhassa**. Ez a kérés három jól elkülöníthető szabályt kever:

1. **A VAPI webhook valódi védelme** (auth + útvonal-szűkítés) — jelenleg **teljesen hiányzik**, mert nincs webhook controller.
2. **A böngészős CORS allow-list** — ezt a [`main.ts:23`](../../apps/api/src/main.ts:23) olvassa, és a dropleten most `https://api.aisztens.hu,https://web.aisztens.hu,https://admin.aisztens.hu` — a felesleges `api.aisztens.hu` eltávolítandó.
3. **A publikus űrlap (`POST /api/callback-requests`) auth nélkülisége** — ezt a CORS nem tudja megoldani, mert a `curl`/`Postman` hívásokra nincs hatással. Ez a jelenlegi MVP-scope része, és a CORS-szal nem szüntethető meg.

A terv csak az első két pontra szól; a harmadik dokumentálva lesz mint tudatosan vállalt trade-off.

---

## 1. Célok (S, M, K)

### Funkcionális célok
- **F1.** A VAPI kizárólag a `POST https://api.aisztens.hu/api/vapi/webhooks/...` útvonalon éri el az API-t, és kizárólag érvényes `X-Vapi-Signature` HMAC-SHA256 aláírással.
- **F2.** A Caddy **nem proxyzik tovább** más forrásból (pl. böngésző cross-origin) jövő kérést ezen az útvonalon: minden más forrást 405-tel (vagy 404-gyel) utasítson vissza.
- **F3.** A böngészős CORS allow-list csak a tényleges SPA-origineket tartalmazza (`https://web.aisztens.hu`, `https://admin.aisztens.hu`); az `https://api.aisztens.hu` elem kikerül.

### Nem-funkcionális célok
- **N1.** Meglévő nyilvános végpontok (`POST /api/callback-requests`, `GET /api/callback-requests`, `GET /api/callback-requests/:id`) **változatlanul** működjenek a publikus űrlap és admin-oldal felől.
- **N2.** A `/healthz` healthcheck **változatlanul** elérhető maradjon a Docker healthcheck + monitor watchdog számára.
- **N3.** A titokforgatás üzemeltethető legyen **image-rebuild nélkül** (env mount, compose `secrets:` későbbi fázis).
- **N4.** A szabály **tesztelhető** legyen: unit + e2e + smoke tesztek.

### Anti-célok (szándékosan nem tesszük)
- Nem írunk IP-allowlistet (Caddy szinten), mert a VAPI nem publikál fix IP-tartományt; ez holnap változhat.
- Nem tesszük a VAPI-t a `CORS_ORIGINS` listába — ez hatástalan a szerver-szerver hívásra, és rontja a biztonságot (böngészős JS-t engedne a vapi.com-ról).

---

## 2. Az aktuális állapot — mért bizonyítékok

| # | Ellenőrzés | Eredmény |
|---|---|---|
| 1 | Droplet `/opt/aisztens/infra/.env` `CORS_ORIGINS` (csak origin-értékek) | `https://api.aisztens.hu`, `https://web.aisztens.hu`, `https://admin.aisztens.hu` |
| 2 | `apps/api/src/` — VAPI/webhook keresés | **0 találat** — webhook controller nem létezik |
| 3 | [`infra/caddy/Caddyfile:43`](../../infra/caddy/Caddyfile:43) — `api.<DOMAIN>` block | egyetlen `reverse_proxy api:3000`, nincs útvonal-szűkítés, nincs forrás-ellenőrzés |
| 4 | [`infra/caddy/Caddyfile:53`](../../infra/caddy/Caddyfile:53) — `web.<DOMAIN>` block | tartalmaz `handle /api/*` safety-net proxy-t; a webhook útvonal ide is beesik, ha a VAPI oda hívna (nem fog, mert a VAPI az `api.*` hostot használja, de védendő) |
| 5 | [`infra/caddy/Caddyfile:67`](../../infra/caddy/Caddyfile:67) — `admin.<DOMAIN>` block | ugyanaz a safety-net; kockázat csak elméleti, de érdemes blokkolni |
| 6 | `apps/api/src/main.ts:23` CORS logika | `(process.env.CORS_ORIGINS ?? '').split(',').map(...).filter(Boolean)` — üres lista → `origin: true` (legmegengedőbb) |
| 7 | [`apps/api/src/app.module.ts:10`](../../apps/api/src/app.module.ts:10) | `ConfigModule.forRoot({ isGlobal: true })` — default `process.cwd()/.env`, prodban nem érhető el, mert `**/.env` ki van zárva az image-ből ([`infra/app/.dockerignore:2`](../../infra/app/.dockerignore:2)) |
| 8 | `VAPI_WEBHOOK_SECRET` | `infra/.env.example:17` definiálja, de sehol nem olvasva; a dropleten jelenleg is be van állítva (az `infra/.env` kulcslistája tartalmazza) |

---

## 3. Architektúra

Három, egymásra épülő védelmi vonal:

```
                +---------------------+
                | Böngésző (SPA)      |    Védelem: CORS allow-list (web., admin.)
                | CORS preflight +    |    (Caddy nem véd a curl ellen — ez NEM
                | then actual call    |     auth, csak olvasás-blokkoló)
                +----------+----------+
                           |
                           v
+-----------+     +---------------------+     +---------------------+
|  curl /   |     |   Caddy reverse     |     |  NestJS /api/vapi/   |
|  Postman  |---->|   proxy (Caddyfile) |---->|  webhooks/*          |
|  bármely  |     |                     |     |  + VapiSignatureGuard|
|  forrás   |     |  - útvonal-szűkítés |     |  + HMAC-SHA256 check |
+-----------+     |  - header-pivot     |     +---------------------+
                  +---------------------+
                           ^
                           |
                  +---------------------+
                  | VAPI.com szerver    |    HMAC: X-Vapi-Signature
                  | (egyetlen          |    = HMAC_SHA256(secret, body)
                  |  megbízható küldő) |    + ts tolerance: ±5 min
                  +---------------------+
```

A három védelmi vonal **egymást erősíti**:
1. **CORS** megakadályozza, hogy egy **böngésző** cross-origin weboldal JS-e olvassa a válaszokat.
2. **Caddy útvonal-szűkítés** megakadályozza, hogy a VAPI-n kívül bármely más forrás a `/api/vapi/*` útvonalra küldjön POST-ot (405-öt ad vissza nem-VAPI user-agentnek / hiányzó headernek).
3. **NestJS HMAC-guard** elfogadja a kérést, ha az aláírás érvényes, és visszadobja (401), ha nem.

---

## 4. Komponens-tervek

### 4.1 NestJS oldal — `VapiSignatureGuard` + `VapiWebhookController`

Új module: [`apps/api/src/vapi-webhooks/`](../../apps/api/src/vapi-webhooks/) (a `callback-requests` testvér-bounded context mintájára).

**Fájlok:**
- `apps/api/src/vapi-webhooks/vapi-webhooks.module.ts`
- `apps/api/src/vapi-webhooks/vapi-webhooks.controller.ts`
- `apps/api/src/vapi-webhooks/vapi-webhooks.service.ts`
- `apps/api/src/vapi-webhooks/vapi-signature.guard.ts`
- `apps/api/src/vapi-webhooks/vapi-webhooks.service.spec.ts`
- `apps/api/src/vapi-webhooks/vapi-webhooks.controller.spec.ts`
- `apps/api/src/vapi-webhooks/vapi-signature.guard.spec.ts`
- `apps/api/src/vapi-webhooks/dto/vapi-event.dto.ts` (az event payload Zod-validációhoz)

**Funkcionalitás:**

```ts
// VapiSignatureGuard — canActivate
// 1. Secret olvasása: ConfigService.get('VAPI_WEBHOOK_SECRET')
//    (környezeti változóból, dotenv-ből, vagy docker secrets-ből)
// 2. Header olvasása: X-Vapi-Signature + X-Vapi-Timestamp (5 perc tolerance)
// 3. Raw body lekérése (Fastify rawBody szükséges a HMAC számításhoz!)
// 4. expected = HMAC_SHA256(secret, `${timestamp}.${rawBody}`)
// 5. timingSafeEqual(expected, signatureHeader)
// 6. Ha bármely lépés hibás → 401, NE 500 (így nem szivárogtatunk információt)
// 7. Ha ok → return true
```

**Fastify rawBody engedélyezés** — ez kritikus, mert az Express JSON parser módosítja a body-t (whitespace, sorrend), és a HMAC ellenőrzés megbízhatatlan lesz. A [`main.ts`](../../apps/api/src/main.ts:9) jelenleg `NestFactory.create` + `FastifyAdapter` — a Fastify `addContentTypeParser('application/json', { parseAs: 'string' })` kell, vagy a NestJS `rawBody: true` flag. **Ez egy rejtett lábnyom, a tervben kiemelve.**

**HMAC specifikáció:** a VAPI jelenlegi ajánlása `X-Vapi-Signature: sha256=<hex>` formátumú headert küld, ahol a számítás: `HMAC_SHA256(secret, body)` (a timestamp-et egyes rendszerekben külön headerben küldik). A pontos specifikáció a VAPI doksiból ellenőrizendő implementációkor; a guard támogatja a konfigurálható séma-verziót.

**Controller végpontok (kezdeti scope):**
- `POST /api/vapi/webhooks/tool-calls` — a VAPI assistant tool-kérései
- `POST /api/vapi/webhooks/end-of-call-report` — hívás végén kapott jelentés
- A jövőben bővíthető: `assistant-request`, `status-update`, `transcript`, stb.

A tényleges feldolgozás most **csak a service-szintig** megy: a service eltárolja az eseményt (in-memory Map, később Postgres) és 200-zal válaszol. A tényleges üzleti logika (assistant indítás, stb.) egy későbbi fázis.

**Config:**
- `VAPI_WEBHOOK_SECRET` env-ből (már létezik az `infra/.env.example:17`-ben).
- Opcionális `VAPI_WEBHOOK_TIMESTAMP_TOLERANCE_SEC=300` (alap: 300).

### 4.2 Caddy oldal — útvonal-szűkítés

A [`infra/caddy/Caddyfile:43`](../../infra/caddy/Caddyfile:43) `api.<DOMAIN>` blokk kiegészítése:

```caddyfile
api.<DOMAIN> {
	encode zstd gzip

	# A VAPI webhook útvonal CSAK a VAPI-tól fogadhat POST-ot.
	# A védelem kétrétegű:
	#   1. Caddy szint: csak POST + X-Vapi-Signature header + User-Agent ellenőrzés
	#   2. NestJS szint: VapiSignatureGuard HMAC-SHA256 ellenőrzés
	handle /api/vapi/* {
		@vapi_has_sig header X-Vapi-Signature *
		@vapi_post method POST
		handle_response @vapi_has_sig @vapi_post {
			reverse_proxy api:3000
		}
		# Minden más (hiányzó header, nem POST, más user-agent) → 405
		respond "Method Not Allowed" 405
	}

	# Minden más útvonal a nyilvános /api/ névtérben marad
	handle /api/* {
		reverse_proxy api:3000
	}

	# Healthcheck maradjon közvetlenül elérhető (docker healthcheck + monitor)
	handle /healthz {
		reverse_proxy api:3000
	}
}
```

**Fontos: a Caddy `header` matcher csak HEADereket lát, a body-t nem — ezért a HMAC-ellenőrzést nem pótolja, csak egy olcsó 405-öt ad a nyilvánvalóan rossz kérésekre.** A tényleges védelmet a NestJS HMAC adja.

A Caddy renderelési logika nem változik (a `<DOMAIN>` placeholder ugyanúgy megy a [`deploy.sh:render_caddyfile`](../../deploy/deploy.sh:142) függvénybe).

### 4.3 Prod CORS tisztítás

[`infra/.env.example:15`](../../infra/.env.example:15) és a droplet `infra/.env` `CORS_ORIGINS`:

```
# Régi (dropleten most is ez):
CORS_ORIGINS=https://api.aisztens.hu,https://web.aisztens.hu,https://admin.aisztens.hu

# Új:
CORS_ORIGINS=https://web.aisztens.hu,https://admin.aisztens.hu
```

Az `https://api.aisztens.hu` elem kikerül, mert nincs olyan böngészős SPA, ami onnan indulna (az SPA-k a `web.` és `admin.` hostokon vannak).

### 4.4 Tesztek

| Szint | Fájl | Mit tesztel |
|---|---|---|
| Unit | [`vapi-signature.guard.spec.ts`](../../apps/api/src/vapi-webhooks/vapi-signature.guard.spec.ts) | helyes HMAC → 200, helytelen → 401, lejárt timestamp → 401, hiányzó secret → 500 (fail-closed) |
| Unit | [`vapi-webhooks.service.spec.ts`](../../apps/api/src/vapi-webhooks/vapi-webhooks.service.spec.ts) | event eltárolódik, idempotens (ugyanaz a `message.id` kétszer → 1 rekord) |
| E2E | [`apps/api/test/vapi-webhooks.e2e-spec.ts`](../../apps/api/test/vapi-webhooks.e2e-spec.ts) | teljes POST flow: app `/api/vapi/webhooks/end-of-call-report` helyes signature-rel → 200, helytelen signature-rel → 401, érvényes signature de lejárt timestamp → 401 |
| Smoke | [`scripts/test/lib/10-services.sh`](../../scripts/test/lib/10-services.sh) | bővítés: `curl -X POST` az `/api/vapi/webhooks/test` végpontra helyes signature-rel → 200; Caddy 405-öt ad, ha `X-Vapi-Signature` header nélkül próbálkozunk |

### 4.5 Dokumentáció frissítések

| Fájl | Frissítés |
|---|---|
| [`docs/Specs/Production-Runbook.md`](../../docs/Specs/Production-Runbook.md) | §4.4 „Belső service-ek” bővítése: `curl -X POST` HMAC fejléccel, hogy az üzemeltető lássa, hogyan kell helyes webhookot küldeni |
| [`docs/Specs/Caddy-Reverse-Proxy.md`](../../docs/Specs/Caddy-Reverse-Proxy.md) | §4 „Reverse proxy rules” bővítése: a `/api/vapi/*` blokk dokumentálása |
| [`infra/.env.example`](../../infra/.env.example) | `VAPI_WEBHOOK_SECRET` komment kiegészítése: „HMAC-SHA256 kulcs a VAPI webhook hitelesítéshez, lásd [link a tervre]” |
| `apps/api/src/vapi-webhooks/README.md` | új fájl: hogyan teszteljünk helyes + aloadott signature-rel |

### 4.6 Konfiguráció rotáció

A `VAPI_WEBHOOK_SECRET` rotációja:
- **Cél:** container-rebuild nélkül cserélhető legyen.
- **Mechanizmus:** a secret a compose `environment:`-ből jön ([`infra/docker-compose.yml:33`](../../infra/docker-compose.yml:33)) → `docker compose up -d --no-build api` frissíti.
- **Dokumentáció:** a runbook §4.4 „Titok-rotáció” alpontba bekerül.

---

## 5. Implementációs lépések (PR-ekre bontva)

### PR #1 — `vapi-signature-guard-skeleton` (kis, önálló)
1. `apps/api/src/vapi-webhooks/` mappa + module/controller/service/guard skeleton.
2. `VAPI_WEBHOOK_SECRET` olvasása `ConfigService.get`-szel.
3. **Raw body** bekapcsolása a Fastify adapteren (`rawBody: true` flag).
4. Unit tesztek a guardhoz (helyes + helytelen + lejárt).
5. **Nincs route engedélyezve** — csak a védelmi mechanizmus és a tesztek.

### PR #2 — `vapi-webhook-controller-and-route` (közepes)
1. `VapiWebhookController` a `POST /api/vapi/webhooks/:eventType` végponttal.
2. `VapiWebhooksService` in-memory tárolóval (a callback-requests mintára).
3. Fastify `rawBody` hook regisztrálása a guardhoz.
4. E2E tesztek.
5. A Caddyfile módosítása: `handle /api/vapi/*` blokk.
6. `render_caddyfile` placeholder-szinkron ellenőrzés.

### PR #3 — `prod-cors-cleanup-and-docs` (kis)
1. `infra/.env.example:15` CORS sor rövidítése.
2. Droplet `infra/.env` `CORS_ORIGINS` frissítése (rotáció dokumentálva).
3. `docs/Specs/Production-Runbook.md` §4.4 + §4.5 frissítés.
4. `docs/Specs/Caddy-Reverse-Proxy.md` §4 frissítés.

---

## 6. Kockázatok és mitigáció

| Kockázat | Valószínűség | Hatás | Mitigáció |
|---|---|---|---|
| A VAPI HMAC séma megváltozik | közepes | közepes | guard konfigurálható séma-verziót támogat; VAPI doksi figyelése |
| Raw body bekapcsolása lassítja a többi endpointot | alacsony | alacsony | Fastify-nél minimális overhead; csak a JSON parserként string-ként kapja, nem buffer-ik duplán |
| Caddy 405-öt ad, ha a VAPI user-agentje megváltozik | alacsony | magas | a Caddy csak a `X-Vapi-Signature` HEADert ellenőrzi, nem a User-Agentet — stabilitás |
| Nyilvános űrlap (`POST /api/callback-requests`) letiltása | alacsony | magas | a `handle /api/vapi/*` blokk **csak a vapi útvonalra** hat; minden más marad |
| Secret kikerül a konténer logjába | alacsony | magas | a guard NEM logolja a secretet, csak a "valid/invalid" státuszt + a `message.id`-t |
| CORS kiürítése → SPA-k elveszítik a hozzáférést | alacsony | magas | smoke teszt a CI-ban: `curl -H "Origin: https://web.aisztens.hu" -i` → 200 + `access-control-allow-origin` fejléc |

---

## 7. Rollback terv

- **PR #1 rollback:** a skeleton nem route-ol semmit, így nincs hatása a futó rendszerre.
- **PR #2 rollback:** a Caddyfile régi verzióját visszaállítjuk (`handle /api/*` marad); a NestJS controller nem kap kérést, így inaktív.
- **PR #3 rollback:** a CORS régi érték visszaírása a `infra/.env`-be + deploy.

A rollback mind compose-szinten marad (újraépítés nem kell), kivéve a NestJS image-t, ami a PR #2 után újraépül.

---

## 8. Verifikáció

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

---

## 9. Következő lépések (kimaradt, de dokumentálandó)

- **Valódi webhook feldolgozó** — a service most csak tárol; az üzleti logika (callback indítása, status update) egy későbbi fázis.
- **Admin auth** — az admin SPA `AuthContext`-je kliens-oldali; a NestJS oldalon egy `AdminAuthGuard` kell (JIT/Session), mert a `GET /api/callback-requests` jelenleg bárhonnan olvasható.
- **Rate limiting** — `@nestjs/throttler` a publikus `/api/callback-requests` POST-ra.
- **Audit log** — a webhook feldolgozáshoz correlation id + strukturált log.

---

## 10. Jóváhagyási kérdések

1. **A VAPI HMAC séma** — megerősíted, hogy a jelenlegi VAPI a `X-Vapi-Signature: sha256=<hex>` formátumot használja, és a body a nyers JSON? (A pontos séma a PR #1 előtt ellenőrzendő.)
2. **A CORS-ból kikerülő `api.aisztens.hu`** — jóváhagyod? (Nincs SPA, ami onnan indulna.)
3. **PR-bontás** — jóváhagyod a három PR-es bontást (skeleton → controller+route → CORS+docs), vagy egyszerre kéred?
4. **Titok-rotáció mechanizmusa** — jóváhagyod, hogy a `docker compose up -d --no-build api` legyen a forgatási módszer?