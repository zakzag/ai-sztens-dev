# `.env` Fájl Konfiguráció

Ez a dokumentum a projekt `.env` fájlját írja le. Az **összes konfiguráció ezen az egyetlen fájlon** keresztül történik – ez a projekt egyik alapelve.

## 🎯 Alapelvek

- **Egyetlen konfigurációs pont**: Ne legyenek konfigurációs fájlok szétszórva
- **Környezeti változók**: A Docker Compose és a konténerek ezt olvassák
- **Nincs verziókövetésben**: A valódi `.env` soha nem kerül a git-be
- **`.env.example`**: A placeholder-eket és struktúrát viszont verziózzuk

## 📁 Kapcsolódó fájlok

- `.env` – A valódi konfiguráció (titkos, **NEM** commitolandó)
- `.env.example` – Placeholder-ekkel kitöltött példa (commitolandó)
- `.gitignore` – Tartalmazza a `.env` mintát (kötelező)

```gitignore
# .gitignore
.env
.env.local
.env.*.local
```

## 🔑 Kötelező Változók

### Alap konfiguráció

| Változó | Leírás | Példa |
|---------|--------|-------|
| `PROJECT_NAME` | A projekt neve (compose prefix) | `ai-assistant` |
| `ENVIRONMENT` | Környezet azonosító | `production` |
| `TZ` | Időzóna | `Europe/Budapest` |
| `LOG_LEVEL` | Globális log szint | `INFO` / `DEBUG` |

### LiveKit konfiguráció

| Változó | Leírás | Példa |
|---------|--------|-------|
| `LIVEKIT_API_KEY` | Nyilvános API kulcs (24+ karakter hex) | `APIxxxxxxxxxxxxxx` |
| `LIVEKIT_API_SECRET` | Titkos kulcs (32+ karakter base32) | `secretxxxxxxxxxxxx` |
| `LIVEKIT_URL` | Publikus LiveKit URL (kliens oldalról) | `wss://assistant.example.com` |
| `LIVEKIT_HOST` | Belső hoszt cím (konténer hálózatról) | `livekit` |

### Slack konfiguráció

| Változó | Leírás | Példa |
|---------|--------|-------|
| `SLACK_BOT_TOKEN` | Bot User OAuth Token (xoxb-...) | `xoxb-...` |
| `SLACK_SIGNING_SECRET` | Slack Signing Secret | `abc123...` |
| `SLACK_APP_TOKEN` | App-Level Token (xapp-...) socket mode-hoz | `xapp-...` |
| `SLACK_ALLOWED_USERS` | Vesszővel elválasztott user ID-k | `U01234,U05678` |

### OpenAI (LLM / opcionális TTS)

| Változó | Leírás | Példa |
|---------|--------|-------|
| `OPENAI_API_KEY` | OpenAI API kulcs | `sk-...` |
| `OPENAI_MODEL` | Alapértelmezett LLM modell | `gpt-4o-mini` |
| `OPENAI_TTS_VOICE` | TTS hang (ha OpenAI TTS-t használunk) | `alloy` |
| `OPENAI_TTS_MODEL` | TTS modell | `tts-1` |

### Deepgram (STT)

| Változó | Leírás | Példa |
|---------|--------|-------|
| `DEEPGRAM_API_KEY` | Deepgram API kulcs | `...` |
| `DEEPGRAM_MODEL` | STT modell | `nova-2` |
| `DEEPGRAM_LANGUAGE` | Alapértelmezett nyelv | `hu` |

### Nyelvek (i18n)

| Változó | Leírás | Példa |
|---------|--------|-------|
| `DEFAULT_LANGUAGE` | Alapértelmezett nyelv | `hu` |
| `SUPPORTED_LANGUAGES` | Támogatott nyelvek listája | `hu,en` |
| `LANGUAGE_FALLBACK` | Tartalék nyelv ha a kért nem elérhető | `en` |

### Szerver URL-ek

| Változó | Leírás | Példa |
|---------|--------|-------|
| `PUBLIC_URL` | A teljes rendszer publikus URL | `https://assistant.example.com` |
| `PUBLIC_DOMAIN` | Domain név (Traefik-nek) | `assistant.example.com` |
| `LETSENCRYPT_EMAIL` | Email a Let's Encrypt tanúsítványhoz | `admin@example.com` |

### Adatbázis

| Változó | Leírás | Példa |
|---------|--------|-------|
| `DATABASE_URL` | Adatbázis kapcsolódási string | `sqlite:///data/sqlite/app.db` |
| `DB_BACKUP_ENABLED` | Automatikus mentés engedélyezése | `true` |
| `DB_BACKUP_SCHEDULE` | Mentési ütemezés (cron formátum) | `0 2 * * *` |

### Google Calendar (opcionális)

| Változó | Leírás | Példa |
|---------|--------|-------|
| `GOOGLE_CLIENT_ID` | OAuth2 Client ID | `...apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | OAuth2 Client Secret | `...` |
| `GOOGLE_REDIRECT_URI` | OAuth redirect URI | `https://assistant.example.com/oauth/callback` |
| `GOOGLE_CALENDAR_ID` | Alapértelmezett naptár ID | `primary` |

## 📱 Jövőbeli – Telefonos integráció (placeholder)

Ezek a változók a [`telephony-placeholder.md`](telephony-placeholder.md:1) részletezi – jelenleg csak placeholder-ek:

| Változó | Leírás | Státusz |
|---------|--------|---------|
| `TWILIO_ACCOUNT_SID` | Twilio fiók SID | placeholder |
| `TWILIO_AUTH_TOKEN` | Twilio auth token | placeholder |
| `TWILIO_PHONE_NUMBER` | Twilio telefonszám | placeholder |
| `SIP_HOST` | SIP szerver hosztnév | placeholder |
| `SIP_USERNAME` | SIP felhasználónév | placeholder |
| `SIP_PASSWORD` | SIP jelszó | placeholder |

## 🧬 Példa `.env.example` Tartalom

```bash
# Alap konfiguráció
PROJECT_NAME=ai-assistant
ENVIRONMENT=production
TZ=Europe/Budapest
LOG_LEVEL=INFO

# LiveKit
LIVEKIT_API_KEY=APIReplaceMeWithGenerated24CharHex
LIVEKIT_API_SECRET=ReplaceMeWithGeneratedBase32Secret
LIVEKIT_URL=wss://assistant.example.com
LIVEKIT_HOST=livekit

# Slack
SLACK_BOT_TOKEN=xoxb-REPLACE-ME
SLACK_SIGNING_SECRET=replace-me
SLACK_APP_TOKEN=xapp-REPLACE-ME
SLACK_ALLOWED_USERS=

# OpenAI
OPENAI_API_KEY=sk-REPLACE-ME
OPENAI_MODEL=gpt-4o-mini
OPENAI_TTS_VOICE=alloy
OPENAI_TTS_MODEL=tts-1

# Deepgram
DEEPGRAM_API_KEY=REPLACE-ME
DEEPGRAM_MODEL=nova-2
DEEPGRAM_LANGUAGE=hu

# Nyelvek
DEFAULT_LANGUAGE=hu
SUPPORTED_LANGUAGES=hu,en
LANGUAGE_FALLBACK=en

# Szerver URL-ek
PUBLIC_URL=https://assistant.example.com
PUBLIC_DOMAIN=assistant.example.com
LETSENCRYPT_EMAIL=admin@example.com

# Adatbázis
DATABASE_URL=sqlite:///data/sqlite/app.db
DB_BACKUP_ENABLED=true
DB_BACKUP_SCHEDULE=0 2 * * *

# Google Calendar (opcionális)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=
GOOGLE_CALENDAR_ID=primary

# Telefonos integráció (placeholder - jövőbeli)
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=
SIP_HOST=
SIP_USERNAME=
SIP_PASSWORD=
```

## 🔐 Biztonsági Legjobb Gyakorlatok

### A `.env` fájl védelme

1. **Soha ne commit-old a valódi `.env` fájlt**
   - Mindig a `.env.example` kerül a repoba
   - A valódi `.env` más módon kerül a szerverre (pl. scp, secret manager)

2. **Fájlrendszer jogosultságok**
   - `chmod 600 .env` – csak a tulajdonos olvashatja
   - `chown $USER:$USER .env`

3. **Verziókezelés**
   - A `.gitignore` kötelezően tartalmazza a `.env` mintát
   - Hibás commit esetén: `git rm --cached .env` és a történet átírása

### API kulcsok generálása és rotálása

- **LiveKit kulcsok**: A [`scripts/generate-livekit-keys.sh`](../scripts/) generálja (későbbi implementáció)
- **OpenAI / Deepgram**: A szolgáltatók dashboardján kell generálni
- **Slack**: A Slack App beállításokban érhető el
- **Rotálás**: Évente vagy kompromittálódás esetén

### Érzékeny Változók Kezelése

Az igazán érzékeny értékek (titkok) kezelhetők:

- **Docker secret** formájában (Swarm / compose secrets)
- **Futtatáskor átadva**: `docker run -e API_KEY=...`
- **Secret manager**: Pl. HashiCorp Vault (jövőbeli)

## 🛠 Generálás és Validáció

### Hogyan készül a `.env` fájl?

A felhasználóknak két lehetőségük van:

1. **Manuális másolás**:
   - `cp .env.example .env`
   - Szerkeszd a `.env` fájlt kedvenc szerkesztőddel
   - Töltsd ki az értékeket

2. **Scriptekkel**:
   - A [`scripts/generate-env.sh`](../scripts/) interaktívan segít
   - Megkérdezi a felhasználót a szükséges adatokról
   - Validálja az értékeket (formátum, hossz)

### Validáció indítás előtt

A `docker compose config` parancs validálja a `.env` fájl szintaxisát, mielőtt elindítaná a stacket. Ezen kívül a [`scripts/generate-env.sh`](../scripts/) a következőket ellenőrzi:

- Kötelező változók jelenléte
- API kulcsok formátumának helyessége
- URL-ek validációja
- Duplikált vagy üres értékek jelzése

## 🔄 Környezet-specifikus `.env` fájlok

A projekt több környezetet is támogat (compose file override-okkal):

- `.env` – Alapértelmezett / production
- `.env.development` – Fejlesztői környezet
- `.env.staging` – Staging / teszt környezet

A megfelelő fájlt a `compose --env-file .env.development` opcióval lehet betölteni (későbbi implementáció).

## 🔗 Kapcsolódó Dokumentumok

- [`configuration-docker-compose.md`](configuration-docker-compose.md:1) – Hogyan használja a docker-compose a `.env`-et
- [`configuration-livekit.md`](configuration-livekit.md:1) – LiveKit-specifikus értékek
- [`configuration-slack.md`](configuration-slack.md:1) – Slack-specifikus értékek
- [`deployment-guide.md`](deployment-guide.md:1) – Mikor kell a `.env` fájl
