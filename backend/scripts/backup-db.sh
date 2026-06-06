#!/bin/bash
# Database backup script — run via cron
# Usage: ./backup-db.sh
# Cron example (daily at 2am): 0 2 * * * /root/shop/shop/backend/scripts/backup-db.sh

set -euo pipefail

BACKUP_DIR="/root/shop/backups"
RETENTION_DAYS=14
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/shopdb_$TIMESTAMP.sql.gz"

# Load env vars if available
ENV_FILE="/root/shop/shop/backend/.env"
if [ -f "$ENV_FILE" ]; then
  export $(grep -E '^DATABASE_URL=' "$ENV_FILE" | xargs)
fi

# Extract connection details from DATABASE_URL
DB_URL="${DATABASE_URL:-postgresql://shopuser:password@localhost:5432/shopdb}"
DB_HOST=$(echo "$DB_URL" | sed -n 's|.*@\(.*\):.*|\1|p')
DB_PORT=$(echo "$DB_URL" | sed -n 's|.*:\([0-9]*\)/.*|\1|p')
DB_NAME=$(echo "$DB_URL" | sed -n 's|.*/\(.*\)|\1|p')
DB_USER=$(echo "$DB_URL" | sed -n 's|.*://\(.*\):.*@.*|\1|p')
DB_PASS=$(echo "$DB_URL" | sed -n 's|.*://[^:]*:\(.*\)@.*|\1|p')

# Create backup directory
mkdir -p "$BACKUP_DIR"

echo "[$(date)] Starting backup of $DB_NAME..."

# Run pg_dump
PGPASSWORD="$DB_PASS" pg_dump \
  -h "$DB_HOST" \
  -p "$DB_PORT" \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  --no-owner \
  --no-privileges \
  --format=custom \
  | gzip > "$BACKUP_FILE"

FILESIZE=$(du -h "$BACKUP_FILE" | cut -f1)
echo "[$(date)] Backup completed: $BACKUP_FILE ($FILESIZE)"

# Remove old backups
DELETED=$(find "$BACKUP_DIR" -name "shopdb_*.sql.gz" -mtime +"$RETENTION_DAYS" -delete -print | wc -l)
if [ "$DELETED" -gt 0 ]; then
  echo "[$(date)] Removed $DELETED old backup(s) (>$RETENTION_DAYS days)"
fi

echo "[$(date)] Backup done."
