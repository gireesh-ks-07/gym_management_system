#!/usr/bin/env bash
#
# Nightly database dump. The database lives on this instance, so nothing else
# is backing it up.
#
#   sudo install -d -o ubuntu /var/backups/facility
#   crontab -e   →   15 2 * * * /opt/facility/deploy/backup.sh >> /var/log/facility/backup.log 2>&1
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEST="${BACKUP_DIR:-/var/backups/facility}"
KEEP_DAYS="${KEEP_DAYS:-14}"

set -a; . "${APP_DIR}/backend/.env"; set +a

mkdir -p "$DEST"
FILE="${DEST}/${DB_NAME}-$(date +%Y%m%d-%H%M%S).sql.gz"

PGPASSWORD="$DB_PASSWORD" pg_dump \
    -h "${DB_HOST:-127.0.0.1}" -p "${DB_PORT:-5432}" \
    -U "$DB_USER" "$DB_NAME" | gzip > "$FILE"

echo "$(date -Is) wrote $FILE ($(du -h "$FILE" | cut -f1))"
find "$DEST" -name "${DB_NAME}-*.sql.gz" -mtime "+${KEEP_DAYS}" -delete

# ENCRYPTION_KEY is not in this dump. Aadhaar columns are AES-256-GCM
# ciphertext, so a restore without the key from backend/.env leaves them
# unreadable — keep a copy of that key off this box.
