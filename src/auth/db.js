/*
 * =========================================================
 * DATABASE LAYER — gateway that backs users/auth/subscriptions
 * with PostgreSQL when DATABASE_URL is set, or a flat JSON file
 * otherwise (zero-config local fallback).
 *
 * Postgres schema (auto-created):
 *   users(email PK, name, mobile, segments jsonb, is_admin bool,
 *         plan text, trial_ends_at, access_until, salt, password_hash, created_at)
 *   subscriptions(id serial, email, plan, amount, period, started_at, ends_at)
 * =========================================================
 */

const fs = require("fs");
const path = require("path");

const pgEnabled = () => Boolean(process.env.DATABASE_URL);

// ---- JSON fallback store ----
const USERS_FILE = path.resolve(process.cwd(), "data", "bullionai-users.json");

function loadJson() {
    try {
        const parsed = JSON.parse(fs.readFileSync(USERS_FILE, "utf8"));
        if (Array.isArray(parsed.users)) return parsed;
    } catch {}
    return { users: [] };
}
function saveJson(db) {
    fs.mkdirSync(path.dirname(USERS_FILE), { recursive: true });
    fs.writeFileSync(USERS_FILE, JSON.stringify(db, null, 2), "utf8");
}
function jsonRowToUser(u) {
    if (!u) return null;
    return {
        email: u.email,
        name: u.name,
        mobile: u.mobile || "",
        segments: Array.isArray(u.segments) ? u.segments : [],
        isAdmin: Boolean(u.isAdmin),
        plan: u.plan || "trial",
        trialEndsAt: u.trialEndsAt,
        accessUntil: u.accessUntil ?? null,
        salt: u.salt,
        passwordHash: u.passwordHash,
        createdAt: u.createdAt,
    };
}

let pool = null;
let ready = false;
let initPromise = null;

function getPool() {
    if (!pgEnabled()) return null;
    if (pool) return pool;
    const { Pool } = require("pg");
    pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.DATABASE_SSL !== "false" ? { rejectUnauthorized: false } : false,
        max: 10,
        idleTimeoutMillis: 30000,
    });
    pool.on("error", err => console.error("[db] pool error:", err?.message || err));
    return pool;
}

async function init() {
    if (!pgEnabled()) return { engine: "json" };
    if (ready) return { engine: "postgres" };
    if (initPromise) return initPromise;
    initPromise = (async () => {
        const p = getPool();
        await p.query(`
            CREATE TABLE IF NOT EXISTS users (
                email TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                mobile TEXT,
                segments JSONB NOT NULL DEFAULT '[]'::jsonb,
                is_admin BOOLEAN NOT NULL DEFAULT FALSE,
                plan TEXT NOT NULL DEFAULT 'trial',
                trial_ends_at TIMESTAMPTZ,
                access_until TIMESTAMPTZ,
                salt TEXT NOT NULL DEFAULT '',
                password_hash TEXT NOT NULL DEFAULT '',
                created_at TIMESTAMPTZ NOT NULL DEFAULT now()
            )
        `);
        await p.query(`
            CREATE TABLE IF NOT EXISTS subscriptions (
                id SERIAL PRIMARY KEY,
                email TEXT NOT NULL REFERENCES users(email) ON DELETE CASCADE,
                plan TEXT NOT NULL,
                amount NUMERIC(12,2) NOT NULL DEFAULT 0,
                period TEXT,
                started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                ends_at TIMESTAMPTZ,
                created_at TIMESTAMPTZ NOT NULL DEFAULT now()
            )
        `);
        await p.query(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`);
        await p.query(`CREATE INDEX IF NOT EXISTS idx_subscriptions_email ON subscriptions(email)`);
        // Shoonya session token — persists the (non-password) access session
        // across Render restarts so a valid login survives re-deploys. Only a
        // session identifier + uid/actid are stored; NEVER passwords/OTPs/TOTP.
        await p.query(`
            CREATE TABLE IF NOT EXISTS shoonya_sessions (
                id INTEGER PRIMARY KEY DEFAULT 1,
                access_token TEXT,
                uid TEXT,
                actid TEXT,
                saved_at BIGINT,
                updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
            )
        `);
        ready = true;
        console.log("[db] PostgreSQL schema ready");
        return { engine: "postgres" };
    })();
    return initPromise;
}

function rowToUser(row) {
    if (!row) return null;
    return {
        email: row.email,
        name: row.name,
        mobile: row.mobile || "",
        segments: Array.isArray(row.segments) ? row.segments : (row.segments ? row.segments : []),
        isAdmin: Boolean(row.is_admin),
        plan: row.plan || "trial",
        trialEndsAt: row.trial_ends_at ? new Date(row.trial_ends_at).getTime() : undefined,
        accessUntil: row.access_until ? new Date(row.access_until).getTime() : null,
        salt: row.salt,
        passwordHash: row.password_hash,
        createdAt: row.created_at ? new Date(row.created_at).toISOString() : undefined,
    };
}

async function createUser(u) {
    if (!pgEnabled()) {
        const db = loadJson();
        db.users.push(u);
        saveJson(db);
        return rowToUser(jsonRowToUser(u)) || u;
    }
    await init();
    const p = getPool();
    await p.query(
        `INSERT INTO users (email, name, mobile, segments, is_admin, plan, trial_ends_at, access_until, salt, password_hash)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         ON CONFLICT (email) DO UPDATE SET
           name=EXCLUDED.name, mobile=EXCLUDED.mobile, segments=EXCLUDED.segments,
           is_admin=EXCLUDED.is_admin, plan=EXCLUDED.plan,
           trial_ends_at=EXCLUDED.trial_ends_at, access_until=EXCLUDED.access_until,
           salt=EXCLUDED.salt, password_hash=EXCLUDED.password_hash`,
        [u.email, u.name, u.mobile || "", JSON.stringify(u.segments || []), Boolean(u.isAdmin),
         u.plan || "trial", u.trialEndsAt ? new Date(u.trialEndsAt) : null,
         u.accessUntil ? new Date(u.accessUntil) : null, u.salt, u.passwordHash]
    );
    return rowToUser((await p.query(`SELECT * FROM users WHERE email=$1`, [u.email])).rows[0]);
}

async function findUserByEmail(email) {
    const norm = String(email || "").trim().toLowerCase();
    if (!pgEnabled()) {
        const db = loadJson();
        return jsonRowToUser(db.users.find(x => x.email === norm) || null);
    }
    await init();
    const p = getPool();
    const r = await p.query(`SELECT * FROM users WHERE email=$1`, [norm]);
    return rowToUser(r.rows[0]);
}

async function listUsers() {
    if (!pgEnabled()) {
        return loadJson().users.map(jsonRowToUser).filter(Boolean);
    }
    await init();
    const p = getPool();
    const r = await p.query(`SELECT * FROM users ORDER BY created_at ASC`);
    return r.rows.map(rowToUser);
}

async function updateUser(email, updates) {
    if (!pgEnabled()) {
        const db = loadJson();
        const i = db.users.findIndex(x => x.email === String(email).trim().toLowerCase());
        if (i === -1) throw new Error("User not found.");
        db.users[i] = { ...db.users[i], ...updates, email: db.users[i].email };
        saveJson(db);
        return jsonRowToUser(db.users[i]);
    }
    await init();
    const p = getPool();
    const existing = await findUserByEmail(email);
    if (!existing) throw new Error("User not found.");
    const merged = { ...existing, ...updates, email: existing.email };
    await p.query(
        `UPDATE users SET name=$1, mobile=$2, segments=$3, is_admin=$4, plan=$5,
           trial_ends_at=$6, access_until=$7, salt=$8, password_hash=$9 WHERE email=$10`,
        [merged.name, merged.mobile || "", JSON.stringify(merged.segments || []), Boolean(merged.isAdmin),
         merged.plan || "trial", merged.trialEndsAt ? new Date(merged.trialEndsAt) : null,
         merged.accessUntil ? new Date(merged.accessUntil) : null,
         merged.salt || "", merged.passwordHash || "", email]
    );
    return findUserByEmail(email);
}

async function deleteUser(email) {
    const norm = String(email || "").trim().toLowerCase();
    if (!pgEnabled()) {
        const db = loadJson();
        const i = db.users.findIndex(x => x.email === norm);
        if (i === -1) throw new Error("User not found.");
        db.users.splice(i, 1);
        saveJson(db);
        return true;
    }
    await init();
    const p = getPool();
    const r = await p.query(`DELETE FROM users WHERE email=$1`, [norm]);
    if (r.rowCount === 0) throw new Error("User not found.");
    return true;
}

async function clearAllUsers() {
    if (!pgEnabled()) {
        saveJson({ users: [] });
        return true;
    }
    await init();
    const p = getPool();
    await p.query(`DELETE FROM users`);
    return true;
}

async function recordSubscription(email, { plan, amount, period, endsAt }) {
    if (!pgEnabled()) {
        const db = loadJson();
        const sub = { email, plan, amount: amount || 0, period: period || null, startedAt: new Date().toISOString(), endsAt: endsAt ? new Date(endsAt).toISOString() : null };
        db.subscriptions = db.subscriptions || [];
        db.subscriptions.push(sub);
        saveJson(db);
        return;
    }
    await init();
    const p = getPool();
    await p.query(
        `INSERT INTO subscriptions (email, plan, amount, period, ends_at) VALUES ($1,$2,$3,$4,$5)`,
        [email, plan, amount || 0, period || null, endsAt ? new Date(endsAt) : null]
    );
}

// =========================================================
// SHOONYA SESSION PERSISTENCE
//
// Stores the Shoonya access session (a non-password session token) so a
// valid login survives Render restarts/redeploys. Persists only the session
// identifier + uid/actid — NEVER passwords, OTPs or TOTP secrets.
//
// JSON fallback (local, no DATABASE_URL): data/shoonya-session.json
// Postgres (production): shoonya_sessions single-row table.
// =========================================================

const SHOONYA_SESSION_FILE = path.resolve(
    process.cwd(),
    "data",
    "shoonya-session.json"
);

async function saveShoonyaSession({ accessToken, uid, actid, savedAt }) {
    if (!accessToken || !uid) return false;

    if (!pgEnabled()) {
        try {
            fs.mkdirSync(path.dirname(SHOONYA_SESSION_FILE), { recursive: true });
            fs.writeFileSync(
                SHOONYA_SESSION_FILE,
                JSON.stringify(
                    { accessToken, uid, actid: actid || uid, savedAt: savedAt || Date.now() },
                    null,
                    2
                ),
                "utf8"
            );
            return true;
        } catch {
            return false;
        }
    }

    try {
        await init();
        await getPool().query(
            `INSERT INTO shoonya_sessions (id, access_token, uid, actid, saved_at, updated_at)
             VALUES (1, $1, $2, $3, $4, now())
             ON CONFLICT (id) DO UPDATE SET
               access_token=EXCLUDED.access_token,
               uid=EXCLUDED.uid,
               actid=EXCLUDED.actid,
               saved_at=EXCLUDED.saved_at,
               updated_at=now()`,
            [accessToken, uid, actid || uid, savedAt || Date.now()]
        );
        return true;
    } catch (error) {
        console.error("[db] saveShoonyaSession failed:", error?.message || error);
        return false;
    }
}

async function getShoonyaSession() {
    if (!pgEnabled()) {
        try {
            const parsed = JSON.parse(fs.readFileSync(SHOONYA_SESSION_FILE, "utf8"));
            if (parsed?.accessToken && parsed?.uid) return parsed;
        } catch {}
        return null;
    }

    try {
        await init();
        const r = await getPool().query(
            `SELECT access_token, uid, actid, saved_at FROM shoonya_sessions WHERE id=1`
        );
        const row = r.rows[0];
        if (!row?.access_token || !row?.uid) return null;
        return {
            accessToken: row.access_token,
            uid: row.uid,
            actid: row.actid || row.uid,
            savedAt: Number(row.saved_at) || null,
        };
    } catch (error) {
        console.error("[db] getShoonyaSession failed:", error?.message || error);
        return null;
    }
}

async function clearShoonyaSession() {
    if (!pgEnabled()) {
        try {
            fs.unlinkSync(SHOONYA_SESSION_FILE);
        } catch {}
        return true;
    }
    try {
        await init();
        await getPool().query(`DELETE FROM shoonya_sessions WHERE id=1`);
    } catch (error) {
        console.error("[db] clearShoonyaSession failed:", error?.message || error);
    }
    return true;
}

module.exports = {
    pgEnabled,
    init,
    getPool,
    createUser,
    findUserByEmail,
    listUsers,
    updateUser,
    deleteUser,
    clearAllUsers,
    recordSubscription,
    saveShoonyaSession,
    getShoonyaSession,
    clearShoonyaSession,
    rowToUser,
    jsonRowToUser,
};