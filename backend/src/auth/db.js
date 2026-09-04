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
        // Performance ledger — durable record of REAL strategy-generated trades.
        // One row per trade (unique by trade_uid); updated throughout the trade
        // lifecycle (entry -> TGT1 -> modified SL -> TGT2/SL -> closed).
        // Only trade outcomes are stored — never credentials.
        await p.query(`
            CREATE TABLE IF NOT EXISTS perf_trades (
                id BIGSERIAL PRIMARY KEY,
                trade_uid TEXT UNIQUE NOT NULL,
                exchange TEXT NOT NULL,
                symbol TEXT NOT NULL,
                token TEXT,
                timeframe TEXT NOT NULL,
                signal TEXT NOT NULL,
                entry_price NUMERIC,
                entry_time BIGINT,
                initial_sl NUMERIC,
                active_sl NUMERIC,
                target1 NUMERIC,
                target2 NUMERIC,
                target1_status TEXT,
                target1_hit_time BIGINT,
                target1_profit NUMERIC,
                target2_status TEXT,
                target2_hit_time BIGINT,
                target2_profit NUMERIC,
                exit_price NUMERIC,
                exit_time BIGINT,
                exit_reason TEXT,
                status TEXT NOT NULL DEFAULT 'OPEN',
                result TEXT,
                result_points NUMERIC,
                current_pl NUMERIC,
                max_points NUMERIC,
                created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
            )
        `);
        await p.query(`CREATE INDEX IF NOT EXISTS idx_perf_trades_trade_uid ON perf_trades(trade_uid)`);
        await p.query(`CREATE INDEX IF NOT EXISTS idx_perf_trades_exchange ON perf_trades(exchange)`);
        await p.query(`CREATE INDEX IF NOT EXISTS idx_perf_trades_symbol ON perf_trades(symbol)`);
        await p.query(`CREATE INDEX IF NOT EXISTS idx_perf_trades_timeframe ON perf_trades(timeframe)`);
        await p.query(`CREATE INDEX IF NOT EXISTS idx_perf_trades_entry_time ON perf_trades(entry_time)`);
        await p.query(`CREATE INDEX IF NOT EXISTS idx_perf_trades_exit_time ON perf_trades(exit_time)`);
        await p.query(`CREATE INDEX IF NOT EXISTS idx_perf_trades_status ON perf_trades(status)`);
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

// =========================================================
// PERFORMANCE LEDGER — durable record of REAL strategy trades
//
// One row per trade (unique by trade_uid). Idempotent upserts so the same
// trade processed repeatedly (SSE reconnect / polling / restart / redeploy)
// never creates duplicate records. Only trade outcomes — never credentials.
//
// Postgres (production) when DATABASE_URL is set; JSON-file fallback for
// local/dev (data/perf-trades.json).
// =========================================================

const PERF_FILE = path.resolve(
    process.cwd(),
    "data",
    "perf-trades.json"
);

function loadPerfJson() {
    try {
        const parsed = JSON.parse(fs.readFileSync(PERF_FILE, "utf8"));
        if (Array.isArray(parsed)) return parsed;
    } catch {}
    return [];
}

function savePerfJson(rows) {
    fs.mkdirSync(path.dirname(PERF_FILE), { recursive: true });
    fs.writeFileSync(PERF_FILE, JSON.stringify(rows, null, 2), "utf8");
}

// Normalize a trade object (from Postgres or JSON) into a clean row.
function perfRow(r) {
    if (!r) return null;
    return {
        tradeUid: String(r.trade_uid || r.tradeUid || ""),
        exchange: String(r.exchange || ""),
        symbol: String(r.symbol || ""),
        token: r.token || null,
        timeframe: String(r.timeframe || ""),
        signal: String(r.signal || ""),
        entryPrice: numOrNull(r.entry_price ?? r.entryPrice),
        entryTime: numOrNull(r.entry_time ?? r.entryTime),
        initialSL: numOrNull(r.initial_sl ?? r.initialSL),
        activeSL: numOrNull(r.active_sl ?? r.activeSL),
        target1: numOrNull(r.target1),
        target2: numOrNull(r.target2),
        target1Status: r.target1_status ?? r.target1Status ?? null,
        target1HitTime: numOrNull(r.target1_hit_time ?? r.target1HitTime),
        target1Profit: numOrNull(r.target1_profit ?? r.target1Profit),
        target2Status: r.target2_status ?? r.target2Status ?? null,
        target2HitTime: numOrNull(r.target2_hit_time ?? r.target2HitTime),
        target2Profit: numOrNull(r.target2_profit ?? r.target2Profit),
        exitPrice: numOrNull(r.exit_price ?? r.exitPrice),
        exitTime: numOrNull(r.exit_time ?? r.exitTime),
        exitReason: r.exit_reason ?? r.exitReason ?? null,
        status: String(r.status || "OPEN"),
        result: r.result || null,
        resultPoints: numOrNull(r.result_points ?? r.resultPoints),
        currentPL: numOrNull(r.current_pl ?? r.currentPL),
        maxPoints: numOrNull(r.max_points ?? r.maxPoints),
        createdAt: r.created_at ?? r.createdAt ?? null,
        updatedAt: r.updated_at ?? r.updatedAt ?? null,
    };
}

function numOrNull(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
}

// Idempotent upsert keyed by trade_uid.
async function upsertPerfTrade(t) {
    if (!t || !t.tradeUid) return false;

    if (!pgEnabled()) {
        const rows = loadPerfJson();
        const i = rows.findIndex((x) => String(x.tradeUid) === String(t.tradeUid));
        const row = {
            trade_uid: t.tradeUid,
            exchange: t.exchange,
            symbol: t.symbol,
            token: t.token || null,
            timeframe: t.timeframe,
            signal: t.signal,
            entry_price: numOrNull(t.entryPrice),
            entry_time: numOrNull(t.entryTime),
            initial_sl: numOrNull(t.initialSL),
            active_sl: numOrNull(t.activeSL),
            target1: numOrNull(t.target1),
            target2: numOrNull(t.target2),
            target1_status: t.target1Status ?? null,
            target1_hit_time: numOrNull(t.target1HitTime),
            target1_profit: numOrNull(t.target1Profit),
            target2_status: t.target2Status ?? null,
            target2_hit_time: numOrNull(t.target2HitTime),
            target2_profit: numOrNull(t.target2Profit),
            exit_price: numOrNull(t.exitPrice),
            exit_time: numOrNull(t.exitTime),
            exit_reason: t.exitReason ?? null,
            status: t.status || "OPEN",
            result: t.result ?? null,
            result_points: numOrNull(t.resultPoints),
            current_pl: numOrNull(t.currentPL),
            max_points: numOrNull(t.maxPoints),
            updated_at: new Date().toISOString(),
        };
        if (i >= 0) rows[i] = { ...rows[i], ...row };
        else rows.push(row);
        savePerfJson(rows);
        return true;
    }

    try {
        await init();
        await getPool().query(
            `INSERT INTO perf_trades (
                trade_uid, exchange, symbol, token, timeframe, signal,
                entry_price, entry_time, initial_sl, active_sl, target1, target2,
                target1_status, target1_hit_time, target1_profit,
                target2_status, target2_hit_time, target2_profit,
                exit_price, exit_time, exit_reason, status, result, result_points,
                current_pl, max_points, updated_at
             ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26, now())
             ON CONFLICT (trade_uid) DO UPDATE SET
                exchange=EXCLUDED.exchange, symbol=EXCLUDED.symbol, token=EXCLUDED.token,
                timeframe=EXCLUDED.timeframe, signal=EXCLUDED.signal,
                entry_price=EXCLUDED.entry_price, entry_time=EXCLUDED.entry_time,
                initial_sl=EXCLUDED.initial_sl, active_sl=EXCLUDED.active_sl,
                target1=EXCLUDED.target1, target2=EXCLUDED.target2,
                target1_status=EXCLUDED.target1_status,
                target1_hit_time=EXCLUDED.target1_hit_time,
                target1_profit=EXCLUDED.target1_profit,
                target2_status=EXCLUDED.target2_status,
                target2_hit_time=EXCLUDED.target2_hit_time,
                target2_profit=EXCLUDED.target2_profit,
                exit_price=EXCLUDED.exit_price, exit_time=EXCLUDED.exit_time,
                exit_reason=EXCLUDED.exit_reason, status=EXCLUDED.status,
                result=EXCLUDED.result, result_points=EXCLUDED.result_points,
                current_pl=EXCLUDED.current_pl, max_points=EXCLUDED.max_points,
                updated_at=now()`,
            [
                String(t.tradeUid), t.exchange, t.symbol, t.token || null, t.timeframe, t.signal,
                numOrNull(t.entryPrice), numOrNull(t.entryTime), numOrNull(t.initialSL),
                numOrNull(t.activeSL), numOrNull(t.target1), numOrNull(t.target2),
                t.target1Status ?? null, numOrNull(t.target1HitTime), numOrNull(t.target1Profit),
                t.target2Status ?? null, numOrNull(t.target2HitTime), numOrNull(t.target2Profit),
                numOrNull(t.exitPrice), numOrNull(t.exitTime), t.exitReason ?? null,
                t.status || "OPEN", t.result ?? null, numOrNull(t.resultPoints),
                numOrNull(t.currentPL), numOrNull(t.maxPoints),
            ]
        );
        return true;
    } catch (error) {
        console.error("[db] upsertPerfTrade failed:", error?.message || error);
        return false;
    }
}

async function getPerfTrades({ exchange, symbol, timeframe, limit = 20, offset = 0 } = {}) {
    if (!pgEnabled()) {
        let rows = loadPerfJson();
        if (exchange) rows = rows.filter((r) => String(r.exchange).toUpperCase() === String(exchange).toUpperCase());
        if (symbol) rows = rows.filter((r) => String(r.symbol).toUpperCase() === String(symbol).toUpperCase());
        if (timeframe) rows = rows.filter((r) => String(r.timeframe) === String(timeframe));
        rows.sort((a, b) => (a.entry_time || 0) - (b.entry_time || 0));
        const total = rows.length;
        rows = rows.slice(offset, offset + limit).reverse().map(perfRow);
        return { rows, total };
    }

    try {
        await init();
        const where = [];
        const params = [];
        if (exchange) { params.push(exchange); where.push(`exchange = $${params.length}`); }
        if (symbol) { params.push(symbol); where.push(`symbol = $${params.length}`); }
        if (timeframe) { params.push(timeframe); where.push(`timeframe = $${params.length}`); }
        const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
        const p2 = [...params];
        const totalR = await getPool().query(`SELECT count(*)::int AS c FROM perf_trades ${whereSql}`, params);
        const total = totalR.rows[0]?.c ?? 0;
        params.push(limit, offset);
        const r = await getPool().query(
            `SELECT * FROM perf_trades ${whereSql} ORDER BY entry_time DESC NULLS LAST LIMIT $${params.length - 1} OFFSET $${params.length}`,
            params
        );
        return { rows: r.rows.map(perfRow), total };
    } catch (error) {
        console.error("[db] getPerfTrades failed:", error?.message || error);
        return { rows: [], total: 0 };
    }
}

async function getPerfTrade(tradeUid) {
    if (!tradeUid) return null;
    if (!pgEnabled()) {
        const r = loadPerfJson().find((x) => String(x.trade_uid ?? x.tradeUid) === String(tradeUid));
        return r ? perfRow(r) : null;
    }
    try {
        await init();
        const r = await getPool().query(`SELECT * FROM perf_trades WHERE trade_uid = $1`, [tradeUid]);
        return r.rows[0] ? perfRow(r.rows[0]) : null;
    } catch (error) {
        console.error("[db] getPerfTrade failed:", error?.message || error);
        return null;
    }
}

async function getPerfSummary({ exchange, timeframe } = {}) {
    const { rows } = await getPerfTrades({ exchange, timeframe, limit: 100000, offset: 0 });
    const closed = rows.filter((r) => r.status === "CLOSED");
    const open = rows.filter((r) => r.status === "OPEN");
    const wins = closed.filter((r) => (r.resultPoints ?? 0) > 0).length;
    const losses = closed.filter((r) => (r.resultPoints ?? 0) <= 0).length;
    const netPL = closed.reduce((s, r) => s + (r.resultPoints ?? 0), 0);
    const tgt1Profit = rows.reduce((s, r) => s + (r.target1Profit ?? 0), 0);
    const winRate = closed.length ? (wins / closed.length) * 100 : 0;

    let openPL = 0;
    let openMaxPoints = 0;
    for (const r of open) {
        openPL += r.currentPL ?? 0;
        openMaxPoints += r.maxPoints ?? 0;
    }

    return {
        market: exchange || "MCX",
        timeframe: timeframe || "15m",
        totalTrades: rows.length,
        openTrades: open.length,
        closedTrades: closed.length,
        winningTrades: wins,
        losingTrades: losses,
        winRate,
        tgt1Profit,
        netPL,
        openPL,
        openMaxPoints,
    };
}

async function getPerfDaily({ exchange, timeframe } = {}) {
    const { rows } = await getPerfTrades({ exchange, timeframe, limit: 100000, offset: 0 });
    const byDay = {};
    for (const r of rows) {
        const key = r.entryTime ? dayKey(r.entryTime) : null;
        if (!key) continue;
        const d = byDay[key] || (byDay[key] = { date: key, trades: 0, closed: 0, wins: 0, losses: 0, tgt1Profit: 0, netPL: 0 });
        d.trades++;
        if (r.status === "CLOSED") {
            d.closed++;
            d.tgt1Profit += r.target1Profit ?? 0;
            d.netPL += r.resultPoints ?? 0;
            if ((r.resultPoints ?? 0) > 0) d.wins++;
            else d.losses++;
        }
    }
    return Object.values(byDay)
        .sort((a, b) => (a.date < b.date ? 1 : -1))
        .map((d) => ({
            date: d.date,
            trades: d.trades,
            closed: d.closed,
            wins: d.wins,
            losses: d.losses,
            tgt1Profit: d.tgt1Profit,
            netPL: d.netPL,
        }));
}

async function getPerfScripts({ exchange, timeframe } = {}) {
    const { rows } = await getPerfTrades({ exchange, timeframe, limit: 100000, offset: 0 });
    const bySymbol = {};
    for (const r of rows) {
        const s = r.symbol || "—";
        const d = bySymbol[s] || (bySymbol[s] = { symbol: s, trades: 0, open: 0, closed: 0, wins: 0, losses: 0, tgt1Profit: 0, netPL: 0 });
        d.trades++;
        if (r.status === "OPEN") d.open++;
        else if (r.status === "CLOSED") {
            d.closed++;
            d.tgt1Profit += r.target1Profit ?? 0;
            d.netPL += r.resultPoints ?? 0;
            if ((r.resultPoints ?? 0) > 0) d.wins++;
            else d.losses++;
        }
    }
    return Object.values(bySymbol).map((d) => ({
        ...d,
        winRate: d.closed ? (d.wins / d.closed) * 100 : 0,
    })).sort((a, b) => b.netPL - a.netPL);
}

// Recent Signals: last 5 per script (DB-first).
// Returns groups [{ symbol, exchange, timeframe, signals: PerfTrade[] }]
// newest first per group, ordered by entry_time DESC.
// Uses a single window-function query in Postgres; JSON fallback groups in JS.
async function getPerfRecentSignals({ exchange, timeframe } = {}) {
    if (!pgEnabled()) {
        let rows = loadPerfJson();
        if (exchange) rows = rows.filter((r) => String(r.exchange).toUpperCase() === String(exchange).toUpperCase());
        if (timeframe) rows = rows.filter((r) => String(r.timeframe) === String(timeframe));
        rows.sort((a, b) => (b.entry_time || 0) - (a.entry_time || 0));
        const byScript = new Map();
        for (const r of rows) {
            const sym = String(r.symbol || "").toUpperCase();
            if (!sym) continue;
            const key = `${String(r.exchange).toUpperCase()}:${sym}:${String(r.timeframe)}`;
            if (!byScript.has(key)) byScript.set(key, []);
            const arr = byScript.get(key);
            if (arr.length < 5) arr.push(perfRow(r));
        }
        return [...byScript.entries()]
            .map(([key, signals]) => {
                const [ex, sym, tf] = key.split(":");
                return { exchange: ex, symbol: sym, timeframe: tf, token: signals[0]?.token || null, signals };
            })
            .sort((a, b) => a.symbol.localeCompare(b.symbol));
    }
    try {
        await init();
        const where = [];
        const params = [];
        if (exchange) { params.push(exchange); where.push(`exchange = $${params.length}`); }
        if (timeframe) { params.push(timeframe); where.push(`timeframe = $${params.length}`); }
        const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
        // Window: last 5 per (exchange, symbol, timeframe) by entry_time
        const q = `
            SELECT * FROM (
                SELECT *,
                    ROW_NUMBER() OVER (
                        PARTITION BY exchange, symbol, timeframe
                        ORDER BY entry_time DESC NULLS LAST
                    ) AS rn
                FROM perf_trades
                ${whereSql}
            ) ranked
            WHERE rn <= 5
            ORDER BY symbol ASC, entry_time DESC
        `;
        const r = await getPool().query(q, params);
        const byScript = new Map();
        for (const row of r.rows) {
            const sym = String(row.symbol || "").toUpperCase();
            const key = `${String(row.exchange).toUpperCase()}:${sym}:${String(row.timeframe)}`;
            if (!byScript.has(key)) byScript.set(key, { exchange: String(row.exchange).toUpperCase(), symbol: sym, timeframe: String(row.timeframe), token: row.token || null, signals: [] });
            byScript.get(key).signals.push(perfRow(row));
        }
        return [...byScript.values()];
    } catch (error) {
        console.error("[db] getPerfRecentSignals failed:", error?.message || error);
        return [];
    }
}

// IST day key "YYYY-MM-DD".
function dayKey(ms) {
    try {
        const d = new Date(Number(ms) + 5.5 * 3600 * 1000);
        return d.toISOString().slice(0, 10);
    } catch {
        return null;
    }
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
    upsertPerfTrade,
    getPerfSummary,
    getPerfDaily,
    getPerfScripts,
    getPerfTrades,
    getPerfTrade,
    getPerfRecentSignals,
    rowToUser,
    jsonRowToUser,
};