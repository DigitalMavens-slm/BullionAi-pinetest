/*
 * =========================================================
 * YAHOO FINANCE HISTORY FALLBACK (NSE / BSE)
 *
 * Shoonya's TPSeries historical endpoint is sometimes
 * unavailable. Yahoo Finance serves intraday + daily OHLCV for
 * NSE (.NS) and BSE (.BO) instruments — including while the
 * market is closed — so we use it as a fallback source for
 * those segments.
 *
 * Mapping rules (kept inside this adapter):
 *   NSE  EQ / BE / BZ / ...  ->  <SYMBOL>.NS
 *   BSE  A  / B  / T  / Z  ->  <SYMBOL>.BO
 *   Index tokens             ->  explicit ^ map (NIFTY/BANKNIFTY/SENSEX/...)
 *
 * Yahoo does NOT cover MCX commodities — that segment relies on
 * Shoonya TPSeries + live accumulation.
 *
 * Response normalized to the same internal candle shape used by
 * the rest of the app: { time(ms), open, high, low, close, volume? }.
 * =========================================================
 */

const CDN = "https://query1.finance.yahoo.com/v8/finance/chart/";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

/*
 * Explicit index/token mappings. Yahoo uses ^ prefixed tickers.
 * Keyed by "<EXCH>:<TOKEN>" so we match the Shoonya instrument token.
 */
const INDEX_MAP = {
    "NSE:26000": "^NSEI",        // NIFTY 50
    "NSE:26009": "^NSEBANK",     // BANKNIFTY
    "NSE:26010": "^CNXIT",       // NIFTY IT
    "NSE:26012": "^NSMIDCP",     // NIFTY MIDCAP (fallback)
    "NSE:26013": "^NSMIDCP",     // NIFTYNXT50 -> use midcap as proxy
    "BSE:1": "^BSESN",           // SENSEX
    "BSE:2": "^BSESN",           // SENSEX 50 proxy
    "BSE:6": "^BSESN",           // SENSEX 500 proxy
};

const NSE_EQUITY_RE = /-(EQ|BE|BZ|T|Z|SM|ST)$/i;
const BSE_EQUITY_RE = /^[A-Z0-9&.-]+$/i;

function stripSeriesSuffix(tsym) {
    // "RELIANCE-EQ" -> "RELIANCE", "RELIANCE1" -> keep
    return String(tsym || "").replace(/-(EQ|BE|BZ|T|Z|SM|ST)$/i, "");
}

function toYahooSymbol({ exchange, token, symbol, tsym }) {
    const exch = String(exchange || "").toUpperCase();
    if (!["NSE", "BSE"].includes(exch)) return null;

    // 1) Explicit index mapping first.
    const idxMapped = INDEX_MAP[`${exch}:${String(token).trim()}`];
    if (idxMapped) return idxMapped;

    // 2) Index-type instruments (no explicit ticker) — skip if unmapped.
    //    We can't reliably guess the ^ ticker, so return null and let the
    //    caller fall through to Shoonya/live.

    // 3) Equity / other: pick a base symbol.
    const base = String(symbol || tsym || "").trim();
    if (!base) return null;

    // 4) NSE: strip "-EQ" then append .NS
    if (exch === "NSE") {
        const s = stripSeriesSuffix(base);
        return s.endsWith(".NS") ? s : `${s}.NS`;
    }

    // 5) BSE: append .BO (unless already suffixed)
    if (exch === "BSE") {
        const s = stripSeriesSuffix(base);
        return s.endsWith(".BO") ? s : `${s}.BO`;
    }

    return null;
}

async function fetchYahooHistory({ exchange, token, symbol, tsym, interval = "15m", range = "1mo" }) {
    const ySym = toYahooSymbol({ exchange, token, symbol, tsym });
    if (!ySym) return { ok: false, reason: "unsupported-symbol", candles: [] };

    const url =
        `${CDN}${encodeURIComponent(ySym)}` +
        `?interval=${encodeURIComponent(interval)}&range=${encodeURIComponent(range)}&includePrePost=false`;

    const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(20000) });
    if (!res.ok) return { ok: false, reason: `http-${res.status}`, candles: [] };

    const json = await res.json();
    const result = json?.chart?.result?.[0];
    if (!result?.timestamp || !result?.indicators?.quote?.[0]) {
        return { ok: false, reason: "no-data", candles: [] };
    }

    const ts = result.timestamp;
    const q = result.indicators.quote[0];
    const candles = [];

    for (let i = 0; i < ts.length; i++) {
        const open = Number(q.open?.[i]);
        const high = Number(q.high?.[i]);
        const low = Number(q.low?.[i]);
        const close = Number(q.close?.[i]);
        if (![open, high, low, close].every(Number.isFinite)) continue;
        if (open <= 0 || high <= 0 || low <= 0 || close <= 0) continue;
        candles.push({
            time: Number(ts[i]) * 1000,
            open,
            high,
            low,
            close,
            volume: Number.isFinite(Number(q.volume?.[i])) ? Number(q.volume?.[i]) : 0,
        });
    }

    candles.sort((a, b) => a.time - b.time);

    // Merge safety: dedupe by time (keep first).
    const seen = new Map();
    for (const c of candles) {
        if (!seen.has(Number(c.time))) seen.set(Number(c.time), c);
    }

    return {
        ok: candles.length > 0,
        reason: candles.length > 0 ? "ok" : "no-data",
        symbol: ySym,
        candles: Array.from(seen.values()).sort((a, b) => a.time - b.time),
    };
}

module.exports = {
    toYahooSymbol,
    fetchYahooHistory,
    INDEX_MAP,
};