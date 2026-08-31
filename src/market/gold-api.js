// =========================================================
// GOLD · SILVER SPOT DATA SOURCE (gold-api.com)
//
// Live spot price:  GET https://api.gold-api.com/price/{symbol}  -> FREE, no
//                   rate limit, real-time, in-memory, CORS enabled.
// OHLC history:     GET https://api.gold-api.com/ohlc/{symbol}   -> needs an
//                   API key (x-api-key header); free tier 10 req/hr. We fetch
//                   it rarely (big cached window) so the limit is a non-issue.
//
// Symbols: XAU (Gold), XAG (Silver), XPT, XPD, HG.
//
// No secrets are stored anywhere — only the key from GOLD_API_KEY env var.
// =========================================================

const API_BASE = process.env.GOLD_API_URL || "https://api.gold-api.com";
const API_KEY = process.env.GOLD_API_KEY || "";

const SYMBOL_NAMES = {
    XAU: "Gold",
    XAG: "Silver",
    XPT: "Platinum",
    XPD: "Palladium",
    HG: "Copper",
};

// Normalized to the internal candle shape used everywhere:
//   { time(ms), open, high, low, close, volume? }
// gold-api OHLC returns segments with startTimestamp (seconds) + o/h/l/c.
// We always emit a volume (0 when the feed doesn't provide per-bar volume)
// so the indicator/strategy engine never rejects missing volume.
function normalizeOhlc(raw = []) {
    const candles = [];
    for (const seg of raw) {
        const ts = Number(seg.startTimestamp || seg.timestamp || seg.openTimestamp || 0);
        const close = Number(seg.close);
        if (!ts || !Number.isFinite(close)) continue;
        const vol = Number(seg.volume ?? seg.volume_24h ?? 0);
        candles.push({
            time: ts * 1000,
            open: Number(seg.open),
            high: Number(seg.high),
            low: Number(seg.low),
            close,
            volume: Number.isFinite(vol) ? vol : 0,
        });
    }
    candles.sort((a, b) => a.time - b.time);
    return candles;
}

async function fetchJson(url, headers = {}) {
    const res = await fetch(url, {
        headers,
        signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) {
        const err = new Error(`gold-api HTTP ${res.status}: ${res.statusText}`);
        err.status = res.status;
        try { err.detail = (await res.json())?.error || ""; } catch {}
        throw err;
    }
    return res.json();
}

async function fetchSpotPrice(symbol) {
    const s = String(symbol || "XAU").toUpperCase();
    const data = await fetchJson(`${API_BASE}/price/${s}`);
    const price = Number(data?.price);
    if (!Number.isFinite(price) || price <= 0) {
        throw new Error(`gold-api invalid price for ${s}`);
    }
    return {
        symbol: s,
        name: data?.name || SYMBOL_NAMES[s] || s,
        price,
        currency: data?.currency || "USD",
        updatedAt: data?.updatedAt ? Date.parse(data.updatedAt) : Date.now(),
    };
}

// OHLC history. Requires GOLD_API_KEY. start/end are Unix seconds.
async function fetchOhlcHistory({ symbol, startTimestamp, endTimestamp }) {
    if (!API_KEY) {
        throw new Error("GOLD_API_KEY is not set — historical OHLC requires an API key. Live price works without a key.");
    }
    const s = String(symbol || "XAU").toUpperCase();
    const url =
        `${API_BASE}/ohlc/${s}` +
        `?startTimestamp=${encodeURIComponent(startTimestamp)}` +
        `&endTimestamp=${encodeURIComponent(endTimestamp)}`;
    const data = await fetchJson(url, { "x-api-key": API_KEY });
    return normalizeOhlc(data);
}

// Lightweight OHLC specifically for the CANDLE aggregator — fetches OHLC
// segments (which are the nearest 1-hour/day bars gold-api provides on the
// free tier). Returns normalized candles in the internal shape.
async function fetchSpotCandles({ symbol, startTimestamp, endTimestamp }) {
    return fetchOhlcHistory({ symbol, startTimestamp, endTimestamp });
}

module.exports = {
    API_BASE,
    hasApiKey: () => Boolean(API_KEY),
    SYMBOL_NAMES,
    fetchSpotPrice,
    fetchOhlcHistory,
    fetchSpotCandles,
    normalizeOhlc,
};
