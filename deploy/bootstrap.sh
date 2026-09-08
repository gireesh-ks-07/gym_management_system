#!/usr/bin/env bash
#
# One-time provisioning for a fresh Ubuntu 24.04 EC2 instance.
#
#   sudo bash deploy/bootstrap.sh
#
# Installs Node 22, PostgreSQL 16, nginx, pm2 and certbot; creates the
# database role and database; generates backend/.env with fresh secrets.
# Safe to re-run — every step checks before it acts.
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_USER="${SUDO_USER:-ubuntu}"
DB_NAME="${DB_NAME:-facility_db}"
DB_USER="${DB_USER:-facility}"
NODE_MAJOR=22

[ "$(id -u)" -eq 0 ] || { echo "Run with sudo." >&2; exit 1; }

say() { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }

# --- Swap ----------------------------------------------------------------
# The Vite build needs more than a t3.micro's 1 GB. Without swap it is OOM-killed
# halfway through and leaves a truncated dist/.
if [ ! -f /swapfile ] && [ "$(free -m | awk '/^Mem:/{print $2}')" -lt 2000 ]; then
    say "Adding 2G swap (small instance)"
    fallocate -l 2G /swapfile
    chmod 600 /swapfile
    mkswap /swapfile >/dev/null
    swapon /swapfile
    grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

# --- Packages ------------------------------------------------------------
say "Installing system packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq curl git rsync ufw nginx postgresql postgresql-contrib \
    certbot python3-certbot-nginx build-essential

if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt "$NODE_MAJOR" ]; then
    say "Installing Node ${NODE_MAJOR}"
    curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
    apt-get install -y -qq nodejs
fi

command -v pm2 >/dev/null || { say "Installing pm2"; npm install -g pm2@latest; }

systemctl enable --now postgresql nginx

# --- Database ------------------------------------------------------------
# The role owns the database because migrations run ALTER TYPE ... ADD VALUE,
# which Postgres only allows the owner of the enum type to do.
DB_PASSWORD=""
if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'" | grep -q 1; then
    DB_PASSWORD="$(openssl rand -hex 24)"
    say "Creating role ${DB_USER} and database ${DB_NAME}"
    sudo -u postgres psql -q -c "CREATE ROLE ${DB_USER} LOGIN PASSWORD '${DB_PASSWORD}';"
else
    echo "Role ${DB_USER} already exists — keeping its password."
fi
sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1 || \
    sudo -u postgres createdb -O "${DB_USER}" "${DB_NAME}"

# --- backend/.env --------------------------------------------------------
ENV_FILE="${APP_DIR}/backend/.env"
if [ -f "$ENV_FILE" ]; then
    say "backend/.env already exists — leaving it alone"
else
    [ -n "$DB_PASSWORD" ] || { echo "Role existed but .env is missing; set DB_PASSWORD by hand." >&2; DB_PASSWORD="CHANGE_ME"; }
    say "Writing backend/.env with generated secrets"
    cat > "$ENV_FILE" <<ENVEOF
NODE_ENV=production
PORT=3000

# Set by deploy/configure-domain.sh once you have a domain.
ALLOWED_ORIGIN=http://localhost:5173

# Local Postgres. Discrete DB_* vars deliberately, not DATABASE_URL:
# config/config.js forces ssl.require whenever DATABASE_URL is set, and a
# local socket-less TCP connection to 127.0.0.1 has no certificate.
DB_HOST=127.0.0.1
DB_PORT=5432
DB_NAME=${DB_NAME}
DB_USER=${DB_USER}
DB_PASSWORD=${DB_PASSWORD}

# JWT signing. Rotating this logs every session out.
SECRET_KEY=$(openssl rand -hex 32)

# AES-256-GCM for member Aadhaar numbers. Rotating this makes existing
# encrypted rows unreadable — back it up somewhere outside this box.
ENCRYPTION_KEY=$(openssl rand -hex 32)

# Seeded on first boot only. Change the password after your first login.
SUPERADMIN_EMAIL=admin@example.com
SUPERADMIN_DEFAULT_PASSWORD=$(openssl rand -base64 18 | tr -d '/+=' | head -c 20)

# Razorpay AutoPay — optional, leave blank to disable.
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=
ENVEOF
    chown "${APP_USER}:${APP_USER}" "$ENV_FILE"
    chmod 600 "$ENV_FILE"
fi

# --- Firewall ------------------------------------------------------------
say "Configuring ufw"
ufw allow OpenSSH >/dev/null
ufw allow 'Nginx Full' >/dev/null
ufw --force enable >/dev/null

install -d -o "$APP_USER" -g "$APP_USER" /var/www/facility
chown -R "${APP_USER}:${APP_USER}" "$APP_DIR"

say "Bootstrap complete"
cat <<NEXT

  Superadmin credentials seeded on first boot are in backend/.env —
  read them now and store them in your password manager:

      grep -E 'SUPERADMIN|DB_PASSWORD' ${ENV_FILE}

  Next:
      sudo bash deploy/configure-domain.sh your.domain.com
      bash deploy/release.sh

NEXT
