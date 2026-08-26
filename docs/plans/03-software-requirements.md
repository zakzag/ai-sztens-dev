# Szoftver Követelmények

Ez a dokumentum a rendszerhez szükséges összes szoftvert és függőséget listázza. A tényleges telepítést az majd a [`scripts/`](../scripts/) könyvtár `install-prerequisites.sh` scriptje fogja elvégezni.

## 🎯 Csoportosítás

A szoftverek három fő kategóriába sorolhatók:

1. **Alap rendszer eszközök** – A Pi előkészítéséhez
2. **Konténerizációs eszközök** – Docker és kapcsolódó komponensek
3. **Opcionális segédprogramok** – Kényelmi és diagnosztikai célokra

## 📦 1. Alap rendszer eszközök

Ezek minden Docker-alapú telepítéshez szükségesek, függetlenül a konkrét projekttől:

### Szükséges (kötelező)

| Szoftver | Verzió | Cél |
|----------|--------|-----|
| `git` | 2.30+ | Verziókezelés, repo klónozás |
| `curl` | latest | API hívások, scriptek letöltése |
| `ca-certificates` | latest | HTTPS tanúsítványok |
| `gnupg` | 2.2+ | APT tárolók hitelesítése |

### Erősen ajánlott

| Szoftver | Cél |
|----------|-----|
| `vim` vagy `nano` | Konfigurációs fájlok szerkesztése |
| `htop` | Processz- és erőforrás-monitorozás |
| `unzip` | Release artefact-ek kicsomagolása |
| `tree` | Könyvtárstruktúra áttekintése |
| `jq` | JSON feldolgozás scriptekben |

### Opcionális, de hasznos

| Szoftver | Cél |
|----------|-----|
| `glances` | Részletes rendszer-monitoring |
| `tmux` vagy `screen` | Perzisztens terminálok |
| `rsync` | Biztonsági mentés |
| `fail2ban` | SSH brute force védelem |
| `ufw` | Tűzfal kezelése |

## 🐳 2. Konténerizációs eszközök

A projekt magja, ezek nélkül nem indul a rendszer:

### Docker Engine

- **Verzió**: 24.0+ (legújabb stabil)
- **Forrás**: Docker hivatalos tároló (https://download.docker.com)
- **Fontos**: Ne a disztribúció (apt) csomagkezelőjéből telepítsük, mert az elavult verziót ad

#### Miért a Docker hivatalos tárolóból?

- Naprakész verziók
- Biztonsági javítások azonnal
- Jobb teljesítmény és stabilitás
- Hivatalosan támogatott ARM64 build-ek

#### Komponensek

A Docker Engine több alrendszerből áll:

- **`dockerd`** – A Docker daemon (a háttérfolyamat)
- **`containerd`** – A konténer futtatókörnyezet
- **`docker-init`** – A signal kezelést javítja
- **`docker-proxy`** – Hálózati proxy a konténereknek

### Docker Compose

- **Verzió**: V2 (plugin formájában, a Docker CLI része)
- **Formátum**: `docker compose` (V2) – NEM `docker-compose` (V1, elavult)
- **Fájlformátum**: YAML (compose specifikáció 3.8+)
- **Verzió specifikáció a YAML-ben**: Használható, de nem kötelező

#### Különbség a V1 és V2 között:

| Szempont | V1 (docker-compose) | V2 (docker compose) |
|----------|---------------------|---------------------|
| Telepítés | Külön Python bináris | Docker CLI plugin |
| Sebesség | Lassabb | Jelentősen gyorsabb |
| Karbantartás | Már nem támogatott | Aktívan fejlesztett |
| Parancs | `docker-compose up` | `docker compose up` |

### Docker Buildx (opcionális)

A buildx kiterjeszti a Docker build képességeit:

- Multi-platform build-ek (ARM64 + x86_64)
- Cache optimalizáció
- BUILDKIT gyorsabb build folyamat

### Docker Scout (opcionális)

- Konténer image-ek biztonsági auditja

## 🔧 3. Docker konténereken belüli függőségek

Ezek a szoftverek a konténerek *belsejében* futnak, és a [`Dockerfile`-ok](../) részét képezik majd (későbbi fázis):

### LiveKit Server konténer

- A LiveKit saját, Go-ban írt binárisa
- Image forrása: `livekit/livekit-server` (Docker Hub)

### AI Worker konténer

Ezek a Python és library függőségek:

- **Python**: 3.11+
- **LiveKit Agents SDK**: A Python SDK a LiveKit-hez
- **OpenAI Python client**: LLM és TTS hívásokhoz
- **Deepgram SDK**: STT szolgáltatáshoz (vagy alternatíva)
- **WebSocket kliens**: Valós idejű kommunikációhoz
- **Async futtatókörnyezet**: Pl. asyncio

### Slack Bot konténer

- **Runtime**: Node.js 20 LTS vagy Python 3.11+
- **Slack SDK**: Hivatalos Slack fejlesztői SDK
- **HTTP kliens**: Pl. axios, requests
- **OAuth kliens**: Google Calendar integrációhoz
- **SQL kliens**: Adatbázis műveletekhez

### Calendar Service konténer

- **Python** vagy **Node.js**
- **Google API kliens**: OAuth2 flow és naptár API
- **Token tárolás**: Biztonságos tárolás titkosítva

### Database konténer

- **SQLite**: Beépített, nincs külön függőség
- **VAGY PostgreSQL 15+**: Ha a skálázhatóság fontosabb

### Reverse Proxy (Traefik)

- **Traefik v3.x**: A reverse proxy
- **Let's Encrypt integráció**: Automatikus SSL tanúsítvány
- **Docker provider**: Konténerek automatikus felfedezése

## 🌐 4. Külső API-k és fiókok

A rendszer nem önálló – külső AI API-kat használ. Ezekhez **fiók és API kulcs** szükséges:

### Kötelező API-k

| Szolgáltatás | Felhasználás | Szükséges adatok |
|--------------|--------------|------------------|
| OpenAI | LLM, opcionálisan TTS | API key |
| Deepgram | STT (beszéd → szöveg) | API key |

### Opcionális API-k

| Szolgáltatás | Felhasználás |
|--------------|--------------|
| ElevenLabs | Alternatív TTS, jobb magyar minőség |
| Google Cloud STT | Alternatíva a Deepgram helyett |
| Azure Speech | Többnyelvű támogatás |
| Anthropic Claude | Alternatív LLM |
| Google Gemini | Alternatív LLM |

### Slack

- Slack Workspace (ahová a botot telepítjük)
- Slack App létrehozásához admin jogosultság
- A részletek: [`configuration-slack.md`](configuration-slack.md:1)

### Google Calendar (opcionális)

- Google Cloud Console fiók
- OAuth2 Client ID és Secret
- Calendar API engedélyezése

## 📋 5. Verzió-kompatibilitási mátrix

Annak biztosítására, hogy minden komponens együttműködjön:

| Komponens | Minimális verzió | Ajánlott verzió | Megjegyzés |
|-----------|----------------|-----------------|------------|
| Docker Engine | 24.0 | 27.x (latest stable) | ARM64 támogatás |
| Docker Compose | V2.20 | V2.30+ | Plugin formában |
| Raspberry Pi OS | Bookworm 64-bit | Latest | Kernel 6.6+ |
| Python (konténerben) | 3.11 | 3.12 | AI Worker, Calendar |
| Node.js (konténerben) | 20 LTS | 22 LTS | Slack Bot |
| LiveKit Server | 1.8 | Latest | Docker Hub-ról |
| Traefik | 3.0 | 3.x | Reverse proxy |

## 🔄 Frissítési stratégia

A hosszú távú karbantarthatóság érdekében:

- **Docker image-ek**: `docker compose pull` rendszeresen (havonta)
- **OS**: `unattended-upgrades` biztonsági frissítések automatikusak
- **Application**: Verziószámmal pinned image-ek (ne `latest`)

## 🧪 Ellenőrző parancsok telepítés után

Az alábbi parancsokkal ellenőrizhető, hogy minden szoftver megfelelően települt:

- `docker --version` – Docker verzió megjelenítése
- `docker compose version` – Compose verzió
- `git --version` – Git ellenőrzése
- `docker run hello-world` – Docker működésének tesztelése
- `docker compose config` – A compose fájl szintaxisának ellenőrzése

## ⚙️ Diszk és memória követelmények

| Elem | Minimális | Ajánlott |
|------|-----------|----------|
| Szabad lemezterület | 10 GB | 32 GB+ |
| RAM (RPi 4) | 4 GB | 8 GB |
| Swap | 2 GB | 4 GB |
| Docker storage | 5 GB image-ek | 15 GB+ |

## 📦 Tervezett csomaglista (Script számára)

Az alábbi lista összefoglalja, amit a [`scripts/install-prerequisites.sh`](../scripts/) tartalmazni fog (későbbi implementáció):

**APT csomagok** (alap):
- git, curl, wget, ca-certificates, gnupg, lsb-release
- vim (vagy nano), htop, jq, tree, unzip
- ufw (opcionális), fail2ban (opcionális)

**Külső tárolóból**:
- Docker Engine (docker-ce, docker-ce-cli, containerd.io)
- Docker Compose plugin

**Egyéb**:
- Docker Compose standalone (ha kell)
- Buildx (opcionális)

## 🔗 Kapcsolódó dokumentumok

- [`raspberry-pi-preparation.md`](raspberry-pi-preparation.md:1) – A Pi előkészítése
- [`directory-structure.md`](directory-structure.md:1) – A scriptek helye a projektben
- [`deployment-guide.md`](deployment-guide.md:1) – A teljes telepítési folyamat
