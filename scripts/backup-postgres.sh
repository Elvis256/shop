#!/bin/bash
# Daily Postgres backup for shop DB. Run via cron.
# Retains: 7 daily, 4 weekly. Uses pg_dump custom format (compressed, supports parallel restore).
# Sends Telegram alert on failure.
set -uo pipefail

ALERT_SCRIPT=/root/shop/shop/scripts/telegram-alert.sh
trap 'rc=$?; [ $rc -ne 0 ] && [ -x "$ALERT_SCRIPT" ] && "$ALERT_SCRIPT" "🚨 *Postgres backup FAILED* exit=$rc at $(date)"' EXIT

BACKUP_DIR=/root/backups/postgres
DB_URL=$(grep -E '^DATABASE_URL=' /root/shop/shop/backend/.env | sed 's/^DATABASE_URL=//' | tr -d '"' | tr -d "'")
TIMESTAMP=$(date +%Y-%m-%d_%H%M%S)
DAY_OF_WEEK=$(date +%u)  # 1=Mon … 7=Sun

mkdir -p "$BACKUP_DIR/daily" "$BACKUP_DIR/weekly"

DAILY_FILE="$BACKUP_DIR/daily/shopdb_${TIMESTAMP}.dump"

# Custom format (-Fc) is compressed by default and pg_restore can use --jobs
pg_dump "$DB_URL" -Fc -Z9 -f "$DAILY_FILE"

# Verify dump is readable
pg_restore --list "$DAILY_FILE" > /dev/null 2>&1 || { echo "Backup verification FAILED" >&2; rm -f "$DAILY_FILE"; exit 1; }

# Sunday: also copy to weekly
if [ "$DAY_OF_WEEK" = "7" ]; then
  cp "$DAILY_FILE" "$BACKUP_DIR/weekly/shopdb_${TIMESTAMP}.dump"
fi

# Retention: keep last 7 daily, last 4 weekly
find "$BACKUP_DIR/daily"  -name "shopdb_*.dump" -mtime +7  -delete
find "$BACKUP_DIR/weekly" -name "shopdb_*.dump" -mtime +30 -delete

SIZE=$(du -h "$DAILY_FILE" | cut -f1)
echo "[$(date)] Backup OK: $DAILY_FILE ($SIZE)"
