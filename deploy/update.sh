#!/usr/bin/env bash
# Met à jour Kader Cargo vers la dernière version de la branche main.
#   sudo /srv/kader-cargo/deploy/update.sh   (en root)
set -euo pipefail
APP=/srv/kader-cargo
cd "$APP"

echo "→ Sauvegarde avant mise à jour"
"$APP/deploy/backup.sh"

echo "→ Récupération du code"
git pull --ff-only origin main

echo "→ Dépendances"
npm --prefix api ci --no-audit --no-fund
npm --prefix web ci --no-audit --no-fund

echo "→ Base de données (migrations)"
(cd api && runuser -u kader -- ./node_modules/.bin/prisma migrate deploy)

echo "→ Construction du site"
npm --prefix web run build

echo "→ Redémarrage de l'API"
systemctl restart kader-cargo-api
for i in $(seq 1 20); do
  if curl -fsS http://127.0.0.1:4000/api/v1/health >/dev/null 2>&1; then echo "✓ Kader Cargo est à jour et en ligne"; exit 0; fi
  sleep 1
done
echo "✗ L'API ne répond pas : journalctl -u kader-cargo-api -n 50" >&2
exit 1
