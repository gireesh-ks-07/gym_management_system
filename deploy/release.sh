#!/usr/bin/env bash
#
#   bash deploy/release.sh            # build and restart what is checked out
#   bash deploy/release.sh --pull     # git pull first
#
# Run as the app user (not root). Idempotent; safe to re-run.
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WEB_ROOT=/var/www/facility
export NODE_ENV=production

say() { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }

cd "$APP_DIR"

if [ "${1:-}" = "--pull" ]; then
    say "Pulling latest"
    git pull --ff-only
fi

say "Installing backend dependencies"
# --omit=dev is safe: sequelize-cli is a runtime dependency precisely so that a
# production install can still migrate.
npm --prefix backend ci --omit=dev

say "Running migrations"
# Explicit, so a bad migration fails the deploy here rather than as a pm2
# crash-loop after the old process has already been replaced.
( cd backend && npm run migrate )

say "Building the dashboard"
# Full install here — vite and the react plugin are devDependencies.
npm --prefix frontend ci
npm --prefix frontend run build

say "Publishing to ${WEB_ROOT}"
sudo install -d -o "$USER" -g "$USER" "$WEB_ROOT"
rsync -a --delete frontend/dist/ "$WEB_ROOT/"

say "Restarting the API"
sudo install -d -o "$USER" -g "$USER" /var/log/facility
pm2 startOrReload deploy/ecosystem.config.js --update-env
pm2 save

say "Health check"
sleep 3
curl -fsS "http://127.0.0.1:3000/api/health?db=1" && echo
pm2 status facility-api
