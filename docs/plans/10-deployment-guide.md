# Telepítési útmutató (Deployment Guide)

Ez a dokumentum tartalmazza a lépésről lépésre járó utasításokat a rendszer telepítéséhez a Raspberry Pi 4-en vagy bármely Linux szerveren.

> **Jelenlegi fázis: M1 – LiveKit alap.** A teljes 6-8 konténeres rendszer (AI Worker, Slack Bot, Calendar, Traefik, DB) a későbbi mérföldkövekben kerül bevezetésre. Lásd [`milestones.md`](milestones.md).

---

## 🚀 M1 gyors indulás (LiveKit-only)

Cél: a [`livekit`](01-architecture.md:57) konténer elinduljon a Pi-n vagy bármely Linux gépen, és `ws://localhost:7880` címen elérhető legyen. Ez a mérföldkő igazolja, hogy a port-kiosztás, a `.env` behelyettesítés és a [`livekit.yaml`](07-configuration-livekit.md:1) helyes.

### Előfeltételek

- Docker Engine 24+
- Docker Compose V2 (plugin)
- A projekt repository a célgépen
- (Pi esetén) ARM64 (Bookworm) vagy amd64 (Ubuntu 22.04/24.04)

### Parancsok

```bash
# 1. .env előkészítése (DEV ONLY kulcsok a .env.example-ből)
cp .env.example .env
chmod 600 .env

# 2. LiveKit konténer indítása
docker compose up -d livekit

# 3. Smoke teszt (kilépési kód: 0 ha minden rendben)
bash scripts/smoke-test-livekit.sh

# 4. (Opcionális) friss Pi-n a teljes rendszer-előkészítés:
sudo bash scripts/install-prerequisites.sh
```

### Ellenőrzés

A sikeres M1-et a [`scripts/smoke-test-livekit.sh`](../scripts/smoke-test-livekit.sh) hívja le:

- `docker compose ps` – a `livekit` service `running` és `healthy` státuszban.
- `curl http://localhost:7880/rtc` – JSON válasz `ice_servers` tömbbel.
- `docker compose logs --tail=50 livekit` – nincs `ERROR` szintű sor.

### Gyakori hibák és megoldásuk

| Tünet | Valószínű ok | Megoldás |
|-------|--------------|----------|
| `permission denied while connecting to Docker daemon` | A user nincs a `docker` csoportban | `sudo usermod -aG docker $USER` majd újra belépés |
| `livekit container unhealthy` | Helytelen API key a `.env`-ben | Futtasd újra `bash scripts/generate-env.sh` |
| `port 7880 already in use` | Másik szolgáltatás foglalja | Változtasd meg a hoszt portot a `docker-compose.yml`-ben (`7883:7880` stb.) |
| `bind: address already in use` UDP 7882-nél | Másik WebRTC szerver fut | Állítsd le, vagy módosítsd a `udp_port: 7882` értéket `livekit.yaml`-ban |

---

## 🚀 Teljes rendszer telepítése (jövőbeli, M4+)

A teljes, 6-8 konténeres rendszer telepítési útmutatója az M4 mérföldkő után kerül véglegesítésre. Az M1 → M4 közötti átmenet lépései a lenti „Előkészítés" és „Telepítés" szekciókban jelennek meg, de csak az M4 release-ben válnak aktuálissá.

## 🚀 Előkészítés

1. **Docker és Git telepítése**:
   - A Raspberry Pi-n vagy a célszerveren futtasáshoz szükséges a Docker és a Docker Compose.
   - `sudo apt-get update`
   - `sudo apt-get install docker.io docker-compose git -y`
   - `sudo systemctl enable docker`
   - `sudo systemctl start docker`

   > Preferált: a projekt saját [`scripts/install-prerequisites.sh`](../scripts/install-prerequisites.sh) scriptje, amely a Docker hivatalos repository-ból telepít (frissebb, mint a disztribúció csomagkezelője).

2. **Repozitárium klónozása**:
   - Klónozza le a projektet a célkönyvtárba:
   - `git clone <repo_url> .`

## ⚙️ Konfiguráció

3. **.env fájl létrehozása**:
   - Másolja át az `.env.example` fájlt és töltse ki az adatokat:
   - `cp .env.example .env`
   - Töltse be az API kulcsokat (OpenAI, Deepgram, Slack), a portokat és a nyelvi beállításokat.

4. **Slack App létrehozása**:
   - Lépjen be a Slack API oldalra.
   - Terjemtessen meg egy új App-ot.
   - Adja meg a szükséges jogosultságokat (Scopes) a `chat:write`, `commands` és egyéb releváns funkciókhoz.
   - Szerezze meg a `Bot Token` és a `Signing Secret` értékeket, és írja be őket az `.env` fájlba.

## 🏗️ Telepítés

5. **Konténerek indítása**:
   - Futtassa le a build és az indítás parancsot:
   - `docker compose build`
   - `docker compose up -d`

6. **Ellenőrzés**:
   - Ellenőrizze, hogy az összes konténer fut-e:
   - `docker compose ps`
   - Ellenőrizze a logokat:
   - `docker compose logs -f`
