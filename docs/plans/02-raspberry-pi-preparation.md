# Raspberry Pi 4 Előkészítése

Ez a dokumentum a Raspberry Pi 4 (8GB+ RAM) hardver előkészítését írja le, mielőtt a Docker konténerek telepítése megkezdődne. A cél, hogy a Pi készen álljon egy megbízható, 24/7-ben futó AI hangasszisztens hosztháért.

## ⚠️ Fontos megjegyzés a scriptekről

A tényleges parancsok ebben a fájlban csak **leírás szinten** vannak jelen. A konkrét parancsokat az majd a [`scripts/`](../scripts/) könyvtárban lévő initial script fogja végrehajtani – ezek a scriptek a későbbi implementációs fázisban készülnek el.

Lásd: [`directory-structure.md`](directory-structure.md:1)

## 📋 Előfeltételek

Mielőtt elkezded:

- Fizikai hozzáférés a Raspberry Pi-hez (billentyűzet, monitor) **vagy** SSH-hozzáférés
- MicroSD kártya (32GB+ ajánlott, Class 10 / A2 minőség)
- Raspberry Pi 4 tápegység (5V/3A USB-C, hivatalos ajánlott)
- Hálózati kapcsolat (Ethernet ajánlott a stabilitás miatt)
- A Pi IP-címének ismerete (ha fej nélkül / headless üzemel)

## 🖥 Operációs rendszer

### Ajánlott: Raspberry Pi OS Lite (64-bit, Bookworm)

- **Letöltés**: A Raspberry Pi Imager alkalmazással
- **Variáns**: „Raspberry Pi OS Lite (64-bit)" – nincs GUI, kisebb erőforrásigény
- **Előnyök**: 
  - Hivatalosan támogatott
  - Hosszú távú támogatás
  - Dockerrel jól működik
  - ARM64 architektúra

### Alternatívák (kompatibilis)

- Ubuntu Server 22.04 LTS / 24.04 LTS (ARM64)
- Debian 12 (Bookworm)

## 🔧 Előkészítő lépések (magas szinten)

### 1. Alap rendszer frissítése

Frissíteni kell a csomaglistákat és a telepített csomagokat, mielőtt bármi újat telepítenénk. Ez biztosítja, hogy a biztonsági javítások naprakészek legyenek.

### 2. Időzóna és lokalizáció beállítása

- Időzóna: `Europe/Budapest` (vagy a felhasználó tartózkodási helye szerint)
- Locale: `hu_HU.UTF-8` (magyar) – később a többnyelvűség miatt hasznos
- Karakterkészlet: UTF-8 alapértelmezett

### 3. Swap méretének növelése

A Docker + AI workload memóriahasználata miatt ajánlott a swap méretét 2GB-ra növelni, mert:

- Az AI Worker és a LiveKit egyszerre futhatnak
- A Pi 8GB-os RAM-ja nem mindig elegendő csúcsidőben
- A swap segít elkerülni az OOM (Out of Memory) kill-eseményeket

### 4. Boot konfiguráció (opcionális, de ajánlott)

- **boot/config.txt** beállítások ellenőrzése:
  - GPU memória csökkentése (ha nincs GUI): pl. `gpu_mem=16`
  - Overlay-ek letiltása, amik nem kellenek
- **cmdline.txt**:
  - `cgroup_memory=1 cgroup_enable=memory` – konténerek memóriakezeléséhez

### 5. Firmware frissítés

A Pi firmware-je legyen naprakész (`rpi-update`), de csak indokolt esetben, mert ez instabilitást okozhat.

## 🌐 Hálózati előkészítés

### Statikus IP cím (ajánlott)

A Slack webhook-ok és a LiveKit kliensek számára fontos, hogy a Pi IP-címe ne változzon. Beállítási lehetőségek:

- **Router-ben DHCP reservation** (legegyszerűbb)
- **dhcpcd.conf** szerkesztése statikus IP-vel
- **nmcli** használata (NetworkManager esetén)

### Port forwarding (ha szükséges)

Ha a Pi az otthoni hálózaton van, és távolról is el kell érni:

| Port | Szolgáltatás | Megjegyzés |
|------|--------------|------------|
| 443 | Traefik (HTTPS) | Slack webhook-ok |
| 7880 | LiveKit (HTTP/WS) | Web kliensek |
| 7881 | LiveKit (TCP) | WebRTC |
| 7882-7892 | LiveKit (UDP) | WebRTC média |

⚠️ **Biztonsági figyelmeztetés**: Soha ne tedd ki közvetlenül a LiveKit portokat az internetnek – mindig a Traefik reverse proxy-n keresztül vezesd a forgalmat, és alkalmazz rate-limiting-et.

### Tűzfal (UFW)

Alapértelmezetten minden bejövő portot blokkolni kell, és csak a szükséges portokat szabad megnyitni:

- SSH (22) – korlátozott IP-tartományra
- 443 (HTTPS) – Traefik
- A többi port belső hálózaton marad

### DNS és hostname

- A Pi kapjon beszédes hostnevet (pl. `ai-assistant.local`)
- A Traefik tanúsítványkezeléséhez szükséges, hogy a hosztnév stabil legyen

## 🔒 Felhasználó és jogosultságok

### Nem root felhasználó használata

A Docker-kezelés nem igényel root jogosultságot, ha a felhasználó tagja a `docker` csoportnak.

### SSH beállítás

- **SSH kulcs alapú hitelesítés** – jelsavas bejelentkezés letiltása
- **Root login letiltása** – csak sudo-val lehessen emelt jogot szerezni
- **Fail2ban telepítése** – brute force támadások ellen

## 📦 Docker telepítés előfeltételei

A Docker a Pi-n az alábbi előfeltételeket igényli:

- 64-bites OS (ezért fontos a Raspberry Pi OS 64-bit)
- Kernel támogatás a konténerekhez (alapértelmezetten benne van)
- Storage driver overlay2 (alapértelmezett a modern Docker-ben)

A Docker hivatalos tárolójából (Docker repository) kell telepíteni, **nem** a disztribúció csomagkezelőjéből, mert az gyakran elavult verziókat tartalmaz.

## 💾 Tároló és partíciók

### MicroSD kártya kiválasztása

- Minimum 32GB, ajánlott 64GB+
- A1 vagy A2 sebességosztály (alkalmazás-telepítési sebesség)
- Megbízható márka (Samsung, SanDisk, Kingston)

### Boot SSD-ről (opcionális, haladó)

A Pi 4 USB-n bootolhat SSD-ről is, ami:

- Jelentősen gyorsabb mint a MicroSD
- Hosszabb élettartam (nincs wear level limit)
- Nagyobb kapacitás

### Log rotate és cleanup

A Docker hajlamos teletölteni a lemezt logokkal és használaton kívüli image-ekkel. A `logrotate` konfigurációt előre érdemes beállítani.

## 🛡 Biztonsági alapbeállítások

A Pi-t ne tegyük ki az internetnek lockbox-szerű alapbeállítások nélkül:

1. **Automatikus biztonsági frissítések** – `unattended-upgrades` konfigurálása
2. **Tűzfal** – UFW vagy nftables
3. **SSH hardening** – lásd fent
4. **Audit** – esetleg `auditd` a kritikus események naplózására

## 🌡 Hőmérséklet és hűtés

A LiveKit és az AI workload CPU-intenzív, ezért:

- Passzív hűtőbordák **kötelezőek**
- Aktív hűtés (ventilátor) erősen ajánlott hosszú távú futáshoz
- A CPU hőmérsékletét monitorozni kell (80°C felett throttling)

## 📊 Monitoring előkészítés

Bár a részletes monitoring a későbbi fázisokban valósul meg, érdemes most előkészíteni:

- A `glances` vagy `htop` legyen elérhető
- A Docker konténerek logjai a `/var/log/docker`-be kerüljenek
- Időbélyeg a logokban a könnyebb debuggoláshoz

## ✅ Kész ellenőrző lista

Mielőtt továbblépnél a telepítésre, győződj meg róla, hogy:

- [ ] Az OS 64-bites és frissített
- [ ] Az időzóna helyes
- [ ] A swap méret növelve van
- [ ] A Pi statikus IP címet kapott
- [ ] SSH kulcsos hitelesítés beállítva
- [ ] A tűzfal aktív és csak a szükséges portok nyitottak
- [ ] Hálózati kapcsolat stabil és sebessége megfelelő
- [ ] A Pi hőmérséklete normális üresjáratban
- [ ] Van elegendő szabad lemezterület (minimum 10GB)

## 🔗 Következő lépések

Ha a Pi elő van készítve, folytasd a [`software-requirements.md`](software-requirements.md:1) dokumentummal, amely a telepítendő szoftvereket listázza.

A tényleges parancsokat a [`scripts/install-prerequisites.sh`](../scripts/) fogja tartalmazni (későbbi implementáció).
