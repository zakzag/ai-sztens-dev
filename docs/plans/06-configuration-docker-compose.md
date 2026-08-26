# `docker-compose.yml` Dokumentáció

Ez a dokumentum a projekt `docker-compose.yml` fájlját írja le – azt az egyetlen fájlt, amivel a teljes stack elindítható a `docker compose up -d` paranccsal.

## 🎯 Cél

A `docker-compose.yml` célja, hogy **egyetlen parancs** elindítsa a teljes rendszert, beleértve:

- Minden alkalmazás-konténert
- A perzisztens adatokat
- A hálózati topológiát
- A port-leképezéseket
- A környezeti változókat

## 📋 Tervezett Struktúra

A `docker-compose.yml` a következő főbb részekből áll majd:

1. **Verzió és név** – A stack azonosítása
2. **Hálózatok** – Belső és külső hálózatok
3. **Volumes** – Perzisztens tárolók
4. **Services** – Az egyes konténerek

### Várható felépítés (magas szinten)

```yaml
# Fájlszerkezet (tervezett)
version: '3.9'              # Compose spec verzió
name: ai-assistant           # Stack név

networks:                    # Hálózatok definiálása
  internal:                  # Belső, csak konténerek közt
  external:                  # Külső, Traefik felé

volumes:                     # Perzisztens tárolók
  sqlite_data:
  app_logs:
  traefik_letsencrypt:

services:                    # Konténerek definiálása
  traefik:                   # Reverse proxy
  livekit:                   # LiveKit szerver
  slack-bot:                 # Slack bot
  ai-worker:                 # AI agent
  calendar-service:          # Naptár integráció
  db:                        # Adatbázis (ha külön konténer)
```

## 🌐 Hálózatok

### Belső hálózat (`internal`)

- A konténerek egymás közötti kommunikációját biztosítja
- Nincs hozzáférés az internethez a konténerekből (alapértelmezetten)
- A legtöbb szolgáltatás ezen kommunikál

### Külső hálózat (`external`)

- Traefik és a publikus portok
- Az internet felé nyitott

### Hálózati izoláció előnyei

- A belső szolgáltatások (DB, AI Worker) nem érhetők el kívülről
- Csökken a támadási felület
- A Traefik az egyetlen belépési pont

## 💾 Volumes (Perzisztens Tárolók)

### Tervezett volume-ok

| Volume | Cél | Mount pont a konténerben |
|--------|-----|--------------------------|
| `sqlite_data` | SQLite adatbázis fájl | `/data/sqlite` |
| `app_logs` | Alkalmazás logok | `/var/log/app` |
| `traefik_letsencrypt` | SSL tanúsítványok | `/letsencrypt` |
| `livekit_data` | LiveKit konfiguráció és rekordok | `/data` |

### Volume-ok Előnyei

- A konténer újraindítása után is megmaradnak az adatok
- A konténer image frissítése nem törli az adatokat
- Könnyen backup-olhatók

## 🐳 Services (Konténerek)

Az egyes konténerek várható definíciója (magas szintű leírás):

### 1. Traefik (Reverse Proxy)

**Szerep**: HTTPS végpont, útválasztás, tanúsítványkezelés

**Főbb pontok**:
- Image: `traefik:v3.0`
- Portok: 80 (HTTP→HTTPS redirect), 443 (HTTPS), 8080 (dashboard, belső)
- Volume-ok: traefik_letsencrypt, docker socket (read-only)
- Hálózat: external
- Címkék: Traefik router és service definíciók
- Let's Encrypt: Automatikus tanúsítvány a `LETSENCRYPT_EMAIL` változóból

### 2. LiveKit

**Szerep**: WebRTC szerver

**Főbb pontok**:
- Image: `livekit/livekit-server:latest` (vagy pinned verzió)
- Portok: 7880 (HTTP/WS), 7881 (TCP), UDP range 7882-7892
- Környezeti változók: LIVEKIT_API_KEY, LIVEKIT_API_SECRET
- Konfiguráció: bind mount a `livekit.yaml` fájlnak
- Hálózat: internal + external
- Restart: `unless-stopped`

### 3. Slack Bot

**Szerep**: Slack integráció és parancsok kezelése

**Főbb pontok**:
- Build: `./app/slack-bot/` (helyi Dockerfile)
- Vagy image: saját registry
- Portok: nincs közvetlenül kitéve (Traefik-en keresztül)
- Környezeti változók: SLACK_*, LIVEKIT_URL
- Health check: HTTP endpoint
- Függőségek: livekit (depends_on)

### 4. AI Worker

**Szerep**: Beszélgetés feldolgozása (STT-LLM-TTS)

**Főbb pontok**:
- Build: `./app/ai-worker/`
- Nincs port (worker, nem szerver)
- Környezeti változók: OPENAI_API_KEY, DEEPGRAM_API_KEY, LIVEKIT_URL
- Erőforrás limitek: CPU és memória limitek (RPi 4-hez optimalizálva)
- Függőségek: livekit

### 5. Calendar Service

**Szerep**: Google Calendar integráció

**Főbb pontok**:
- Build: `./app/calendar-service/`
- Belső port: 8000 (vagy más)
- Környezeti változók: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
- Hálózat: internal (Traefik-en keresztül érhető el, ha kell)

### 6. Database

**Szerep**: Perzisztens adattárolás

**Két lehetőség**:
- **SQLite**: Nincs külön konténer, fájl a volume-on
- **PostgreSQL**: Külön konténer, pl. `postgres:15-alpine`

### 7. Telephony (placeholder)

Jelenleg nincs a compose-ban – csak a [`telephony-placeholder.md`](telephony-placeholder.md:1) írja le a jövőbeli tervet.

## 🔧 Alapértelmezett Beállítások

### Restart Policy

Minden szolgáltatás `restart: unless-stopped` policy-t kap, ami biztosítja:

- Hálózati glitch esetén automatikus újraindulás
- A Pi újraindulása után a stack magától elindul
- Kézi leállítás (docker compose stop) nem indul újra

### Resource Limits

A Raspberry Pi korlátai miatt fontos a limitek beállítása:

- **CPU limit**: Konténerenként limitálva, hogy ne fojtsák egymást
- **Memória limit**: Összesen nem haladhatja meg a Pi RAM-ját + swapet
- **cpu_shares**: Relatív prioritás

### Logging

- JSON-file driver (vagy sysdriver)
- Max méret konténerenként (pl. 10MB)
- Max fájlok száma (pl. 3-5)
- A logok a `app_logs` volume-on is gyűjthetők

### Health Checks

Minden szolgáltatásnak legyen health check-je, hogy a Docker tudja, mikor „egészséges":

- Traefik: beépített ping
- LiveKit: HTTP health endpoint
- Slack Bot: saját HTTP endpoint
- AI Worker: worker státusz
- Calendar Service: HTTP readiness

## 📦 Tervezett Volumes és Bind Mounts

A `docker-compose.yml` a következő tároló típusokat fogja használni:

### Named Volumes (Docker kezeli)

- `sqlite_data`, `app_logs`, `traefik_letsencrypt`, `livekit_data`

### Bind Mounts (a hosztról)

- `./livekit.yaml:/etc/livekit.yaml:ro` – LiveKit konfig
- `./app:/app` – Alkalmazás forráskód (dev módban)
- Docker socket (Traefik-nek): `/var/run/docker.sock:/var/run/docker.sock:ro`

## 🌐 Port Kezelés

### Közvetlenül kitett portok (hosztra)

Csak ami feltétlenül szükséges:

- `443:443` – Traefik HTTPS
- `80:80` – Traefik HTTP (redirect 443-ra)
- `7880:7880` – LiveKit HTTP (vagy csak Traefik-en)
- `7881:7881/udp` – LiveKit TCP
- `7882-7892:7882-7892/udp` – LiveKit UDP range

### Csak belső portok

A legtöbb szolgáltatás csak a Docker belső hálózaton hallgat, és a Traefik-en keresztül érhető el kívülről.

## 🔄 Profilok (opcionális, jövőbeli)

A `docker-compose.yml` támogathat profilokat, hogy egyes szolgáltatások csak szükség esetén induljanak:

```yaml
services:
  postgres:
    profiles: ["postgres"]    # Csak --profile postgres esetén indul
```

Például:

- Alap: `docker compose up -d` (SQLite-ot használ)
- PostgreSQL-lel: `docker compose --profile postgres up -d`

## 🚀 Indítási Parancsok

### Első indítás

```bash
docker compose build         # Image-ek buildelése
docker compose up -d         # Stack indítása háttérben
```

### Naprakész állapot

```bash
docker compose pull          # Image-ek frissítése
docker compose up -d         # Újraindítás az új image-ekkel
```

### Naplók követése

```bash
docker compose logs -f       # Összes szolgáltatás
docker compose logs -f livekit  # Egy adott szolgáltatás
```

### Leállítás

```bash
docker compose stop          # Szolgáltatások leállítása (adatok megmaradnak)
docker compose down          # Konténerek eltávolítása (adatok megmaradnak)
docker compose down -v       # Konténerek + volume-ok (adatok törlődnek!)
```

## ⚠️ Fontos Szabályok

### Amit a docker-compose SOHA nem tartalmaz

- **API kulcsok konstansként**: Mindig a `.env`-ből jönnek
- **Jelszavak plain text-ben**: Vagy `.env`, vagy Docker secret
- **Konfigurációs fájlok beégetve**: Bind mount vagy config

### Verziókezelés

- A `docker-compose.yml` igen, commitolható
- A `docker-compose.override.yml` NE kerüljön commitba (fejlesztői specifikus)

### Portütközések

- Ellenőrizd, hogy a hoszton nincs más szolgáltatás a 80/443/7880 stb. portokon
- Ha igen, a compose fájlban módosíthatók a hoszt portok (pl. `8443:443`)

## 🔗 Kapcsolódó Dokumentumok

- [`architecture.md`](architecture.md:1) – A konténerek szerepe
- [`configuration-env.md`](configuration-env.md:1) – A környezeti változók
- [`configuration-livekit.md`](configuration-livekit.md:1) – LiveKit konténer
- [`deployment-guide.md`](deployment-guide.md:1) – Hogyan indítsd el
