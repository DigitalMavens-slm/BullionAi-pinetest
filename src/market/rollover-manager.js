/*
 * =========================================================
 * ROLLOVER MANAGER — TradingView-style continuous contracts
 *
 * Strategy: Per-token files STAY untouched on disk.
 * On read, we stitch current + next contract with
 * back-adjust in memory only (audit-safe).
 *
 *   current file: data/MCX_483079_15m.json  (Oct)
 *   next file:    data/MCX_483080_15m.json  (Nov)
 *   stitched:     Oct candles (shifted) + Nov candles
 *
 * Back-adjust: gap = nextFirstClose - currentLastClose
 *              shift all prior OHLC by +gap so indicators
 *              (EMA/Supertrend/ATR) don't spike at roll.
 *
 * Rollover trigger (hybrid):
 *   1) Date: expiry - bufferDays (MCX:2, NSE/BSE:1)
 *   2) Volume: next.volume > current.volume * 1.2 (if market available)
 *
 * Per-watchlist instrument — fits search-only flow.
 * =========================================================
 */

const fs = require("fs");
const path = require("path");

const ROLLOVER_BUFFER_DAYS = {
    MCX: 2,
    NSE: 1,
    BSE: 1,
};

function istDayStart(ms) {
    const d = new Date(ms + 5.5 * 3600_000);
    d.setUTCHours(0, 0, 0, 0);
    return d.getTime() - 5.5 * 3600_000;
}

function getRolloverDate(expiryMs, exchange) {
    if (!expiryMs) return null;
    const buf =
        ROLLOVER_BUFFER_DAYS[
            String(exchange || "").toUpperCase()
        ] ?? 2;
    return istDayStart(expiryMs) - buf * 86400000;
}

function loadCandlesForToken(exchange, token, tfKey) {
    const file = path.resolve(
        process.cwd(),
        "data",
        `${exchange}_${token}_${String(tfKey).toLowerCase()}.json`
    );
    if (!fs.existsSync(file)) return [];
    try {
        const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function findPreviousContract(allRows, current) {
    if (!current || !current.expiry) return null;
    const root = String(current.symbol || current.tradingSymbol || "").trim().toUpperCase();
    const candidates = allRows
        .filter(
            r =>
                String(r.symbol || "").trim().toUpperCase() === root &&
                r.expiry &&
                r.expiry < current.expiry
        )
        .sort((a, b) => b.expiry - a.expiry);
    return candidates[0] || null;
}

function findNextContract(allRows, current) {
    if (!current || !current.expiry) return null;
    // group by root symbol (symbol field)
    const root = String(current.symbol || current.tradingSymbol || "").trim().toUpperCase();
    const candidates = allRows
        .filter(
            r =>
                String(r.symbol || "").trim().toUpperCase() === root &&
                r.expiry &&
                r.expiry > current.expiry
        )
        .sort((a, b) => a.expiry - b.expiry);
    return candidates[0] || null;
}

async function shouldRollover({
    exchange,
    token,
    getRegistry,
    market,
} = {}) {
    const exch = String(exchange || "").toUpperCase();
    if (!token) return { roll: false, reason: "no-token" };

    // 1) Date-based
    try {
        if (getRegistry) {
            const rows = await getRegistry(exch).catch(() => []);
            const cur = rows.find(r => String(r.token) === String(token));
            if (cur && cur.expiry) {
                const rollDate = getRolloverDate(cur.expiry, exch);
                if (rollDate && Date.now() >= rollDate) {
                    const nxt = findNextContract(rows, cur);
                    if (nxt) return { roll: true, reason: "date", current: cur, next: nxt, rollDate };
                }
            }
        }
    } catch {}

    // 2) Volume-based (if market available)
    if (market && market.isAuthenticated && market.isAuthenticated()) {
        try {
            const rows = await (getRegistry ? getRegistry(exch) : Promise.resolve([])).catch(() => []);
            const cur = rows.find(r => String(r.token) === String(token));
            const nxt = cur ? findNextContract(rows, cur) : null;
            if (cur && nxt) {
                const [qCur, qNext] = await Promise.all([
                    market.client.getQuotes({ exch, token: String(cur.token) }).catch(() => null),
                    market.client.getQuotes({ exch, token: String(nxt.token) }).catch(() => null),
                ]);
                const vCur = Number(qCur?.v || qCur?.volume || 0);
                const vNext = Number(qNext?.v || qNext?.volume || 0);
                if (vNext > 0 && vCur > 0 && vNext > vCur * 1.2) {
                    return { roll: true, reason: "volume", current: cur, next: nxt, vCur, vNext };
                }
            }
        } catch {}
    }

    return { roll: false };
}

function stitchWithBackAdjust(currentCandles, nextCandles) {
    if (!currentCandles.length || !nextCandles.length) {
        return [...currentCandles, ...nextCandles].sort((a, b) => a.time - b.time);
    }

    // Find gap at stitch point: next first close - current last close
    const lastCur = currentCandles[currentCandles.length - 1];
    const firstNext = nextCandles[0];
    const gap = Number(firstNext.close) - Number(lastCur.close);

    if (!Number.isFinite(gap) || gap === 0) {
        return [...currentCandles, ...nextCandles].sort((a, b) => a.time - b.time);
    }

    // Shift all prior candles by gap
    const adjusted = currentCandles.map(c => ({
        ...c,
        open: Number(c.open) + gap,
        high: Number(c.high) + gap,
        low: Number(c.low) + gap,
        close: Number(c.close) + gap,
        // volume/OI stay as-is
    }));

    const merged = [...adjusted, ...nextCandles].sort((a, b) => a.time - b.time);

    // Dedupe by time (next wins on collision)
    const map = new Map();
    for (const c of merged) map.set(Number(c.time), c);
    return Array.from(map.values()).sort((a, b) => a.time - b.time);
}

function getStitchedCandles({ exchange, token, tfKey, getRegistryRows }) {
    const cur = loadCandlesForToken(exchange, token, tfKey);
    if (!cur.length) return cur;

    // Find next contract synchronously if registry rows provided
    let nxtRows = [];
    if (Array.isArray(getRegistryRows)) {
        const curRow = getRegistryRows.find(r => String(r.token) === String(token));
        const nxt = curRow ? findNextContract(getRegistryRows, curRow) : null;
        if (nxt) {
            nxtRows = loadCandlesForToken(exchange, nxt.token, tfKey);
            if (nxtRows.length) {
                // Only stitch if rollover date has passed or next has data beyond current
                const rollDate = getRolloverDate(curRow.expiry, exchange);
                const lastCurTime = Number(cur[cur.length - 1]?.time || 0);
                const firstNextTime = Number(nxtRows[0]?.time || 0);
                // If next starts after current ends, and roll date is near, stitch
                if (firstNextTime > lastCurTime - 86400000 * 7) {
                    // Simple heuristic: if next has data, stitch with back-adjust
                    // More precise: check if now >= rollDate
                    if (!rollDate || Date.now() >= rollDate - 86400000) {
                        return stitchWithBackAdjust(cur, nxtRows);
                    }
                }
            }
        }
    }

    return cur;
}

/*
 * Fallback when the CURRENT contract has no cached candles (e.g. a
 * freshly-rolled contract Shoonya's historical endpoint cannot backfill).
 * Return the nearest PREVIOUS contract's dataset so the chart and signal
 * engine still have real history to work with. Caches are left untouched.
 */
function getCandlesWithPreviousFallback({ exchange, token, tfKey, getRegistryRows }) {
    const cur = loadCandlesForToken(exchange, token, tfKey);
    if (cur.length) return cur;

    if (!Array.isArray(getRegistryRows) || !getRegistryRows.length) {
        return cur;
    }

    const curRow = getRegistryRows.find(r => String(r.token) === String(token));
    if (!curRow) return cur;

    const prev = findPreviousContract(getRegistryRows, curRow);
    if (!prev) return cur;

    const prevCandles = loadCandlesForToken(exchange, prev.token, tfKey);
    if (!prevCandles.length) return cur;

    return prevCandles;
}

module.exports = {
    ROLLOVER_BUFFER_DAYS,
    getRolloverDate,
    loadCandlesForToken,
    findPreviousContract,
    findNextContract,
    shouldRollover,
    stitchWithBackAdjust,
    getStitchedCandles,
    getCandlesWithPreviousFallback,
};
