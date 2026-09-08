#!/usr/bin/env bash
#
#   sudo bash deploy/configure-domain.sh app.example.com
#
# Points the whole stack at one domain: renders the nginx site, sets
# ALLOWED_ORIGIN in backend/.env, and writes frontend/.env.production so the
# next build talks to the right host. Does not request a certificate — run
# certbot after DNS resolves (see deploy/README.md).
set -euo pipefail

DOMAIN="${1:-}"
[ -n "$DOMAIN" ] || { echo "Usage: sudo bash deploy/configure-domain.sh <domain>" >&2; exit 1; }
[ "$(id -u)" -eq 0 ] || { echo "Run with sudo." >&2; exit 1; }

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_USER="${SUDO_USER:-ubuntu}"

sed "s/__DOMAIN__/${DOMAIN}/g" "${APP_DIR}/deploy/nginx-site.conf.template" \
    > /etc/nginx/sites-available/facility
ln -sf /etc/nginx/sites-available/facility /etc/nginx/sites-enabled/facility
rm -f /etc/nginx/sites-enabled/default

# Same origin for the dashboard, so the API base URL is just the domain.
# Note: an empty VITE_API_BASE_URL does NOT mean "relative" — frontend/src/api.js
# falls back to a hardcoded host when the value is falsy. Always set it.
cat > "${APP_DIR}/frontend/.env.production" <<VITEEOF
# Written by deploy/configure-domain.sh — used by \`npm run build\`.
VITE_API_BASE_URL=https://${DOMAIN}
VITEEOF
chown "${APP_USER}:${APP_USER}" "${APP_DIR}/frontend/.env.production"

ENV_FILE="${APP_DIR}/backend/.env"
if [ -f "$ENV_FILE" ]; then
    if grep -q '^ALLOWED_ORIGIN=' "$ENV_FILE"; then
        sed -i "s|^ALLOWED_ORIGIN=.*|ALLOWED_ORIGIN=https://${DOMAIN}|" "$ENV_FILE"
    else
        echo "ALLOWED_ORIGIN=https://${DOMAIN}" >> "$ENV_FILE"
    fi
    echo "ALLOWED_ORIGIN set to https://${DOMAIN}"
fi

nginx -t
systemctl reload nginx

cat <<NEXT

  nginx now serves ${DOMAIN} over http.

  Once an A record for ${DOMAIN} points at this instance's Elastic IP:

      sudo certbot --nginx -d ${DOMAIN} --redirect

  Then rebuild so the dashboard picks up the https base URL:

      bash deploy/release.sh

NEXT
