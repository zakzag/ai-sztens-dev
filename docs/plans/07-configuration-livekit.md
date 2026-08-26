# LiveKit Konfiguráció (`livekit.yaml`)

Ez a dokumentum a [`livekit.yaml`](../livekit.yaml) fájl felépítését és beállításait írja le, amely a LiveKit WebRTC szerver konfigurációjáért felelős.

## 🎯 A LiveKit Szerepe

A LiveKit a rendszer „hangmotorja":

- WebRTC alapú valós idejű média-továbbítás
- A böngészőből érkező hang a LiveKit-en keresztül jut el az AI Worker-hez
- Az AI Worker válasza ugyanígy jut vissza a felhasználóhoz
- A szobakezelés és a tokenek generálása is itt történik

## 📁 Fájl Elhelyezkedés

- A fájl a projekt gyökerében: `livekit.yaml`
- A [`docker-compose.yml`](configuration-docker-compose.md:1) bind mountolja a konténerbe
- A konténer belsejében: `/etc/livekit.yaml` (alapértelmezett útvonal)

## 🔑 Kulcs Kezelés

A LiveKit két fontos kulcsot használ:

| Kulcs | Szerep | Forrás |
|-------|--------|--------|
| `LIVEKIT_API_KEY` | Tokenek aláírásához, API hívásokhoz | `LIVEKIT_API_KEY` a `.env`-ben |
| `LIVEKIT_API_SECRET` | Tokenek aláírásához (titkos) | `LIVEKIT_API_SECRET` a `.env`-ben |

### Hogyan kerülnek a konfigurációba?

A `livekit.yaml` **hivatkozik** a környezeti változókra (vagy a `.env`-ben definiáltakra):

```yaml
keys:
  $(LIVEKIT_API_KEY): $(LIVEKIT_API_SECRET)
```

A Docker Compose behelyettesíti ezeket az értékeket indításkor.

## 📋 Tervezett Struktúra

A `livekit.yaml` a következő főbb szekciókból áll majd:

### 1. Port és Logging

```yaml
port: 7880
bind_addresses:
  - ""
logging:
  level: info
  json: false
```

- **port**: A LiveKit HTTP/WebSocket portja
- **bind_addresses**: Mely interfészeken figyeljen ("" = összes)
- **logging**: Log szint és formátum

### 2. RTC Konfiguráció

```yaml
rtc:
  tcp_port: 7881
  udp_port: 7882
  use_external_ip: false
```

- **tcp_port**: WebRTC ICE TCP fallback
- **udp_port**: WebRTC média (alapértelmezetten az udp_port-tól indul egy range)
- **use_external_ip**: Ha a Pi NAT mögött van, szükség lehet true-ra

### 3. TURN/STUN Szerverek

```yaml
turn:
  enabled: true
  udp_port: 3478
  tls_port: 5349
  # TURN szerver konfiguráció
```

- A TUN/STUN szerverek segítik a NAT-ok mögötti klienseket
- A LiveKit beépített TURN szervere használható

### 4. Szoba Beállítások

```yaml
room:
  max_participants: 50
  empty_timeout: 300  # másodperc
  enable_recording: false
```

- **max_participants**: Szobánkénti max résztvevő
- **empty_timeout**: Mikor törölje az üres szobát
- **enable_recording**: Jelenleg kikapcsolva (későbbi funkció)

### 5. API Kulcsok

```yaml
keys:
  $(LIVEKIT_API_KEY): $(LIVEKIT_API_SECRET)
```

- A kulcs-érték párok azonosítják a jogosult klienseket
- Egy vagy több kulcs is definiálható (rotációhoz)

### 6. Webhook Beállítások (opcionális)

```yaml
webhook:
  url: "https://assistant.example.com/api/livekit-webhook"
  signing_key: "..."
```

- A LiveKit értesítéseket küldhet bizonyos eseményekről
- Pl. résztvevő csatlakozott, szoba lezárult

## 🌐 Hálózati Portok

A LiveKit a következő portokat használja (mind a [`docker-compose.yml`](configuration-docker-compose.md:1)-ben kell definiálni):

| Port | Protokoll | Cél |
|------|-----------|-----|
| 7880 | TCP | HTTP API, WebSocket signaling |
| 7881 | TCP | WebRTC ICE (TCP fallback) |
| 7882-7892 | UDP | WebRTC média (range, állítható) |
| 3478 | UDP | TURN szerver |
| 5349 | TCP (TLS) | TURN over TLS |

### Miért UDP range?

A WebRTC média RTP csomagokban utazik UDP-n, és a kliensek véletlenszerű portokat használnak. A LiveKit az 7882-től induló range-t nyitja meg, hogy a kliensektől tudjon fogadni.

## 🔐 Biztonsági Megfontolások

### API Kulcsok

- **Minimum 24 karakter** az API_KEY
- **Minimum 32 karakter** az API_SECRET (base32 kódolás)
- Soha ne commit-old a valódi kulcsokat

### Hálózati Izoláció

- A LiveKit konténer a belső hálózaton kommunikál más szolgáltatásokkal
- A nyilvános portok csak a Traefik reverse proxy-n keresztül érhetők el

### Token Érvényesség

A tokeneket a Slack Bot generálja a felhasználóknak. A tokenek:

- Rövid élettartamúak (pl. 1-2 óra)
- Szobához kötöttek
- Felhasználóhoz kötöttek

## 🔄 Gyakori Módosítások

### Portok átállítása (ütközés esetén)

```yaml
port: 7880  # Ha ütközik, pl. 8880
rtc:
  tcp_port: 7881
  udp_port: 7882
```

### Több API kulcs (rotáció)

```yaml
keys:
  $(LIVEKIT_API_KEY): $(LIVEKIT_API_SECRET)
  $(LIVEKIT_API_KEY_OLD): $(LIVEKIT_API_SECRET_OLD)
```

### Külső IP Használata

Ha a Pi NAT mögött van:

```yaml
rtc:
  use_external_ip: true
  # Vagy explicit:
  node_ip: "203.0.113.50"
```

## 📊 Monitorozás

### LiveKit Metrics

A LiveKit Prometheus metrics-eket szolgáltat:

- Aktív szobák száma
- Résztvevők száma
- Sávszélesség-használat
- Csomagveszteség

Ezek a jövőbeli monitoring megoldás alapjai lehetnek.

## 🔗 Kapcsolódó Dokumentumok

- [`architecture.md`](architecture.md:1) – A LiveKit helye az architektúrában
- [`configuration-env.md`](configuration-env.md:1) – A környezeti változók, amiket behelyettesít
- [`configuration-docker-compose.md`](configuration-docker-compose.md:1) – Hogyan mountolja a compose
- [`configuration-slack.md`](configuration-slack.md:1) – Hogyan generál tokeneket a Slack bot
