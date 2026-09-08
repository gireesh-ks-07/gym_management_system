# Deploying to a fresh EC2 instance

One instance runs everything: nginx (dashboard + TLS), Node on `:3000`, and
PostgreSQL on `localhost`. Scripts here are idempotent — re-running one is
always safe.

| Script | When | As |
|---|---|---|
| `bootstrap.sh` | once, on a new instance | `sudo` |
| `configure-domain.sh <domain>` | once, and again if the domain changes | `sudo` |
| `release.sh [--pull]` | every deploy | app user |
| `backup.sh` | nightly, from cron | app user |

---

## 1. The instance

- **AMI** Ubuntu Server 24.04 LTS
- **Type** `t3.small` or larger. `t3.micro` works only because `bootstrap.sh`
  adds 2 GB of swap — 1 GB of RAM is not enough for the Vite build, which
  otherwise gets OOM-killed and leaves a truncated `dist/`.
- **Storage** 20 GB gp3
- **Elastic IP** allocate and associate one, or the address changes on every
  stop/start and DNS goes stale.

Security group inbound: `22` from your IP only, `80` and `443` from anywhere.
**Do not open `5432` or `3000`** — Postgres listens on localhost and Node is
reached only through nginx. `ufw` on the box enforces the same thing.

## 2. Get the code onto it

```bash
ssh -i your-key.pem ubuntu@<elastic-ip>
sudo install -d -o ubuntu -g ubuntu /opt/facility
git clone <your-repo-url> /opt/facility
cd /opt/facility
```

A private repo needs credentials: either a GitHub deploy key on the instance,
or a personal access token in the clone URL. If you would rather not put
credentials on the server, `rsync -a --exclude node_modules ./
ubuntu@<ip>:/opt/facility/` from your laptop instead.

## 3. Provision

```bash
sudo bash deploy/bootstrap.sh
```

Installs Node 22, PostgreSQL 16, nginx, pm2 and certbot; creates the
`facility` role and `facility_db`; writes `backend/.env` with a generated
`SECRET_KEY`, `ENCRYPTION_KEY`, database password and superadmin password.

Read those out and save them before going further:

```bash
grep -E 'SUPERADMIN|DB_PASSWORD|ENCRYPTION_KEY' /opt/facility/backend/.env
```

`ENCRYPTION_KEY` is not recoverable. It decrypts members' Aadhaar numbers, and
it is not in the database dumps — keep a copy off this instance.

Set `SUPERADMIN_EMAIL` to a real address now if you want one; the superadmin is
seeded on first boot from whatever that file says at the time.

## 4. Point it at a domain

Create an A record for your domain pointing at the Elastic IP, wait for it to
resolve, then:

```bash
sudo bash deploy/configure-domain.sh app.example.com
sudo certbot --nginx -d app.example.com --redirect
```

This wires one origin end to end: nginx serves the dashboard and proxies
`/api` to Node, `frontend/.env.production` gets `VITE_API_BASE_URL`, and
`ALLOWED_ORIGIN` in `backend/.env` matches. Because dashboard and API share an
origin the browser never makes a cross-origin request at all.

Certbot installs a renewal timer itself — `systemctl list-timers snap.certbot*
certbot*` to confirm.

## 5. Release

```bash
bash deploy/release.sh
```

Installs dependencies, runs migrations, builds the dashboard into
`/var/www/facility`, starts the API under pm2, and health-checks it.

Make pm2 survive a reboot — once, after the first successful release:

```bash
pm2 startup systemd -u ubuntu --hp /home/ubuntu   # prints a command
sudo env PATH=$PATH pm2 startup systemd -u ubuntu --hp /home/ubuntu
pm2 save
```

## 6. Verify

```bash
curl -s https://app.example.com/api/health?db=1     # {"status":"ok","database":"ok"}
pm2 logs facility-api --lines 50
```

Expect `[db] production: schema comes from migrations (sync disabled)` in the
log. `sync()` is off in production by design — see the database section of
`CLAUDE.md`.

Then open `https://app.example.com`, log in as the superadmin, **change that
password immediately**, and create a facility.

With demo accounts seeded, the role gates can be checked live:

```bash
bash backend/scripts/rbac-smoke.sh
```

## 7. Backups

The database is on this instance, so nothing else is protecting it.

```bash
sudo install -d -o ubuntu -g ubuntu /var/backups/facility /var/log/facility
crontab -e
# 15 2 * * * /opt/facility/deploy/backup.sh >> /var/log/facility/backup.log 2>&1
```

Keeps 14 days locally. Copy them off the box (`aws s3 sync /var/backups/facility
s3://your-bucket/db/`) — a backup on the disk you are protecting against is not
a backup. A snapshot schedule on the EBS volume is a reasonable second layer.

---

## Deploying a change later

```bash
cd /opt/facility && bash deploy/release.sh --pull
```

Every schema change needs a migration; `release.sh` runs them before restarting
and stops the deploy if one fails. A model column without a migration will
simply not exist in production.

## The mobile apps

Both Flutter apps hardcode their release API host, so they need editing and
rebuilding — they do not pick up anything from this deploy:

- `mobile_app/lib/core/constants/app_constants.dart:14` — staff/admin app
- `client_app/lib/core/network/api_client.dart` — member app, currently
  localhost-only, needs a release branch

Set both to `https://app.example.com/api`. They send no `Origin` header, so the
CORS allowlist does not apply to them.

## Operations

```bash
pm2 status                       # is it up
pm2 logs facility-api            # app logs
pm2 restart facility-api         # restart (re-runs migrations)
sudo tail -f /var/log/nginx/facility.error.log
sudo -u postgres psql facility_db
cd backend && npm run migrate:status
```

## Things that will bite

**Rotate the password that was in git.** `backend/config/config.json` once held
the database password in plain text and was committed. This deploy generates a
new one, so a fresh instance is clean — but the old credential is still in the
history of any database that used it.

**`DATABASE_URL` vs `DB_*`.** `config/config.js` forces `ssl: { require: true }`
whenever `DATABASE_URL` is set. Local Postgres has no certificate, so this
deploy uses the discrete `DB_HOST`/`DB_NAME`/… variables. Only reach for
`DATABASE_URL` if you later move to RDS, and pair it with
`DB_SSL_REJECT_UNAUTHORIZED=false` for the AWS chain.

**`VITE_API_BASE_URL` cannot be blank.** `frontend/src/api.js` falls back to a
hardcoded host when the value is falsy, so an empty string does not mean
"relative" — it means "someone else's server".

**The build is baked in.** `VITE_API_BASE_URL` is compiled into the bundle.
Changing the domain means re-running `configure-domain.sh` *and*
`release.sh`; restarting nginx alone does nothing.

**One pm2 instance, not cluster mode.** `server.js` registers `node-cron` jobs;
a second worker would run every scheduled job twice.
