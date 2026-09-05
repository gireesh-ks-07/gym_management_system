# Facility Management SaaS — working notes

Multi-tenant SaaS. One platform, many facilities (gyms, studios), each on a
subscription plan. Read this before adding a role, a module, or a route.

```
backend/     Express + Sequelize (PostgreSQL). server.js is the core; feature
             modules live in routes/ + controllers/ and register themselves.
frontend/    React + Vite. The admin web app (superadmin, admin, staff, dietician).
client_app/  Flutter. The member app.
mobile_app/  Flutter. The staff/admin app.
```

---

## The two questions every route must answer

They are different questions with different answers and different HTTP codes.
Keep them apart.

| Question | File | Failure |
|---|---|---|
| May this **role** do it? | `backend/config/permissions.js` | `403 Forbidden` |
| Has this **facility** bought it? | `backend/config/modules.js` | `402 Payment Required` |

A feature-module route needs both:

```js
app.get('/api/pt/sessions',
    [authenticate, checkSubscriptionStatus, requireModule('pt'), authorize(P.PT_MANAGE)],
    ptController.getSessions);
```

Conflating these is what previously let a front-desk staff member delete diet
charts: one predicate was answering both "can they see it" and "can they destroy
it".

### Never write a role literal at a call site

`['admin', 'staff']` used to appear in over thirty places across `server.js`,
four route registrars and five React files. Adding the `dietician` role meant
updating all of them, and it was updated in some — that drift caused several
production bugs. Route gates take a capability, never an array.

---

## Adding a role

1. Add it to `ROLES` and to the relevant capability lists in
   `backend/config/permissions.js`.
2. Mirror it in `frontend/src/config/roles.js` (`ROLES`, `ROUTE_ROLES`,
   `FACILITY_STAFF` if it belongs to a facility, `homePathForRole` if it needs
   its own landing page).
3. Add it to the `User.role` enum in `backend/models/index.js` **and** write a
   migration — Postgres enums need `ALTER TYPE ... ADD VALUE`; see
   `migrations/20260815120000-add-dietician-diet-chart.js` for the idempotent
   pattern.
4. Extend `backend/scripts/rbac-smoke.sh` with what the role may and may not do.

Verify the blast radius before and after with the route-table diff — see
**Checking a permissions change** below.

## Adding a sellable module

1. One entry in `backend/config/modules.js`. Both super-admin UIs (facility
   package toggles, plan editor) render from that registry, so neither needs
   touching.
2. `requireModule('<key>')` in the module's route chain.
3. If it owns a nav item, add it to `MODULE_ROUTES` in
   `frontend/src/config/roles.js` so the sidebar and router hide it for
   facilities that don't have it.

A module resolves as: **facility override → plan tier → registry default.** The
per-facility override always wins, so support can switch something on for one
customer without inventing a plan. Declare `requires: ['other']` for
dependencies — a module whose prerequisite is off is off.

New paid add-ons should default `false`. The existing modules default `true`
because they shipped before the registry existed.

---

## Database

**Migrations own the schema.** `npm start` runs `prestart` → `npm run migrate`
first, so a deploy always migrates before the server boots.
`migrations/20260101000000-baseline-schema.js` builds all 34 tables from
nothing, so the directory alone can construct the database.

```bash
npm run migrate          # apply pending migrations
npm run migrate:status   # what has run
npm run migrate:undo     # revert the last one
```

`sequelize-cli` is a **runtime** dependency, not a dev one — a
`npm ci --omit=dev` deploy still has to be able to migrate. Connection settings
come from `config/config.js`, which reads the same environment variables as
`models/index.js`.

**`sync()` is development-only.** It used to run in production too, where —
without `alter` — it creates missing tables but silently never adds missing
columns. That is how the schema drifted from the migration history: models
gained columns production never got, and the migration that created the core
tables was deleted while still recorded as run in `SequelizeMeta`. Set
`DB_SYNC=false` locally to prove the migrations are sufficient on their own.

Every schema change needs a migration. Adding a column to a model without one
means production never gets it.

Migrations must be idempotent — check `describeTable` before adding, use
`IF NOT EXISTS` — because dev databases were built by `sync()` and already have
most of the schema. Follow the existing pattern.

To verify a schema change end to end, build one database from migrations and
another from `sync()` and diff `information_schema.columns`; they must match.

Two model-level gotchas already fixed, worth not reintroducing:

- Columns added by migration **must** also be declared on the model, or
  Sequelize neither selects nor persists them (see the Razorpay fields on
  `Facility`).
- `DataTypes.NOW` on a `TIME` column emits a full ISO timestamp that Postgres
  rejects. Use a function returning `HH:MM:SS`.

---

## Notifications

Audience is **stated**, never inferred from which id columns happen to be set.
Inferring it leaked facility notifications into the member app, because every
row carries a `facilityId` and so does the client JWT.

| `audience` | Required ids | Read by |
|---|---|---|
| `superadmin` | — | superadmins |
| `facility` | `facilityId` | that facility's staff |
| `user` | `facilityId`, `userId` | that one staff user |
| `client` | `facilityId`, `clientId` | that one member |

Every notification endpoint goes through `notificationScope(user)` in
`server.js` — reads *and* writes, which is what keeps a member from marking
someone else's notification read.

---

## Checking a permissions change

`authorize()` gates are extracted and diffed to prove a refactor changed nothing
it shouldn't. Before your change:

```bash
python3 scripts/extract-route-roles.py > /tmp/roles_before.json
```

After, re-run it and diff. Every difference should be one you intended and can
name. The role centralisation was landed this way across 106 routes with zero
differences.

Then run the live smoke test (API running, demo accounts seeded):

```bash
bash backend/scripts/rbac-smoke.sh
```

---

## Local development

```bash
cd backend  && npm start          # :3000 — migrates first, then boots
cd frontend && npm run dev        # :5173   (VITE_API_BASE_URL in .env.local)
```

`node server.js` still works but skips migrations, so prefer `npm start`.

`frontend/.env.production` points at the deployed API and is picked up by
`npm run build`.

### Required environment

| Variable | Why |
|---|---|
| `DATABASE_URL` *or* `DB_HOST`/`DB_NAME`/`DB_USER`/`DB_PASSWORD` | Database. A URL wins when both are present. |
| `ENCRYPTION_KEY` | Without it AES-256 encryption of member Aadhaar numbers is **disabled** and the server only warns. |
| `SUPERADMIN_DEFAULT_PASSWORD` | Production refuses to seed the superadmin with the well-known default. |
| `JWT_SECRET` | Token signing. |
| `DB_SSL_REJECT_UNAUTHORIZED=false` | Only for providers with self-signed certificates. Never as a default. |

`backend/config/config.json` used to hold the database password in plain text
and was committed. It has been replaced by `config/config.js` reading the
environment — **the password in git history should be rotated.**
