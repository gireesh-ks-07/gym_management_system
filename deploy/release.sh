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

# The dashboard is only built here when nginx is the one serving it. With
# Amplify hosting the frontend, set SKIP_FRONTEND=1 and this box serves the API
# alone — no second, drifting copy of the build.
if [ "${SKIP_FRONTEND:-0}" = "1" ]; then
    say "Skipping the dashboard build (SKIP_FRONTEND=1)"
else
    say "Building the dashboard"
    # --include=dev is required: vite and the react plugin are devDependencies,
    # and the NODE_ENV=production above makes npm omit them by default.
    npm --prefix frontend ci --include=dev
    npm --prefix frontend run build

    say "Publishing to ${WEB_ROOT}"
    sudo install -d -o "$USER" -g "$USER" "$WEB_ROOT"
    rsync -a --delete frontend/dist/ "$WEB_ROOT/"
fi

say "Restarting the API"
sudo install -d -o "$USER" -g "$USER" /var/log/facility
pm2 startOrReload deploy/ecosystem.config.js --update-env
pm2 save

say "Health check"
# Boot is not instant: the server seeds gamification defaults and generates
# scheduled challenges before it listens. A flat sleep reports failure against a
# perfectly healthy server, so poll instead.
for attempt in $(seq 1 30); do
    if curl -fsS "http://127.0.0.1:3000/api/health?db=1" 2>/dev/null; then
        echo
        pm2 status facility-api
        exit 0
    fi
    sleep 2
done

echo "API did not answer on 127.0.0.1:3000 within 60s." >&2
pm2 status facility-api
echo "--- last 40 log lines ---" >&2
pm2 logs facility-api --lines 40 --nostream >&2
exit 1
