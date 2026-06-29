#!/bin/bash
# Send a Telegram alert. Reads credentials from /etc/shop-alerts/telegram.env
# Usage: ./telegram-alert.sh "message text"
set -uo pipefail

ENV_FILE=/etc/shop-alerts/telegram.env
if [ ! -r "$ENV_FILE" ]; then
  echo "telegram-alert: credentials file missing: $ENV_FILE" >&2
  exit 1
fi
# shellcheck source=/dev/null
. "$ENV_FILE"

MESSAGE="${1:-(no message)}"

# Telegram has a 4096-char limit
MESSAGE="${MESSAGE:0:4000}"

curl -sS --max-time 10 \
  -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
  -d "chat_id=${TELEGRAM_CHAT_ID}" \
  --data-urlencode "text=${MESSAGE}" \
  -d "parse_mode=Markdown" \
  -d "disable_web_page_preview=true" > /dev/null
