#!/usr/bin/env bash
# Sauvegarde la base PostgreSQL (pg_dump) et les photos locales ; garde 14 jours.
#   sudo /srv/kader-cargo/deploy/backup.sh      (lancé chaque nuit par /etc/cron.d/kader-cargo)
set -euo pipefail
DEST=/var/backups/kader-cargo
STAMP=$(date +%Y-%m-%d_%H%M)
mkdir -p "$DEST"
chmod 700 "$DEST"

cd /srv/kader-cargo/server
node scripts/backup.mjs "$DEST/kader-$STAMP.dump"
if [ -d /var/lib/kader-cargo/uploads ]; then
  tar -czf "$DEST/photos-$STAMP.tar.gz" -C /var/lib/kader-cargo uploads
fi
find "$DEST" -type f -mtime +14 -delete
echo "✓ Sauvegarde terminée dans $DEST"
