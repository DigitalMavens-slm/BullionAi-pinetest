# BullionAI — Go Live (bullionai.in)

BullionAI has two parts:
1. **Frontend (static SPA)** → host anywhere static files work (Hostinger shared "Business plan" / GitHub Pages / Netlify / Cloudflare).
2. **Backend (always-on Node server)** → MUST run 24/7. This is the part that cannot live on shared hosting.

```
Browser ── https://bullionai.in ──> Hostinger (static SPA)
                                      └──> /api/*  ──> Backend on an always-on Node host
                                                            └──> Shoonya WebSocket + TPSeries
```

The repo ships deploy configs: `Dockerfile`, `render.yaml`, `railway.json`, `Procfile`, `ecosystem.config.js` (PM2), `.env.example`.

---

## Part A — Get an always-on backend host (choose ONE)

### Option A1 — Render (simplest, free tier, HTTPS built-in)
1. Push the repo to GitHub.
2. In Render: **New → Blueprint** → connect the repo. It auto-reads `render.yaml`.
3. Set these Environment Variables (sync:false — fill manually):
   - `SHOONYA_CLIENT_ID = FN215549_U`
   - `SHOONYA_SECRET_CODE = <your secret>`
   - `SHOONYA_REDIRECT_URL = https://bullionai.in/`
   - `SHOONYA_EXCHANGE = MCX`
   - (optional) `SHOONYA_WHITELISTED_IP = <render egress ip>`
4. Deploy. You'll get a URL like `https://bullionai-api.onrender.com`. Note it.

### Option A2 — Railway (`railway.json` included)
1. Push to GitHub; in Railway: **New Project → Deploy from GitHub repo**.
2. Add the env vars (same set as above).
3. Railway gives you a public URL + HTTPS.

### Option A3 — VPS + PM2 (fully self-hosted)
```
npm i -g pm2
pm2 start ecosystem.config.js
pm2 save && pm2 startup
```
Then put Nginx in front (with SSL) proxy_pass to `http://127.0.0.1:8787`.

---

## Part B — Whitelist the backend IP in Shoonya
Log into the Shoonya API portal → **Allowed IPs** → add the backend host's **egress IP**.
- Get it from `GET /api/shoonya/config` (shows `requestIp` / `egressIp`).
- If the host egress IP isn't stable, set `SHOONYA_WHITELISTED_IP=<ip>` in `.env`.

---

## Part C — Point the redirect URL + authenticate on the backend
The redirect URL **must match the exact HTTPS URL you browse to when logging in.**

1. Open the login URL:
   `https://<backend-url>/api/shoonya/login`  (or the Shoonya login link)
2. Log in to Shoonya. Copy the resulting redirect URL (contains `?code=...`).
3. POST it to the backend (also works via the login page):
   ```
   curl -X POST https://<backend-url>/api/shoonya/login \
        -H "Content-Type: application/json" \
        -d '{"redirectUrl":"https://bullionai.in/?code=xxxx"}'
   ```
   Code is single-use + expires in ~30s — paste immediately.
4. Confirm: `GET /api/state` returns a signal (e.g. `signal: SELL`).

### Re-authentication cadence
- **You do NOT log in daily.** Shoonya tokens are persisted to the **durable Postgres store** (`shoonya_sessions` table) and auto-restored on boot (`restoreSession()`), so live prices keep working across Render restarts/redeploys. The local file (`data/shoonya-session.json`) is only a zero-config fallback.
- Shoonya tokens are issued per-trading-day and capped at ~12h (`restoreSession()` refuses sessions older than 12h). So re-login is **once per trading day**, not on every restart/deploy.
- **If a restored token is rejected by Shoonya** it is invalidated and the system enters `SHOONYA_LOGIN_REQUIRED` — the HTTP API stays healthy, and the dashboard shows a clear "Login Required" state with the `/api/shoonya/login` action.

### Session lifecycle states
The API exposes a machine-readable state at `GET /api/session/status`:
```json
{ "ok": true, "server": "ready", "authenticated": true, "feedConnected": true,
  "status": "connected", "lastTickAt": 1788..., "uid": "FN215549" }
```
- `server: "ready"` — HTTP is always up, independent of Shoonya.
- `status: "connected"` → authenticated + WebSocket feed live.
- `status: "disconnected"` → authenticated but feed dropped (auto-reconnect with backoff).
- `status: "login_required"` → needs a fresh manual login via `/api/shoonya/login`.
- **You still must paste a code once a day** — Shoonya's OAuth has no password/refresh login, so a cron cannot mint a code. It can only *detect* expiry and alert you.

### Daily session-check cron (auto-alert)
`render.yaml` defines `bullionai-session-check` (`type: cron`, 03:20 UTC = 08:50 IST, Mon–Fri) that hits `GET /api/session/status`:
- Session valid + feed connected → logs `SESSION_OK` (no action).
- Session missing/expired/feed down → alerts via **SendGrid** (`SENDGRID_*`) or a **webhook** (`ALERT_WEBHOOK_URL`) with a one-click `/api/shoonya/login` link.

Set the cron secrets in Render (Dashboard → cron service → Environment):
```
BACKEND_URL=https://bullionai-pinetest.onrender.com
SENDGRID_API_KEY=... (sync)
SENDGRID_FROM=noreply@bullionai.digitalmavens.in
SENDGRID_TO=sheriff.sheikh12@gmail.com
# or: ALERT_WEBHOOK_URL / ALERT_WEBHOOK_TOKEN
```

---

## Part D — Deploy the frontend to Hostinger (static)
1. Build the SPA with the backend URL baked in:
   ```
   VITE_BULLIONAI_API_URL=https://<backend-url> npm run build
   ```
   (Run from `frontend/`; output goes to `frontend/dist/`.)
2. Push `frontend/dist/` to Hostinger's `public_html` via GitHub deploy (Hostinger's GitHub integration) — point it at the repo (or a `dist` branch).
3. Ensure SSL on `bullionai.in` (Hostinger gives free SSL). Verify it redirects to HTTPS.

> Note: the API base defaults to same-origin `""` when `VITE_BULLIONAI_API_URL` is unset. For the split host (frontend on Hostinger, backend on Render), you MUST set `VITE_BULLIONAI_API_URL` to the backend URL as above. CORS is already `*` on the backend.

---

## Part E — Point DNS + go live
1. In your registrar, point `bullionai.in` A/AAAA to Hostinger.
2. Confirm `https://bullionai.in` loads the SPA.
3. Smoke-test via the browser:
   - Select NSE → SBIN / TCS → chart renders (Yahoo fallback), signal appears.
   - Select MCX → GOLD → chart + signal.
   - `https://<backend-url>/health` → `{"ok":true,...}`.

---

## Critical notes
- **Backend must stay running.** If it stops, live data stops. Use Render/Railway auto-restart, or PM2 on a VPS.
- **`SHOONYA_REDIRECT_URL` = `https://bullionai.in/` exactly** (with trailing slash). If you log in via the backend URL, that must be `https://<backend-url>/` — pick ONE and keep it consistent + whitelisted.
- **Never commit `.env`** (it's gitignored). Use `.env.example` as a template.
- Data accumulates in `data/*.json` on the backend host. If you redeploy, don't wipe `data/` or you lose cached candles.

---

## Files added for deployment
- `Dockerfile` + `.dockerignore`
- `render.yaml` (Render blueprint)
- `railway.json` (Railway)
- `Procfile` (Render/Railway fallback)
- `ecosystem.config.js` (PM2)
- `.env.example` (template, uses `bullionai.in`)

---

## Database & Admin (users / subscriptions)

Users, auth and subscriptions are backed by **PostgreSQL** when `DATABASE_URL` is set,
otherwise a JSON file (`data/bullionai-users.json`). The schema is auto-created on boot.

### 1. Add PostgreSQL (recommended for scale)
On Render: **New → PostgreSQL** (or Railway → Postgres / Neon / Supabase). Copy the
**Internal Connection String** (or external URL) into the backend's env:

```
DATABASE_URL=postgres://user:password@host:5432/bullionai?sslmode=require
DATABASE_SSL=true
```

Postgres tables are created automatically:
- `users(email, name, mobile, segments jsonb, is_admin, plan, trial_ends_at, access_until, salt, password_hash, created_at)`
- `subscriptions(id, email, plan, amount, period, started_at, ends_at)`
- `shoonya_sessions(id, access_token, uid, actid, saved_at, updated_at)` — persists the Shoonya session across restarts. Only a non-password session token + uid/actid are stored; never passwords/OTP/TOTP.

### 2. Set an admin (first registered user is auto-admin; or force via env)
```
ADMIN_EMAILS=you@example.com
```
Or seed/update an admin directly after deploy (works with Postgres or JSON):
```
node scripts/seed-admin.js you@example.com YourPassword "Name" MCX,NSE,BSE
```

### 3. Manage users
- **UI:** Log in → Dashboard → **Admin** button (see `?admin=1` / `#admin`).
- **API** (header `X-Admin-Key: <key>` from `data/bullionai-admin-key.txt`, or an admin Bearer token):
  - `GET /api/admin/users` — list
  - `POST /api/admin/users` — create `{email,name,password,segments,isAdmin}`
  - `POST /api/admin/users/<email>/renew` — `{days}`
  - `POST /api/admin/users/<email>/reset-password`
  - `PUT /api/admin/users/<email>` — update name/segments/plan/accessUntil/isAdmin
  - `DELETE /api/admin/users/<email>`
  - `POST /api/admin/clear-users` — destructively delete all users
  - `POST /api/admin/clear-cache` — clear in-memory strategy/segment caches

### 4. Back up the DB
Postgres is the durable store — enable automated backups on your DB provider.
JSON files (candles, session) also live in `data/` on the host; back those up too.
