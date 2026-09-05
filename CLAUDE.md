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

**`sequelize.sync({ alter: !isProduction })`.** In production that is `sync()`
with no `alter`: it creates missing *tables* but never adds missing *columns* to
existing ones. The models build the schema on a fresh database; after that,
schema changes only land through migrations.

⚠️ **Nothing in `package.json` runs migrations.** Add
`npx sequelize-cli db:migrate` to the deploy step before the second release, or
new columns will silently not exist in production.

Migrations are idempotent — they check `describeTable` before adding — so they
are safe against a database that `sync({ alter: true })` already touched in dev.
Follow the existing pattern.

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
cd backend  && node server.js     # :3000
cd frontend && npm run dev        # :5173  (VITE_API_BASE_URL in .env.local)
```

`frontend/.env.production` points at the deployed API and is picked up by
`npm run build`.

Set `ENCRYPTION_KEY` — without it, AES-256 field encryption for member Aadhaar
numbers is **disabled** and the server only logs a warning. Check it is present
in the production environment.
