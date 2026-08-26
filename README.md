# AI Hangasszisztens Rendszer

Slack-en (és a jövőben telefonon) vezérelhető, valós idejű beszélgetést folytató AI asszisztens. A teljes rendszert Docker konténerekben futtatjuk, és egyetlen [`.env`](.env.example) fájllal konfigurálható.

A teljes rendszerterv a [`docs/plans/`](docs/plans/) mappában olvasható (00 → 10 számozott dokumentumok).

---

## 🚦 Státusz: **Milestone 1 – LiveKit alap**

| | |
|---|---|
| Aktuális fázis | **M1 – LiveKit szerver a Pi-n** |
| Befejezett | Egyetlen Docker konténer, [`livekit`](docs/plans/01-architecture.md:57) service, közvetlen port binding (7880-7892) |
| Következő | M2 – AI Worker (STT/LLM/TTS integráció) |

A terv teljes fázisterve: [`docs/plans/milestones.md`](docs/plans/milestones.md). Az M1 döntéseit és hatókörét a [`docs/memories/2026-08-26-milestone-1-livekit-on-pi-plan.md`](docs/memories/2026-08-26-milestone-1-livekit-on-pi-plan.md) tartalmazza.

---

## ⚡ M1 gyors indulás

> **Előfeltétel**: Docker Engine 24+ és Docker Compose V2 (plugin) telepítve.

### 1. Környezeti változók előkészítése

```bash
# .env.example már tartalmaz DEV ONLY kulcsokat; másoljuk át:
cp .env.example .env
chmod 600 .env

# (opcionális) interaktív .env generátor:
bash scripts/generate-env.sh
```

### 2. LiveKit konténer indítása

```bash
docker compose up -d livekit
```

### 3. Smoke teszt

```bash
bash scripts/smoke-test-livekit.sh
```

Sikeres futás esetén a script kilépési kódja `0`, és a LiveKit a `ws://localhost:7880` címen elérhető. A konténer futva marad – a `docker compose logs -f livekit` paranccsal követheted a logjait. Megállítás: `docker compose stop livekit`.

### 4. (Opcionális) Pi-re telepítés frissen

```bash
# A Pi-n, SSH-n vagy helyi terminálban:
sudo bash scripts/install-prerequisites.sh
cp .env.example .env
docker compose up -d livekit
bash scripts/smoke-test-livekit.sh
```

---

## 📁 Projekt struktúra

```
.
├── README.md                          # Ez a fájl
├── .env.example                       # DEV ONLY kulcsokkal, commitolható
├── .env                               # A valódi konfig (gitignore-olt)
├── .gitignore                         # Kizárások (titkok, data/, stb.)
├── docker-compose.yml                 # M1-ben: csak a livekit service
├── livekit.yaml                       # LiveKit szerver konfiguráció
│
├── scripts/                           # Telepítő és karbantartó scriptek
│   ├── README.md
│   ├── install-prerequisites.sh       # Orchestrator: setup-system + setup-docker
│   ├── setup-system.sh                # Pi előkészítés (swap, timezone, cgroup)
│   ├── setup-docker.sh                # Docker Engine + Compose telepítés
│   ├── generate-env.sh                # Interaktív .env generátor
│   ├── smoke-test-livekit.sh          # M1 elfogadási teszt
│   └── lib/                           # colors.sh, logging.sh, checks.sh
│
├── data/                              # Perzisztens tárhely (gitignore-olt)
│
├── docs/
│   ├── plans/                         # 00-10: rendszertervek
│   │   ├── 00-initial-plan.txt
│   │   ├── 01-architecture.md
│   │   ├── 02-raspberry-pi-preparation.md
│   │   ├── 03-software-requirements.md
│   │   ├── 04-directory-structure.md
│   │   ├── 05-configuration-env.md
│   │   ├── 06-configuration-docker-compose.md
│   │   ├── 07-configuration-livekit.md
│   │   ├── 08-configuration-slack.md
│   │   ├── 09-telephony-placeholder.md
│   │   ├── 10-deployment-guide.md
│   │   └── milestones.md
│   └── memories/                      # Implementációs döntések naplója
│       └── 2026-08-26-milestone-1-livekit-on-pi-plan.md
│
└── plans/                             # Korai piszkozatok (öröklött mappa)
    └── 2026-08-26-livekit-ai-assistant/
```

---

## 📖 Dokumentáció

| # | Fájl | Leírás |
|---|------|--------|
| 00 | [`docs/plans/00-initial-plan.txt`](docs/plans/00-initial-plan.txt:1) | Eredeti projekt célok |
| 01 | [`docs/plans/01-architecture.md`](docs/plans/01-architecture.md:1) | Magas szintű rendszerarchitektúra |
| 02 | [`docs/plans/02-raspberry-pi-preparation.md`](docs/plans/02-raspberry-pi-preparation.md:1) | Pi előkészítés (swap, timezone, tűzfal) |
| 03 | [`docs/plans/03-software-requirements.md`](docs/plans/03-software-requirements.md:1) | Szoftverlista és verzió-mátrix |
| 04 | [`docs/plans/04-directory-structure.md`](docs/plans/04-directory-structure.md:1) | Teljes projekt könyvtárszerkezet |
| 05 | [`docs/plans/05-configuration-env.md`](docs/plans/05-configuration-env.md:1) | `.env` filozófiája és változói |
| 06 | [`docs/plans/06-configuration-docker-compose.md`](docs/plans/06-configuration-docker-compose.md:1) | `docker-compose.yml` referencia |
| 07 | [`docs/plans/07-configuration-livekit.md`](docs/plans/07-configuration-livekit.md:1) | `livekit.yaml` referencia |
| 08 | [`docs/plans/08-configuration-slack.md`](docs/plans/08-configuration-slack.md:1) | Slack App konfiguráció (M3) |
| 09 | [`docs/plans/09-telephony-placeholder.md`](docs/plans/09-telephony-placeholder.md:1) | Telefonos integráció (M5) |
| 10 | [`docs/plans/10-deployment-guide.md`](docs/plans/10-deployment-guide.md:1) | Telepítési útmutató (M1 quickstart szekcióval) |

---

## 🛠 Technológiai háttér

- **Hardver**: Raspberry Pi 4 (8GB+ RAM ajánlott) vagy bármilyen Linux szerver (x86/ARM)
- **Szoftver**: Docker Engine 24+, Docker Compose V2 (plugin)
- **Konténerek M1-ben**: 1 db (`livekit`)
- **Konténerek M2+ után**: 6-8 db (lásd [`docs/plans/01-architecture.md`](docs/plans/01-architecture.md:1))
- **Külső API-k** (M2+): OpenAI, Deepgram + opcionális Google Calendar, Twilio

---

## ⚠️ Biztonság

- A `.env` fájl **soha** nem kerül verziókezelésbe (`gitignore`).
- Az M1-ben használt `LIVEKIT_API_KEY` és `LIVEKIT_API_SECRET` **DEV ONLY** – éles környezetben cseréld le a `scripts/generate-livekit-keys.sh` (M2-ben jön) által generált vagy saját kulcsokra.
- A konténer kizárólag LAN-ról érhető el, nincs Traefik / reverse proxy M1-ben (M4-ben jön).

---

## 🤝 Következő lépések

- A [M2 – AI Worker](docs/plans/milestones.md) hozzáadja a STT/LLM/TTS pipeline-t.
- A [M3 – Slack Bot](docs/plans/milestones.md) bevezeti a `/call` slash parancsot.
- A [M4 – Reverse proxy + DB](docs/plans/milestones.md) HTTPS-t és perzisztens tárolót ad.
- A [M5 – Telefonos integráció](docs/plans/milestones.md) lecseréli a [`09-telephony-placeholder.md`](docs/plans/09-telephony-placeholder.md:1) tartalmát implementációra.

A teljes fázisterv: [`docs/plans/milestones.md`](docs/plans/milestones.md).
