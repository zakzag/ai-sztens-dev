# Terv: AI Hangasszisztens Rendszer (LiveKit-alapú)

**Dátum**: 2026-08-26
**Státusz**: Tervezés és dokumentáció fázis (review előtt)
**Forrás**: [`docs/initial-plan.txt`](docs/initial-plan.txt:1)

## 🎯 A Projekt Összefoglalása

Olyan hangalapú AI asszisztens létrehozása, amely Slack-en keresztül vezérelhető, és később telefonos hívásokat is tud kezelni. A rendszer Docker-konténerekben fut, egyetlen `.env` fájllal konfigurálható, és Raspberry Pi 4-en (vagy más Linux szerveren) üzemeltethető.

### Fő funkciók

- Slack parancsra (`/call`) hanghívás indítása
- Természetes nyelvű párbeszéd (STT → LLM → TTS)
- Időpontfoglalás (Google Calendar integráció)
- Többnyelvűség (elsődlegesen magyar)
- Később: telefonos hívások (kimenő és bejövő)

### Korlátok

- Nem függ fizetős felhőszolgáltatásoktól (csak az AI API-k: OpenAI, Deepgram)
- Egyetlen `.env` fájl konfigurálja az egész rendszert
- Egyetlen `docker compose up -d` paranccsal indítható

## 📁 Létrehozott Dokumentumok (review-zandó)

A teljes terv az alábbi markdown fájlokban található, mind a `docs/` mappában:

| Fájl | Tartalom |
|------|----------|
| [`docs/README.md`](docs/README.md:1) | Projekt belépési pont, dokumentáció térkép |
| [`docs/architecture.md`](docs/architecture.md:1) | Rendszerarchitektúra, 6-8 Docker konténer részletes szerepe |
| [`docs/raspberry-pi-preparation.md`](docs/raspberry-pi-preparation.md:1) | Pi 4 előkészítése (OS, swap, hálózat, biztonság) |
| [`docs/software-requirements.md`](docs/software-requirements.md:1) | Telepítendő szoftverek, verziók, külső API-k |
| [`docs/directory-structure.md`](docs/directory-structure.md:1) | Projekt struktúra, scripts/ mappa szerepe |
| [`docs/configuration-env.md`](docs/configuration-env.md:1) | .env fájl összes változója, biztonsági tippek |
| [`docs/configuration-docker-compose.md`](docs/configuration-docker-compose.md:1) | docker-compose.yml tervezett felépítése |
| [`docs/configuration-livekit.md`](docs/configuration-livekit.md:1) | livekit.yaml konfiguráció részletei |
| [`docs/configuration-slack.md`](docs/configuration-slack.md:1) | Slack App és bot konfiguráció |
| [`docs/telephony-placeholder.md`](docs/telephony-placeholder.md:1) | Jövőbeli telefonos integráció (placeholder) |
| [`docs/deployment-guide.md`](docs/deployment-guide.md:1) | Telepítési lépések részletesen |

## 🐳 Tervezett Docker Konténerek

A [`docs/architecture.md`](docs/architecture.md:1) részletezi:

1. **Slack Bot Service** – Slack események és parancsok kezelése
2. **LiveKit Server** – WebRTC szerver
3. **AI Worker** – STT/LLM/TTS pipeline
4. **Calendar Service** – Google Calendar integráció
5. **Database** – SQLite (vagy PostgreSQL)
6. **Traefik** – Reverse proxy, HTTPS
7. **Telephony Gateway** – Jövőbeli (placeholder)
8. **Init Container** – Opcionális, inicializálás

## 📋 Tervezett Scriptek (a `scripts/` mappában, későbbi fázis)

A [`docs/directory-structure.md`](docs/directory-structure.md:1) részletezi:

- `install-prerequisites.sh` – Fő telepítő
- `setup-docker.sh` – Csak Docker telepítés
- `setup-system.sh` – Pi hardening
- `generate-env.sh` – .env generálás
- `generate-livekit-keys.sh` – LiveKit kulcsok generálása
- `backup.sh` – Adatmentés
- `update.sh` – Frissítés
- `uninstall.sh` – Eltávolítás

## 🚀 Implementációs Fázisok (tervezett)

### Fázis 1 (Jelenlegi): Tervezés
- ✅ Dokumentáció elkészítése
- ⏳ Review a felhasználó által
- ⏳ Jóváhagyás

### Fázis 2: Implementáció
- ⏳ Scriptek megírása (scripts/ mappa)
- ⏳ docker-compose.yml elkészítése
- ⏳ livekit.yaml elkészítése
- ⏳ .env.example elkészítése
- ⏳ Alap Dockerfile-ok

### Fázis 3: Integráció
- ⏳ Slack bot implementáció
- ⏳ AI Worker implementáció
- ⏳ Calendar Service implementáció

### Fázis 4: Tesztelés
- ⏳ Helyi tesztelés
- ⏳ Pi-n telepítés
- ⏳ Slack integráció tesztelése
- ⏳ Végponttól végpontig teszt

### Fázis 5: Jövőbeli
- ⏳ Telefonos integráció

## 🔗 Kapcsolódó Fájlok

- Forrás: [`docs/initial-plan.txt`](docs/initial-plan.txt:1)
- Terv: [`docs/README.md`](docs/README.md:1)

## ⚠️ Fontos Megjegyzések

- **Jelenleg csak dokumentáció készült**, scriptek NEM
- A scriptek a tervek szerint a `scripts/` mappába kerülnek
- A felhasználónak review-znia kell a dokumentációt, mielőtt továbblépünk
- A telefonos integráció kifejezetten KIZÁRVA a jelenlegi scope-ból
