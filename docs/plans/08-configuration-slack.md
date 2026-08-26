# Slack Bot Konfiguráció

Ez a dokumentum a Slack App és a Slack bot szolgáltatás konfigurációját írja le. A Slack lesz a felhasználói belépési pont: a `/call` slash paranccsal indítanak hanghívásokat a felhasználók.

## 🎯 A Slack Bot Szerepe

A Slack bot a projekt „kapuőre":

- Fogadja a felhasználói parancsokat (slash parancsok, mention-ök)
- Ellenőrzi a jogosultságokat
- LiveKit szobát hoz létre és tokent generál
- A felhasználónak visszaküldi a hívás linkjét
- Naplózza a hívásokat

## 📋 Szükséges Slack Konfigurációk

### 1. Slack App Létrehozása

A Slack App-et a [api.slack.com/apps](https://api.slack.com/apps) oldalon kell létrehozni.

#### Lépések (magas szinten):

1. **"Create New App"** → "From scratch"
2. Add meg az app nevét (pl. „AI Assistant")
3. Válaszd ki a workspace-t
4. Az app létrejön, és kapsz egy App ID-t

### 2. OAuth & Permissions

A Slack App-nek szüksége van a következő OAuth scopes-okra:

#### Bot Token Scopes

| Scope | Cél |
|-------|-----|
| `chat:write` | Üzenetek küldése a bot nevében |
| `chat:write.public` | Üzenetek küldése nyilvános csatornákra |
| `commands` | Slash parancsok kezelése |
| `users:read` | Felhasználói adatok olvasása |
| `users:read.email` | Email alapú azonosítás (opcionális) |
| `im:write` | DM küldése |
| `im:history` | DM üzenetek olvasása (opcionális) |
| `calls:write` | Slack hívás indítása (alternatívaként) |

#### Telepítés

1. Az "OAuth & Permissions" oldalon kattints a **"Install to Workspace"** gombra
2. Engedélyezd a szükséges scope-okat
3. A telepítés után kapsz egy **Bot User OAuth Token**-t (`xoxb-...`)

### 3. Signing Secret

A Slack a webhook-ok hitelesítéséhez signing secret-et használ:

- Megtalálható: **Basic Information** → **App Credentials** → **Signing Secret**
- Ezt használja a bot a Slack-től érkező kérések ellenőrzésére
- A [`configuration-env.md`](configuration-env.md:1) `SLACK_SIGNING_SECRET` változójába kerül

### 4. App-Level Token (Socket Mode-hoz, opcionális)

Ha Socket Mode-ot használunk (nem kell nyilvános webhook URL):

- **Basic Information** → **App-Level Tokens** → **Generate Token and Scopes**
- Scope: `connections:write`
- Az eredményül kapott token: `xapp-...`
- A [`configuration-env.md`](configuration-env.md:1) `SLACK_APP_TOKEN` változójába kerül

## 🛠 Slash Parancsok

A Slack App a következő slash parancsokat fogja támogatni:

### `/call` – Hanghívás indítása

**Beállítás**:
- Command: `/call`
- Request URL: A Traefik-en keresztül a bot webhook URL-je
- Description: „Indíts hanghívást az AI asszisztenssel"
- Usage Hint: `[szabad_szöveg]`

**Működés**:
1. A felhasználó beírja: `/call Szeretnék időpontot foglalni`
2. A Slack küldi a webhook-ot a botnak
3. A bot ellenőrzi a felhasználót (lásd jogosultságkezelés)
4. A bot LiveKit szobát hoz létre
5. A bot válasz üzenetet küld a felhasználónak a hívás linkjével
6. A felhasználó rákattint, és megnyílik a böngészőben a LiveKit kliens

### Jövőbeli parancsok (tervezett)

- `/call` – Hanghívás indítása
- `/schedule` – Időpont foglalása szövegesen
- `/status` – A bot státuszának ellenőrzése
- `/cancel` – Folyamatban lévő hívás törlése
- `/history` – Korábbi hívások listája

## 🔐 Jogosultságkezelés

A bot nem minden Slack felhasználónak érhető el – csak az engedélyezetteknek.

### Módszer 1: Allowlist a `.env`-ben

```bash
SLACK_ALLOWED_USERS=U01234,U05678,U09876
```

#### Hátrányok:
- Nem skálázható nagy szervezeteknél
- A `.env`-et minden változáskor frissíteni kell
- Újrafordítást/újraindítást igényel

### Módszer 2: Slack felhasználói csoport (javasolt)

- Hozz létre egy `ai-assistant-users` Slack csoportot
- A bot ellenőrzi a felhasználó csoporttagságát a Slack API-n keresztül
- A jogosultság a Slack felületén kezelhető

### Módszer 3: Workspace-szintű (jogosult, de bárki használhatja)

- Bárki a workspace-ben használhatja
- Egyszerű, de kevésbé biztonságos
- Csak privát workspace-öknél ajánlott

### A választott módszer

A terv az **1-es módszer** egyszerűsített változatával számol (kezdetben), később áttérhetünk a **2-es módszerre**.

## 🌐 Webhook URL és HTTPS

A Slack **kizárólag HTTPS végpontra** küld webhook-okat. A Traefik biztosítja a HTTPS-t a Let's Encrypt-tel.

### Webhook URL Formátum

```
https://<PUBLIC_DOMAIN>/api/slack/events
```

Példa:

```
https://assistant.example.com/api/slack/events
```

### Konfiguráció a Slack oldalon

- Az "Event Subscriptions" és a "Slash Commands" oldalon kell megadni a Request URL-t
- A Slack ellenőrzi, hogy válaszol-e a bot az `URL verification` kihívásra

## 📡 Kommunikációs Módok

### 1. Webhook Mode (HTTP)

- A Slack POST kéréseket küld a botnak
- A bot válaszol a HTTP-n keresztül
- **Előny**: Egyszerű, jól ismert
- **Hátrány**: A botnak elérhetőnek kell lennie az internetről (Traefiken át)

### 2. Socket Mode (WebSocket)

- A bot kimenő WebSocket kapcsolatot nyit a Slack felé
- A Slack ezen küldi az eseményeket
- **Előny**: Nem kell bejövő port, tűzfal-barát
- **Hátrány**: App-Level Token kell hozzá, kicsit bonyolultabb

### A választott mód

A terv a **Webhook Mode**-ot preferálja, mert:

- Egyszerűbb konfiguráció
- A Traefik amúgy is kell a HTTPS miatt
- A Slack aláírás-ellenőrzés jól kidolgozott

## 🔑 Környezeti Változók

A Slack-kel kapcsolatos összes változó a [`configuration-env.md`](configuration-env.md:1) dokumentumban van részletezve:

- `SLACK_BOT_TOKEN`
- `SLACK_SIGNING_SECRET`
- `SLACK_APP_TOKEN` (opcionális, socket mode-hoz)
- `SLACK_ALLOWED_USERS`
- `PUBLIC_URL` (webhook URL-hez)

## 🐳 Docker Konténer Konfiguráció

A Slack bot konténer a [`docker-compose.yml`](configuration-docker-compose.md:1)-ben definiált:

- **Service név**: `slack-bot`
- **Build**: `./app/slack-bot/` (saját image)
- **Port**: Nincs közvetlenül kitéve (Traefiken át)
- **Traefik címkék**: A webhook URL útvonalai
- **Környezeti változók**: A fent említett SLACK_* és PUBLIC_URL
- **Függőségek**: livekit (depends_on)

### Traefik Címkék (példa)

```yaml
labels:
  - "traefik.enable=true"
  - "traefik.http.routers.slack-bot.rule=Host(`${PUBLIC_DOMAIN}`) && PathPrefix(`/api/slack`)"
  - "traefik.http.routers.slack-bot.entrypoints=websecure"
  - "traefik.http.routers.slack-bot.tls.certresolver=letsencrypt"
  - "traefik.http.services.slack-bot.loadbalancer.server.port=3000"
```

## 🧪 Helyi Fejlesztés (opcionális)

Fejlesztés közben használható:

- **ngrok** vagy **cloudflared** – Nyilvános URL a Slack webhook-okhoz
- **Slack workspace teszt** – Külön Slack workspace a fejlesztéshez
- **Slack API teszt tool** – A [Slack Block Kit Builder](https://app.slack.com/block-kit-builder)

## 🔍 Hibakeresés

### Gyakori problémák

- **Slack 401-es hibát ad**: Signing secret nem egyezik
- **Slack nem küld eseményeket**: Webhook URL nem elérhető, vagy nincs feliratkozás
- **Bot nem tud írni**: Hiányzó OAuth scope
- **Slash parancs nem működik**: A parancs nincs regisztrálva, vagy a Request URL rossz

### Naplóellenőrzés

```bash
docker compose logs -f slack-bot
```

A Slack-specifikus események a `app_logs` volume-on is megjelennek.

## 🔗 Kapcsolódó Dokumentumok

- [`configuration-env.md`](configuration-env.md:1) – Slack környezeti változók
- [`configuration-docker-compose.md`](configuration-docker-compose.md:1) – Slack bot konténer
- [`architecture.md`](architecture.md:1) – A Slack bot helye a rendszerben
- [`deployment-guide.md`](deployment-guide.md:1) – A Slack App beállítása a telepítés részeként
