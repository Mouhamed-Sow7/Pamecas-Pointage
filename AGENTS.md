# SmartPointage — AGENTS.md

> Guide for AI agents working on this codebase. Last updated: Sept 2026 (v2).

---

## 1. Quick Start

```bash
npm install           # Install dependencies
cp .env.example .env  # Edit MONGODB_URI, JWT_SECRET, etc.
npm run seed          # Seed PAMECAS instance
npm run seed:cms      # Seed CMS instance
npm run seed:gmv      # Seed GMV instance
npm run dev           # Start with nodemon on :3000
```

**URLs:** `/` = landing page, `/app` = admin SPA, `/agent` = agent portal, `/kiosk` = kiosk scan, `/admin` = SaaS admin panel.

**Demo credentials:** See `USERS.md`. Default passwords: `pamecas2024!` (admins), `point2024!` (pointeurs), `gmv2024!` (GMV), `cms2024!` (CMS).

---

## 2. Architecture

### Three frontends, one backend

| App | URL | Path | Tech |
|-----|-----|------|------|
| **Landing page** | `/` | `landing/` | Static HTML/CSS/JS |
| **Admin SPA** | `/app` | `client/public/src/` | Vanilla JS, hash-routing, Service Worker |
| **Agent Portal** | `/agent` | `client/public/agent.html` | Vanilla JS, PWA (manifest-agent.json) |
| **Kiosk** | `/kiosk` | `client/public/kiosk.html` | Vanilla JS, QR scanner (jsQR), PWA (manifest-kiosk.json) |
| **SaaS Admin** | `/admin` | `admin/` | Vanilla JS, separate panel |

### Backend (Express + MongoDB)

```
server/
  app.js           # Entry point: Express + Socket.IO + CSP + static serving + routes
  config/db.js     # MongoDB connection with retry logic
  middleware/auth.js  # authenticate, authorizeRoles, tenantFilter, tenantScope
  models/
    Agent.js       # Agents (employees) with TOTP, OTP, session_token, demande_deconnexion
    Pointage.js    # Timeclock records with GPS coords, sync_status
    Site.js        # Agency/site with kiosque_token, kiosque_pin, coordonnees, region
    User.js        # Admin users (role-based)
    Conge.js       # Leave requests
    Tenant.js      # Multi-tenant subscription/billing model
    Device.js      # WebAuthn passkey credentials
    SyncQueue.js   # Offline sync queue
  routes/          # One router per resource (agents, auth, pointages, sites, etc.)
  services/
    emailReports.js # Monthly Excel report generation + Brevo/SendGrid email
  utils/
    totp.js        # HMAC-SHA256 TOTP for dynamic QR codes
```

### Multi-tenant model

The `instance_slug` field (default: `"pamecas"`) scopes data per tenant. Every model inherits it from the associated `Site`. The `auth.js` middleware provides `tenantScope` (adds `instance_slug` filter) and `tenantFilter` (scopes by `site_id` based on user role). A `instance_slug === null` means superadmin cross-tenant access.

**Three tenants seeded:** `pamecas` (microfinance), `cms` (Credit Mutuel), `gmv` (Grande Muraille Verte / ASERGMV). GMV uses different terminology internally (Zone instead of Agence, etc.).

---

## 3. Essential Commands

| Command | What it does |
|---------|-------------|
| `npm start` | Production start |
| `npm run dev` | Dev with nodemon |
| `npm run seed` | Seed PAMECAS (sites, users, agents, pointages) |
| `npm run seed:cms` | Seed CMS tenant |
| `npm run seed:gmv` | Seed GMV tenant |
| `npm run migrate` | Run `server/scripts/migrate_matricules.js` |
| `npm run reset:passwords` | Reset all demo passwords to defaults |
| `npm test` | Jest (setup exists but no tests written yet) |

**MongoDB scripts:** `scripts/purge-and-reseed.mongosh.js` — run in `mongosh` to wipe all collections before reseeding.

---

## 4. Authentication & Authorization

### 4.1 Three auth methods

1. **JWT (admin users)** — `POST /api/auth/login` → returns JWT with `{id, username, role, site_id, instance_slug}`. Middleware: `authenticate`, `authorizeRoles(...)`.
2. **Kiosk UUID token** — `Site.kiosque_token` is a UUID. Passed as Bearer token. Detected via regex in `auth.js`. Sets `req.user.is_kiosque = true`.
3. **Agent Portal** — Basic Auth (login) → JWT with `session_id`. Second login invalidates first (`session_token` in DB). Middleware: `authenticateAgent` in `agent-portal.js`.
4. **Superadmin Token** — If `SUPERADMIN_TOKEN` env var matches, skips all checks.
5. **God Mode** — `POST /api/auth/godmode` with `GOD_MODE_PASSWORD` → JWT superadmin.

### 4.2 Roles hierarchy

`superadmin` > `directeur_regional` (multi-site) > `admin` (single site) > `superviseur` (read-only) > `pointeur` (scan only).

### 4.3 Middleware ordering

Routes typically chain: `[authenticate, authorizeRoles(...), tenantFilter, tenantScope]`. The `tenantFilter` scopes queries by `site_id` (per-user). The `tenantScope` scopes by `instance_slug` (cross-tenant safety).

---

## 5. Security & Anti-Fraud Layers

This is the most important feature set. Listed in order of strength:

| Layer | Mechanism | Details |
|-------|-----------|---------|
| **TOTP QR** | HMAC-SHA256, window 30s, ±1 tolerance | `server/utils/totp.js` — QR code changes every 30s |
| **Geofencing** | Haversine distance, 500m radius | `pointages.js:22-32` — rejects if `distanceM > 500` |
| **Session unique** | `session_token` in DB | Agent login invalidates previous session |
| **Cooldown** | 60s between scans | Both client-side and server-side (`last_scan_at`) |
| **PIN kiosque** | 6-digit, rotates every 8h | Cron in `app.js:40-66` — runs every 30min, rotates expired PINs |
| **Geofencing interactif** | Mosaïque OSM 3×3, marqueur rouge/bleu, clic pour positionner | Client-side `sites.js:415-665` — modal, pos. manuelle, retrait |
| **Multi-tenant isolation** | `instance_slug` on every model | Inherited from Site on `pre('save')` |

**TOTP format:** `SP:{matricule}:{hex12}:{window}` — generated client-side via `crypto.subtle` for offline compatibility.

---

## 6. Offline-First Architecture

### Client-side storage (`client/public/src/store/`)

- **IndexedDB** (`indexedDB.js`): Stores `pointages_pending`, `agents_cache`, `auth_cache`
- **Sync Manager** (`syncManager.js`): `syncPending()` sends queued pointages to `POST /api/pointages/sync` on reconnect
- **Service Worker** (`sw.js`): Caches static assets (cache version must be bumped on deploy). Current version: `smartpointage-v10`.

### Flow

1. Pointage created offline → saved to IndexedDB with `sync_status: "local"`
2. `navigator.onLine` event → `syncPending()` → `POST /api/pointages/sync`
3. Server processes batch → returns success → `clearSynced()` removes from IndexedDB

---

## 7. URLs & Routing

### Backend routes

| Prefix | File | Description |
|--------|------|-------------|
| `POST /api/auth/login` | `routes/auth.js` | Admin login |
| `GET /api/auth/branding/:slug` | `routes/auth.js` | Public multi-tenant branding |
| `GET /api/auth/me` | `routes/auth.js` | Current user info |
| `GET /api/auth/kiosque/:token` | `routes/auth.js` | Validate kiosk token |
| `GET /api/health` | `app.js:144-146` | Health check (keep-alive for Render) |
| `GET /api/sites/debug-pin-mismatch/:matricule` | `routes/sites.js:32` | Debug duplicate Site PIN mismatch |
| `PUT/PATCH /api/sites/:id/coordonnees` | `routes/sites.js:233-234` | Set/clear geofencing GPS position |
| `/api/agents` | `routes/agents.js` | CRUD agents + QR sheet + CSV import |
| `/api/pointages` | `routes/pointages.js` | Arrival/departure + sync + geofencing |
| `/api/sites` | `routes/sites.js` | CRUD sites + kiosque token management |
| `/api/rapports` | `routes/rapports.js` | Dashboard stats + Excel export |
| `/api/users` | `routes/users.js` | CRUD admin users |
| `/api/admin` | `routes/admin.js` | SaaS admin dashboard + tenant management |
| `/api/agent-portal` | `routes/agent-portal.js` | Agent login, profile, QR, leave requests |
| `/api/conges` | `routes/conges.js` | Leave approval workflow |
| `/api/passkey` | `routes/passkey.js` | WebAuthn registration + authentication |

### Static serving (from `app.js`)

| Path | Source |
|------|--------|
| `/` | `landing/` |
| `/admin` | `admin/` |
| `/app` | `client/public/` |
| `/agent` | `client/public/agent.html` |
| `/kiosk` | `client/public/kiosk.html` |

---

## 8. Code Patterns & Conventions

### Backend

- **Language:** French (comments, variable names, error messages, commit messages, markdown files)
- **Error responses:** Always `{ message: "..." }` with appropriate HTTP status code
- **Route structure:** `router.use(authenticate)`, `router.use(tenantFilter)`, `router.use(tenantScope)` at top
- **Models:** All models have `instance_slug` (default `"pamecas"`) and a `pre("save")` hook to inherit it from the associated Site
- **Validation:** Joi schemas for agent creation/update (`routes/agents.js:117-164`)
- **Phone validation:** Senegal numbers only — regex `^(77|78|76|75|70|33)[0-9]{7}$`
- **Pagination:** Agents route uses `page` and `limit` query params with `skip` calculation
- **Exports:** `module.exports = { app, server, io }` from `app.js`

### Frontend

- **Vanilla JS** — no framework (no React, Vue, etc.)
- **Hash routing** — `#/login`, `#/dashboard`, `#/pointage`, `#/agents`, etc.
- **State in localStorage** — `pamecas_token`, `pamecas_user`, `kiosque_mode`, `kiosk_token`, `sp_branding`
- **API calls** through `api.js` — `get()`, `post()`, `put()`, `del()` wrappers
- **Branding** — `GET /api/auth/branding/:slug` (public) → stored in `localStorage.sp_branding` → `applyBrandingCSS()` sets CSS variables
- **ES modules** — `import`/`export` throughout (no bundler, served as-is)

### Agent Portal specific

- **Login flow:** Basic Auth → JWT with `session_id` → stored in `localStorage.agent_token`
- **Session validation:** Every JWT check compares `decoded.session_id` against DB `session_token`
- **Session conflict:** 409 response with `SESSION_ACTIVE` error + `device` info
- **Deconnexion flow:** Agent submits request → admin approves → next login resets
- **PIN fallback:** Agent can use site PIN for kiosk exit (PIN validated via `ensureSitePopulatedWithPin`)

---

## 9. Key Gotchas & Non-Obvious Issues

### Merge conflicts in source files _(resolved)_

`server/app.js` (lines 86-91) and `client/public/sw.js` (lines 2-6) previously had unresolved `<<<<<<< HEAD / ======= / >>>>>>>` merge conflict markers. These have been resolved. The CSP now includes `img-src: tile.openstreetmap.org` for OSM tiles and `media-src: data:` for notification sounds. SW cache version is `smartpointage-v10`.

### CSP caching issue (SW stale)

The Service Worker caches the CSP headers at install time. When the CSP is updated (e.g., adding `tile.openstreetmap.org` to `img-src`), the old CSP is served from the SW cache until the cache version is bumped. Always bump `CACHE_VERSION` in `sw.js` when modifying CSP directives.

### Geofencing interactive map

The kiosk deployment modal (`client/public/src/pages/sites.js:415-665`) now includes a full interactive map using OSM tiles (3×3 mosaic, no iframe). Features: red marker for selected position, blue marker for real GPS position, click-to-position, manual lat/lng input fields, and a "Retirer le geofencing" option. Coordinate parser supports decimal, comma-separated, DMS, and concatenated formats.

### Session token fix (kiosk deconnexion)

A critical fix was applied: the kiosk PIN logout (deconnexion) was not clearing `session_token` on the server side, causing `SESSION_ACTIVE` errors on reconnection. Now `agent.logout()` properly nullifies `session_token` on PIN-based exit.

### `instance_slug` inheritance

Every model (Agent, Pointage, Conge) has a `pre("save")` hook that looks up the associated Site to inherit `instance_slug`. If the Site lookup fails (suppressed), the slug stays as default `"pamecas"`. This means stale data can leak across tenants if a Site document is deleted without updating related records.

### God mode is a console-only easter egg

`superadmin()` function is available in browser console. It calls `POST /api/auth/godmode` with the password from `.env` and returns a 24h JWT. Use for demos, not production.

### Kiosk PIN mismatch debugging

The `debug-pin-mismatch` endpoint (`GET /api/sites/debug-pin-mismatch/:matricule`) exists because agents can be attached to an inactive Site document (duplicate) that doesn't appear in the admin UI. The admin regenerates the PIN on the visible active site, but the agent's `site_id` points to the inactive one. Always check via this endpoint.

### No test suite

Jest and supertest are in `devDependencies` but there are no test files. `npm test` returns nothing useful.

### File encoding

Many files are UTF-8 with BOM (the `﻿` character at line 1). Some comments have encoding artifacts (e.g., `sw.js` lines with garbled French characters). Be careful when editing these files — preserve the BOM if present.

### Email reports

`server/services/emailReports.js` uses Brevo (`@getbrevo/brevo`) with SendGrid as fallback. The cron generates monthly Excel reports. Requires `BREVO_API_KEY` or `SENDGRID_API_KEY` in env.

### WebAuthn / Passkey

`server/routes/passkey.js` uses `@simplewebauthn/server`. Challenges are stored in-memory (Map with 5min TTL). `RP_ID` defaults to `smartpointage.digitalesf.com` — must be changed for local dev. `authenticatorAttachment: "platform"` forces on-device biometrics only (no USB keys).

### Seed passwords

Agent portal passwords are the **last 4 digits of the matricule** (e.g., `SMP-0001` → password `0001`). See `server/seed.js` line ~991.

### Token storage overlap

The admin SPA stores token as `pamecas_token`, the kiosk uses `kiosque_mode`/`kiosk_token`, and the agent portal uses `agent_token`. These are separate localStorage keys. The sync manager's `Authorization` header tries all three fallbacks.

---

## 10. Data Model Relationships

```
Tenant (1) ──< Site (N) ──< Agent (N)
                             ├──< Pointage (N)  (per agent per day per site)
                             ├──< Conge (N)
                             └──< Device (N)    (WebAuthn passkeys)
Site ──< User (N)            (admin users, role-based)
```

Each `Pointage` has a unique compound index: `{ agent_id, site_id, date }` — one record per day per agent per site.

---

## 11. Environment Variables

| Variable | Default | Required |
|----------|---------|----------|
| `PORT` | `3000` | No |
| `MONGODB_URI` | `mongodb://localhost:27017/gds_pointage` | Yes |
| `JWT_SECRET` | `gds-secret-change-in-production` | Yes |
| `JWT_EXPIRES_IN` | `8h` | No |
| `CLIENT_URL` | `http://localhost:3000` | No |
| `GOD_MODE_PASSWORD` | — | No (for dev) |
| `SUPERADMIN_TOKEN` | — | No (for dev) |
| `WEBAUTHN_RP_ID` | `smartpointage.digitalesf.com` | No |
| `WEBAUTHN_ORIGIN` | `https://smartpointage.digitalesf.com` | No |
| `BREVO_API_KEY` | — | For email reports |
| `SENDGRID_API_KEY` | — | Fallback for email |
| `SYNC_ENABLED` | `false` | No |
| `SYNC_INTERVAL` | `300000` | No |

---

## 12. Useful Documentation Files

| File | Contents |
|------|----------|
| `USERS.md` | All demo credentials by tenant |
| `DEMO_GUIDE.md` | Anti-fraud specs, test scripts, PIN kiosk spec, capture photo spec |
| `SMP_ANALYSIS.md` | Full architecture audit, component list, known issues |
| `PROMPT_FIXES_3.md` | Offline QR fix, agent filters, encoding fixes |
| `server/README-GMV.md` | GMV-specific terminology and accounts |
| `landing/README.md` | Landing page structure and deployment |