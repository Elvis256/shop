#!/bin/bash
# Local uptime monitor — checks ugsex.com endpoints, logs failures, alerts on 3 consecutive fails.
# Run every minute via cron.
set -uo pipefail

STATE_DIR=/var/lib/shop-uptime
LOG=/var/log/shop-uptime.log
ALERT_LOG=/var/log/shop-uptime-alerts.log
FAIL_THRESHOLD=3
ALERT_COOLDOWN_MIN=15

mkdir -p "$STATE_DIR"

check() {
  local name=$1
  local url=$2
  local expected=$3
  local state_file="$STATE_DIR/${name}.fails"
  local last_alert_file="$STATE_DIR/${name}.last_alert"

  local status
  status=$(curl -ksL -o /dev/null -w "%{http_code}" --max-time 10 "$url" 2>/dev/null || echo "000")

  if [ "$status" = "$expected" ]; then
    if [ -f "$state_file" ] && [ "$(cat "$state_file")" -ge "$FAIL_THRESHOLD" ]; then
      echo "[$(date)] RECOVERED $name ($url) → $status" | tee -a "$LOG" "$ALERT_LOG"
      /root/shop/shop/scripts/telegram-alert.sh "✅ *Recovered* \`$name\` is back up after being down." 2>/dev/null || true
    fi
    echo 0 > "$state_file"
    return 0
  fi

  local prev=0
  [ -f "$state_file" ] && prev=$(cat "$state_file")
  local fails=$((prev + 1))
  echo "$fails" > "$state_file"
  echo "[$(date)] FAIL #$fails $name ($url) → $status (expected $expected)" >> "$LOG"

  if [ "$fails" -ge "$FAIL_THRESHOLD" ]; then
    local now=$(date +%s)
    local last_alert=0
    [ -f "$last_alert_file" ] && last_alert=$(cat "$last_alert_file")
    local cooldown_sec=$((ALERT_COOLDOWN_MIN * 60))
    if [ $((now - last_alert)) -ge "$cooldown_sec" ]; then
      echo "$now" > "$last_alert_file"
      MSG="🚨 *UGSex Down*\n\nCheck: \`$name\`\nURL: $url\nStatus: $status (expected $expected)\nConsecutive fails: $fails\nTime: $(date)"
      echo "[$(date)] 🚨 ALERT $name down for $fails checks. URL=$url status=$status" | tee -a "$ALERT_LOG"
      /root/shop/shop/scripts/telegram-alert.sh "$MSG" 2>/dev/null || true
    fi
  fi
}

check "homepage"    "https://ugsex.com/"                       "200"
check "api-health"  "https://ugsex.com/api/health"             "200"
check "api-prods"   "https://ugsex.com/api/products?limit=1"   "200"
check "admin-page"  "https://ugsex.com/admin/login"            "200"
