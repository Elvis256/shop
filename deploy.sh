#!/bin/bash
set -e

DOMAIN="ugsex.com"
EMAIL="admin@ugsex.com"
DIR="$(cd "$(dirname "$0")" && pwd)"

echo "══════════════════════════════════════════════"
echo "  Deploying shop to $DOMAIN (PM2 + host nginx)"
echo "══════════════════════════════════════════════"

# ── 1. Verify host services ──────────────────────────────────────────────────
echo "[1/5] Verifying host services..."
for svc in postgresql redis-server nginx; do
  if ! systemctl is-active --quiet "$svc"; then
    echo "  ❌  $svc is not running. Start it with: systemctl start $svc"
    exit 1
  fi
done
command -v pm2 >/dev/null || { echo "  ❌  pm2 not installed. Install: npm i -g pm2"; exit 1; }
echo "[1/5] postgres, redis, nginx, pm2 — OK ✓"

# ── 2. Check .env files ──────────────────────────────────────────────────────
echo "[2/5] Checking environment files..."
if grep -q "change_this" "$DIR/.env" 2>/dev/null || grep -q "change_this" "$DIR/backend/.env" 2>/dev/null; then
  echo "  ⚠  Edit the .env files first:"
  echo "      $DIR/backend/.env  ← JWT_SECRET, DB password, Flutterwave keys, SMTP"
  read -rp "  Have you updated them? (y/N): " confirm
  [[ "$confirm" =~ ^[Yy]$ ]] || { echo "Aborted."; exit 1; }
fi
echo "[2/5] Environment files OK ✓"

# ── 3. Build backend & frontend ──────────────────────────────────────────────
echo "[3/5] Building backend..."
cd "$DIR/backend" && npm ci --omit=dev=false --legacy-peer-deps && npm run build

echo "[3/5] Building frontend..."
cd "$DIR/frontend" && npm ci --legacy-peer-deps && npm run build
echo "[3/5] Builds OK ✓"

# ── 4. Reload PM2 ────────────────────────────────────────────────────────────
echo "[4/5] Reloading PM2 apps (zero-downtime)..."
cd "$DIR"
pm2 reload ecosystem.config.js --update-env
pm2 save
echo "[4/5] PM2 reload OK ✓"

# ── 5. SSL + nginx reload ────────────────────────────────────────────────────
if [ ! -d "/etc/letsencrypt/live/$DOMAIN" ]; then
  echo "[5/5] No SSL certificate. Obtain with:"
  echo "  certbot --nginx -d $DOMAIN -d www.$DOMAIN --email $EMAIL --agree-tos"
else
  echo "[5/5] Reloading host nginx..."
  nginx -t && systemctl reload nginx
fi

echo ""
echo "══════════════════════════════════════════════"
echo "  ✅  Deployment complete!"
echo "  🌐  https://$DOMAIN"
echo ""
echo "  Useful commands:"
echo "    pm2 status                    # check apps"
echo "    pm2 logs shop-frontend        # tail frontend logs"
echo "    pm2 logs shop-backend         # tail backend logs"
echo "    pm2 reload shop-frontend      # zero-downtime reload"
echo "    nginx -t && systemctl reload nginx"
echo "    certbot renew --dry-run       # test SSL renewal"
echo "══════════════════════════════════════════════"
