#!/bin/bash
set -e

DOMAIN="ugsex.com"
EMAIL="admin@ugsex.com"   # ← change to your real email for SSL cert notifications
DIR="$(cd "$(dirname "$0")" && pwd)"

echo "══════════════════════════════════════════════"
echo "  Deploying shop to $DOMAIN"
echo "══════════════════════════════════════════════"

# ── 1. Install Docker ─────────────────────────────────────────────────────────
if ! command -v docker &>/dev/null; then
  echo "[1/6] Installing Docker..."
  apt-get update -q
  apt-get install -y -q ca-certificates curl gnupg
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
    https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -q
  apt-get install -y -q docker-ce docker-ce-cli containerd.io docker-compose-plugin
  echo "[1/6] Docker installed ✓"
else
  echo "[1/6] Docker already installed ✓"
fi

# ── 2. Install Certbot ────────────────────────────────────────────────────────
if ! command -v certbot &>/dev/null; then
  echo "[2/6] Installing Certbot..."
  apt-get install -y -q certbot
  echo "[2/6] Certbot installed ✓"
else
  echo "[2/6] Certbot already installed ✓"
fi

# ── 3. Check .env files ───────────────────────────────────────────────────────
echo "[3/6] Checking environment files..."
if grep -q "change_this" "$DIR/.env" || grep -q "change_this" "$DIR/backend/.env"; then
  echo ""
  echo "  ⚠  You must fill in your real values before deploying!"
  echo ""
  echo "  Edit these files:"
  echo "    $DIR/.env                ← set POSTGRES_PASSWORD"
  echo "    $DIR/backend/.env        ← set JWT_SECRET, Flutterwave keys, SMTP"
  echo ""
  read -p "  Have you updated them? (y/N): " confirm
  [[ "$confirm" =~ ^[Yy]$ ]] || { echo "Aborted. Edit the .env files first."; exit 1; }
fi
echo "[3/6] Environment files OK ✓"

# ── 4. Start app services (without nginx) ────────────────────────────────────
echo "[4/6] Starting app services (postgres, redis, backend, frontend)..."
cd "$DIR"
docker compose up -d postgres redis backend frontend
echo "  Waiting for services to be ready..."
sleep 15
echo "[4/6] App services running ✓"

# ── 5. Get SSL certificate ────────────────────────────────────────────────────
if [ ! -d "/etc/letsencrypt/live/$DOMAIN" ]; then
  echo "[5/6] Obtaining SSL certificate for $DOMAIN..."

  # Temporarily use HTTP-only nginx to serve ACME challenge
  cp "$DIR/nginx/nginx.http.conf" "$DIR/nginx/nginx.conf"
  docker compose up -d nginx
  sleep 3

  # Create webroot directory
  docker compose exec nginx mkdir -p /var/www/certbot

  # Get the certificate
  certbot certonly \
    --webroot \
    --webroot-path /var/www/certbot \
    -d "$DOMAIN" \
    -d "www.$DOMAIN" \
    --email "$EMAIL" \
    --agree-tos \
    --non-interactive \
    --rsa-key-size 4096

  echo "[5/6] SSL certificate obtained ✓"
else
  echo "[5/6] SSL certificate already exists ✓"
fi

# ── 6. Switch to HTTPS nginx config and reload ───────────────────────────────
echo "[6/6] Switching to HTTPS configuration..."
cp "$DIR/nginx/nginx.ssl.conf" "$DIR/nginx/nginx.conf" 2>/dev/null || true
# The final nginx.conf already has SSL — just restart nginx
docker compose restart nginx
sleep 3

echo ""
echo "══════════════════════════════════════════════"
echo "  ✅  Deployment complete!"
echo ""
echo "  🌐  https://$DOMAIN"
echo ""
echo "  Next steps:"
echo "    • Make sure DNS A record for $DOMAIN → 212.47.69.106"
echo "    • Make sure DNS A record for www.$DOMAIN → 212.47.69.106"
echo "    • Set up auto-renewal: certbot renew --dry-run"
echo "    • Add to crontab: 0 3 * * * certbot renew --quiet && docker compose -f $DIR/docker-compose.yml restart nginx"
echo "══════════════════════════════════════════════"
