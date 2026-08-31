/*
 * =========================================================
 * SEGMENT CONFIGURATION
 *
 * Single source of truth for exchange-aware segment metadata
 * and market sessions. The core engine is exchange-agnostic;
 * each exchange (MCX / NSE / BSE) is described here so the rest
 * of the stack (candle engine, tick engine, signal engine,
 * frontend status) can adapt without hardcoding per-exch logic.
 *
 * Sessions are declared in IST (Asia/Kolkata). Times are
 * inclusive of the start and exclusive of the end, i.e.
 * [start, end). Multi-range sessions (e.g. a lunch break or a
 * distinct pre-open) are expressed as an array of ranges.
 * =========================================================
 */

const IST_TIME_ZONE = "Asia/Kolkata";

/*
 * Helper: convert "HH:MM" (IST wall clock) into minutes after
 * midnight so ranges can be compared in pure integer minutes.
 */
function toMinutes(hhmm) {
    const m = String(hhmm || "").trim().match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return null;
    return Number(m[1]) * 60 + Number(m[2]);
}

function includesRange(nowMin, ranges) {
    for (const r of ranges) {
        const s = toMinutes(r[0]);
        const e = toMinutes(r[1]);
        if (s === null || e === null) continue;
        // [start, end)
        if (nowMin >= s && nowMin < e) return true;
    }
    return false;
}

function currentISTMinutes(value = Date.now()) {
    const p = new Intl.DateTimeFormat("en-GB", {
        timeZone: IST_TIME_ZONE,
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    }).formatToParts(value);
    const h = Number(p.find(x => x.type === "hour")?.value || 0) % 24;
    const mi = Number(p.find(x => x.type === "minute")?.value || 0);
    return h * 60 + mi;
}

function currentISTDay(value = Date.now()) {
    // 1=Mon ... 7=Sun
    const wd = new Intl.DateTimeFormat("en-US", {
        timeZone: IST_TIME_ZONE,
        weekday: "short",
    }).format(value);
    return { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 }[wd] ?? 0;
}

const SEGMENTS = {
    MCX: {
        id: "MCX",
        name: "Multi Commodity Exchange",
        exchange: "MCX",
        // Commodity derivatives: Mon–Fri, roughly 09:00 – 23:30 IST
        tradingDays: [1, 2, 3, 4, 5],
        sessions: [
            {
                label: "Regular",
                status: "OPEN",
                ranges: [["09:00", "23:30"]],
            },
            {
                label: "Pre-Open",
                status: "PRE-OPEN",
                ranges: [["08:45", "09:00"]],
            },
        ],
        defaultTimeframe: "15m",
        instrumentTypes: ["FUTCOM", "FUTIDX", "OPTCOM", "OPTIDX", "SPOT"],
        tickHandling: "price-volume-oi",
        contractBased: true,
    },
    NSE: {
        id: "NSE",
        name: "National Stock Exchange",
        exchange: "NSE",
        // Equities + derivatives: Mon–Fri 09:15 – 15:30 IST
        tradingDays: [1, 2, 3, 4, 5],
        sessions: [
            {
                label: "Regular",
                status: "OPEN",
                // Equities 09:15-15:30; derivatives 09:15-15:30 with muhurat tail.
                // We model the common cash session. Derivative-specific windows
                // can be refined via adapter if needed.
                ranges: [["09:15", "15:30"]],
            },
            {
                label: "Pre-Open",
                status: "PRE-OPEN",
                ranges: [["09:00", "09:15"]],
            },
        ],
        defaultTimeframe: "15m",
        instrumentTypes: ["EQ", "FUT", "OPT", "INDEX", "BE", "BZ"],
        tickHandling: "price-volume",
        contractBased: false,
    },
    BSE: {
        id: "BSE",
        name: "Bombay Stock Exchange",
        exchange: "BSE",
        // Equities: Mon–Fri 09:15 – 15:30 IST
        tradingDays: [1, 2, 3, 4, 5],
        sessions: [
            {
                label: "Regular",
                status: "OPEN",
                ranges: [["09:15", "15:30"]],
            },
            {
                label: "Pre-Open",
                status: "PRE-OPEN",
                ranges: [["09:00", "09:15"]],
            },
        ],
        defaultTimeframe: "15m",
        instrumentTypes: ["A", "B", "F", "INDEX", "EQ", "BE", "T", "Z"],
        tickHandling: "price-volume",
        contractBased: false,
    },
    SPOT: {
        id: "SPOT",
        name: "Spot — Gold & Silver (USD)",
        exchange: "SPOT",
        // Spot gold/silver quoted in USD per ounce. Backed by COMEX futures
        // (GC=F / SI=F) from Yahoo Finance since Yahoo's public API doesn't
        // expose the literal XAU/USD / XAG/USD spot rate. These trade on the
        // US COMEX floor (CME Group, New York), roughly 18:00 ET Sun–Fri near
        // 24h with a ~17:00–18:00 ET settlement break. Modeled Mon–Sat in IST.
        tradingDays: [1, 2, 3, 4, 5, 6],
        sessions: [
            {
                label: "Regular",
                status: "OPEN",
                // approx 03:30 IST to 23:30 IST (ET day)
                ranges: [["03:30", "23:30"]],
            },
            {
                label: "Settlement Break",
                status: "PRE-OPEN",
                ranges: [["01:30", "03:30"]],
            },
        ],
        defaultTimeframe: "15m",
        instrumentTypes: ["FUT", "FUTCOM", "FUTMET"],
        tickHandling: "price-volume",
        contractBased: true,
        // Data for Spot comes from Yahoo Finance (GC=F, SI=F) — Shoonya does
        // not trade US COMEX futures. Historical + snapshot only.
        dataSource: "yahoo",
        yahooSymbols: {
            GOLD: "GC=F",
            SILVER: "SI=F",
        },
        currency: "USD",
    },
};

// Backwards-compatible alias: getExchangeRows / lookup by id.
function getSegment(exchange) {
    const id = String(exchange || "").trim().toUpperCase();
    return SEGMENTS[id] || null;
}

function getSegments() {
    return Object.values(SEGMENTS).map(s => ({
        id: s.id,
        name: s.name,
        exchange: s.exchange,
        defaultTimeframe: s.defaultTimeframe,
        instrumentTypes: s.instrumentTypes,
        contractBased: s.contractBased,
    }));
}

function getSessionStatus(exchange, value = Date.now()) {
    const seg = getSegment(exchange);
    if (!seg) return { status: "UNKNOWN", label: "Unknown", open: false, tradingDay: false };

    const day = currentISTDay(value);
    const min = currentISTMinutes(value);
    const tradingDay = seg.tradingDays.includes(day);

    // Outside a configured session (or non-trading day) -> CLOSED.
    let matched = null;
    if (tradingDay) {
        for (const session of seg.sessions) {
            if (includesRange(min, session.ranges)) {
                matched = session;
                break;
            }
        }
    }

    if (!matched) {
        return {
            status: "CLOSED",
            label: "Closed",
            open: false,
            tradingDay,
            sessions: seg.sessions,
        };
    }

    return {
        status: matched.status,
        label: matched.label,
        open: matched.status === "OPEN",
        tradingDay,
        sessions: seg.sessions,
    };
}

function getMarketStatus(value = Date.now()) {
    const out = {};
    for (const id of Object.keys(SEGMENTS)) {
        out[id] = getSessionStatus(id, value);
    }
    // Legacy convenience: is the whole market "open" for any segment?
    out.open = Object.values(SEGMENTS).some(id => getSessionStatus(id, value).open);
    return out;
}

module.exports = {
    IST_TIME_ZONE,
    SEGMENTS,
    getSegment,
    getSegments,
    getSessionStatus,
    getMarketStatus,
};