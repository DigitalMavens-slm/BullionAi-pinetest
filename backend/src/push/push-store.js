/*
 * Push Store — persists Expo push tokens + per-script notification preferences.
 * Supports Postgres (DATABASE_URL) or JSON fallback (data/push-*.json).
 */

const fs = require("fs");
const path = require("path");

const TOKENS_FILE = path.resolve(process.cwd(), "data", "push-tokens.json");
const PREFS_FILE = path.resolve(process.cwd(), "data", "push-preferences.json");

const pgEnabled = () => Boolean(process.env.DATABASE_URL);

function getPool() {
  if (!pgEnabled()) return null;
  const { Pool } = require("pg");
  // reuse pool from db.js if available? create isolated pool
  if (global.__pushPool) return global.__pushPool;
  global.__pushPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL !== "false" ? { rejectUnauthorized: false } : false,
    max: 5,
    idleTimeoutMillis: 30000,
  });
  global.__pushPool.on("error", (err) => console.error("[push-store] pool error:", err?.message || err));
  return global.__pushPool;
}

async function init() {
  if (!pgEnabled()) return { engine: "json" };
  const p = getPool();
  await p.query(`
    CREATE TABLE IF NOT EXISTS user_push_tokens (
      expo_token TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      platform TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await p.query(`CREATE INDEX IF NOT EXISTS idx_push_tokens_email ON user_push_tokens(email)`);
  await p.query(`
    CREATE TABLE IF NOT EXISTS user_push_preferences (
      email TEXT PRIMARY KEY,
      enabled BOOLEAN NOT NULL DEFAULT TRUE,
      scripts JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  return { engine: "postgres" };
}

// ---- JSON fallback helpers ----
function loadTokensJson() {
  try {
    const parsed = JSON.parse(fs.readFileSync(TOKENS_FILE, "utf8"));
    if (Array.isArray(parsed)) return parsed;
    if (Array.isArray(parsed.tokens)) return parsed.tokens;
  } catch {}
  return [];
}
function saveTokensJson(rows) {
  fs.mkdirSync(path.dirname(TOKENS_FILE), { recursive: true });
  fs.writeFileSync(TOKENS_FILE, JSON.stringify(rows, null, 2), "utf8");
}
function loadPrefsJson() {
  try {
    const parsed = JSON.parse(fs.readFileSync(PREFS_FILE, "utf8"));
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
  } catch {}
  return {};
}
function savePrefsJson(map) {
  fs.mkdirSync(path.dirname(PREFS_FILE), { recursive: true });
  fs.writeFileSync(PREFS_FILE, JSON.stringify(map, null, 2), "utf8");
}

// ---- Token API ----
async function registerToken(email, expoToken, platform) {
  const normEmail = String(email || "").trim().toLowerCase();
  const token = String(expoToken || "").trim();
  if (!normEmail || !token) throw new Error("email and expoToken required");
  if (!token.startsWith("ExponentPushToken[")) throw new Error("Invalid Expo push token");
  if (!pgEnabled()) {
    const rows = loadTokensJson();
    const existing = rows.find((r) => r.expo_token === token);
    if (existing) {
      existing.email = normEmail;
      existing.platform = platform || existing.platform || null;
      existing.updated_at = new Date().toISOString();
    } else {
      rows.push({ expo_token: token, email: normEmail, platform: platform || null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
    }
    saveTokensJson(rows);
    return { email: normEmail, expo_token: token };
  }
  await init();
  const p = getPool();
  await p.query(
    `INSERT INTO user_push_tokens (expo_token, email, platform, updated_at)
     VALUES ($1,$2,$3, now())
     ON CONFLICT (expo_token) DO UPDATE SET email=EXCLUDED.email, platform=EXCLUDED.platform, updated_at=now()`,
    [token, normEmail, platform || null]
  );
  return { email: normEmail, expo_token: token };
}

async function unregisterToken(email, expoToken) {
  const normEmail = String(email || "").trim().toLowerCase();
  const token = String(expoToken || "").trim();
  if (!pgEnabled()) {
    let rows = loadTokensJson();
    const before = rows.length;
    if (token) rows = rows.filter((r) => r.expo_token !== token);
    else if (normEmail) rows = rows.filter((r) => r.email !== normEmail);
    saveTokensJson(rows);
    return { removed: before - rows.length };
  }
  await init();
  const p = getPool();
  let res;
  if (token) res = await p.query(`DELETE FROM user_push_tokens WHERE expo_token=$1 AND email=$2`, [token, normEmail]);
  else res = await p.query(`DELETE FROM user_push_tokens WHERE email=$1`, [normEmail]);
  return { removed: res.rowCount || 0 };
}

async function listTokensForEmail(email) {
  const normEmail = String(email || "").trim().toLowerCase();
  if (!pgEnabled()) {
    return loadTokensJson().filter((r) => r.email === normEmail);
  }
  await init();
  const p = getPool();
  const r = await p.query(`SELECT expo_token, email, platform FROM user_push_tokens WHERE email=$1`, [normEmail]);
  return r.rows.map((row) => ({ expo_token: row.expo_token, email: row.email, platform: row.platform }));
}

async function listAllTokens() {
  if (!pgEnabled()) return loadTokensJson();
  await init();
  const p = getPool();
  const r = await p.query(`SELECT expo_token, email, platform FROM user_push_tokens`);
  return r.rows.map((row) => ({ expo_token: row.expo_token, email: row.email, platform: row.platform }));
}

// ---- Preferences API ----
async function getPreferences(email) {
  const normEmail = String(email || "").trim().toLowerCase();
  if (!pgEnabled()) {
    const map = loadPrefsJson();
    const entry = map[normEmail];
    if (!entry) return { email: normEmail, enabled: true, scripts: {} };
    return { email: normEmail, enabled: entry.enabled !== false, scripts: entry.scripts || {} };
  }
  await init();
  const p = getPool();
  const r = await p.query(`SELECT enabled, scripts FROM user_push_preferences WHERE email=$1`, [normEmail]);
  if (!r.rows[0]) return { email: normEmail, enabled: true, scripts: {} };
  return { email: normEmail, enabled: r.rows[0].enabled !== false, scripts: r.rows[0].scripts || {} };
}

async function setPreferences(email, { enabled, scripts }) {
  const normEmail = String(email || "").trim().toLowerCase();
  const normEnabled = enabled !== false;
  const normScripts = scripts && typeof scripts === "object" ? scripts : {};
  // sanitize script keys: "EXCH:TOKEN" -> boolean
  const sanitized = {};
  for (const [k, v] of Object.entries(normScripts)) {
    const key = String(k).trim().toUpperCase();
    if (!key.includes(":")) continue;
    sanitized[key] = Boolean(v);
  }
  if (!pgEnabled()) {
    const map = loadPrefsJson();
    map[normEmail] = { enabled: normEnabled, scripts: sanitized, updated_at: new Date().toISOString() };
    savePrefsJson(map);
    return { email: normEmail, enabled: normEnabled, scripts: sanitized };
  }
  await init();
  const p = getPool();
  await p.query(
    `INSERT INTO user_push_preferences (email, enabled, scripts, updated_at)
     VALUES ($1,$2,$3, now())
     ON CONFLICT (email) DO UPDATE SET enabled=EXCLUDED.enabled, scripts=EXCLUDED.scripts, updated_at=now()`,
    [normEmail, normEnabled, JSON.stringify(sanitized)]
  );
  return { email: normEmail, enabled: normEnabled, scripts: sanitized };
}

module.exports = {
  init,
  registerToken,
  unregisterToken,
  listTokensForEmail,
  listAllTokens,
  getPreferences,
  setPreferences,
};
