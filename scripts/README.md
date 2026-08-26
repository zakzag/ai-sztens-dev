# `scripts/` - Telepítő és karbantartó scriptek

A mappa célja, hogy a Docker stack telepítéséhez és karbantartásához szükséges összes parancs egy helyen, újrafelhasználható, review-zható bash scriptekben legyen.

## 📁 Tartalom

| Fájl | Célja | Mikor futtatandó |
|------|-------|------------------|
| [`install-prerequisites.sh`](install-prerequisites.sh) | Teljes környezet előkészítés (system + Docker) | Egyszer, friss Pi telepítésnél |
| [`setup-system.sh`](setup-system.sh) | Csak rendszer előkészítés (timezone, swap, cgroup) | Ha a Docker már telepítve van |
| [`setup-docker.sh`](setup-docker.sh) | Csak Docker Engine + Compose plugin | Ha csak Docker hiányzik |
| [`generate-env.sh`](generate-env.sh) | Interaktív `.env` generátor | Egyszer, első indítás előtt |
| [`smoke-test-livekit.sh`](smoke-test-livekit.sh) | LiveKit konténer end-to-end teszt | M1 elfogadáshoz, és minden frissítés után |
| [`lib/`](lib) | Közös helper könyvtár (colors, logging, checks) | A scriptek `source`-olják |

## 🔧 Közös konvenciók

Minden script:

- `#!/usr/bin/env bash` shebang
- `set -euo pipefail` strict mód
- `colors.sh` és `logging.sh` automatikus forrása (színes + időbélyeges kimenet)
- `checks.sh` előfeltétel-ellenőrzések (root, arch, OS, lemez)
- `-y, --yes` flag a non-interaktív módhoz
- `--dry-run` flag a kipróbáláshoz
- Konzisztens kilépési kódok (0=OK, 2=not root, 3=missing cmd, 4=unsupported arch, 5=unsupported OS, 6=disk)

## 🚀 Tipikus munkafolyamat

```bash
# 1. Rendszer előkészítés + Docker (csak friss Pi-n kell)
sudo bash scripts/install-prerequisites.sh

# 2. .env létrehozása
bash scripts/generate-env.sh

# 3. Stack indítása
docker compose up -d

# 4. Ellenőrzés
bash scripts/smoke-test-livekit.sh
```

## 🔗 Kapcsolódó

- [`docs/plans/04-directory-structure.md`](../docs/plans/04-directory-structure.md) - A mappa tervezett szerkezete
- [`docs/plans/02-raspberry-pi-preparation.md`](../docs/plans/02-raspberry-pi-preparation.md) - A Pi előkészítés részletei
- [`docs/plans/03-software-requirements.md`](../docs/plans/03-software-requirements.md) - Mit telepítenek a scriptek
