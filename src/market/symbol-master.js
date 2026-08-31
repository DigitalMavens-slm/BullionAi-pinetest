/*
 * =========================================================
 * INSTRUMENT REGISTRY
 *
 * Normalizes Shoonya scrip masters (MCX/NSE/BSE) into:
 *
 *   { exchange, token, symbol, tradingSymbol,
 *     instrumentType, expiry(ms), expiryText,
 *     lotSize, tickSize }
 *
 * CURRENT-CONTRACT RESOLUTION
 * --------------------------
 * Derivative roots (e.g. MCX GOLD) roll before their
 * expiry week. We keep, per root symbol, the nearest
 * expiry that is still BEYOND the rollover buffer
 * (default 5 days, IST). If every contract is inside the
 * buffer we fall back to the absolute nearest so users
 * always see something tradable.
 *
 * Equities (NSE/BSE EQ series) never expire — always valid.
 * =========================================================
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const SYMBOLS_DIR = path.resolve(
    process.cwd(),
    "data",
    "symbols"
);

const EXCHANGES =
    ["MCX", "NSE", "BSE", "COMEX"];

const CDN =
    "https://api.shoonya.com";

/*
 * COMEX is a US exchange (CME Group). Shoonya does not host a COMEX
 * symbol file, so we define the tradable set here. Data comes from Yahoo
 * Finance (GC=F, SI=F, HG=F, PL=F, PA=F). Expo/root names align with
 * segment-config.com? SEGMENTS.COMEX.yahooSymbols.
 */
const COMEX_SYMBOLS = [
    {
        exch: "COMEX",
        token: "GC",
        symbol: "GOLD",
        tradingSymbol: "GOLD",
        tsym: "GOLD",
        instrumentType: "FUTMET",
        instrumentName: "Gold",
        name: "COMEX Gold",
        // fixed synthetic expiry (year-end) so the registry treats it like a
        // contract symbol; auto-roll is not meaningful for a continuous index.
        expiry: null,
        expiryRaw: "",
        lotSize: 100,
        tickSize: 0.1,
        yahooSymbol: "GC=F",
    },
    {
        exch: "COMEX",
        token: "SI",
        symbol: "SILVER",
        tradingSymbol: "SILVER",
        tsym: "SILVER",
        instrumentType: "FUTMET",
        instrumentName: "Silver",
        name: "COMEX Silver",
        expiry: null,
        expiryRaw: "",
        lotSize: 5000,
        tickSize: 0.005,
        yahooSymbol: "SI=F",
    },
    {
        exch: "COMEX",
        token: "HG",
        symbol: "COPPER",
        tradingSymbol: "COPPER",
        tsym: "COPPER",
        instrumentType: "FUTMET",
        instrumentName: "Copper",
        name: "COMEX Copper",
        expiry: null,
        expiryRaw: "",
        lotSize: 25000,
        tickSize: 0.0005,
        yahooSymbol: "HG=F",
    },
    {
        exch: "COMEX",
        token: "PL",
        symbol: "PLATINUM",
        tradingSymbol: "PLATINUM",
        tsym: "PLATINUM",
        instrumentType: "FUTMET",
        instrumentName: "Platinum",
        name: "COMEX Platinum",
        expiry: null,
        expiryRaw: "",
        lotSize: 50,
        tickSize: 0.1,
        yahooSymbol: "PL=F",
    },
    {
        exch: "COMEX",
        token: "PA",
        symbol: "PALLADIUM",
        tradingSymbol: "PALLADIUM",
        tsym: "PALLADIUM",
        instrumentType: "FUTMET",
        instrumentName: "Palladium",
        name: "COMEX Palladium",
        expiry: null,
        expiryRaw: "",
        lotSize: 100,
        tickSize: 0.05,
        yahooSymbol: "PA=F",
    },
];

/* MCX rollover window (days before expiry) */

const ROLLOVER_DAYS =
    Number(process.env.BULLIONAI_ROLLOVER_DAYS) ||
    5;

const cache =
    new Map();

const inflight =
    new Map();

const _MONTHS = {
    JAN: 0, FEB: 1, MAR: 2, APR: 3,
    MAY: 4, JUN: 5, JUL: 6, AUG: 7,
    SEP: 8, OCT: 9, NOV: 10, DEC: 11,
};


// ---------------------------------------------------------
// FILES
// ---------------------------------------------------------

function txtPath(e) {
    return path.join(SYMBOLS_DIR, `${e}_symbols.txt`);
}

function zipPath(e) {
    return path.join(SYMBOLS_DIR, `${e}_symbols.txt.zip`);
}


async function ensureFile(exch) {

    fs.mkdirSync(SYMBOLS_DIR, { recursive: true });

    if (fs.existsSync(txtPath(exch))) return true;

    const res =
        await fetch(`${CDN}/${exch}_symbols.txt.zip`);

    if (!res.ok) {
        throw new Error(`CDN ${res.status} for ${exch}`);
    }

    fs.writeFileSync(
        zipPath(exch),
        Buffer.from(await res.arrayBuffer())
    );

    const tries = [
        `tar -xf "${zipPath(exch)}" -C "${SYMBOLS_DIR}"`,
        `unzip -o "${zipPath(exch)}" -d "${SYMBOLS_DIR}"`,
    ];

    for (const cmd of tries) {

        try {
            execSync(cmd, {
                stdio: "ignore",
                windowsHide: true,
                timeout: 60_000,
            });
            break;
        } catch {
            // try next
        }

    }

    if (!fs.existsSync(txtPath(exch))) {

        const found = walk(SYMBOLS_DIR).find(
            f =>
                path.basename(f).toLowerCase() ===
                `${exch.toLowerCase()}_symbols.txt`
        );

        if (found) fs.renameSync(found, txtPath(exch));

    }

    return fs.existsSync(txtPath(exch));

}


function walk(dir) {

    const out = [];

    for (const f of fs.readdirSync(dir)) {

        const fp =
            path.join(dir, f);

        if (fs.statSync(fp).isDirectory()) {
            out.push(...walk(fp));
        } else {
            out.push(fp);
        }

    }

    return out;

}


// ---------------------------------------------------------
// HELPERS
// ---------------------------------------------------------

function expiryMs(raw) {

    if (!raw) return null;

    const m =
        String(raw)
            .toUpperCase()
            .match(/(\d{1,2})[- ]([A-Z]{3})[- ]?(\d{4})?/);

    if (!m) return null;

    const mon = _MONTHS[m[2]];

    if (mon === undefined || Number.isNaN(Number(m[1]))) {
        return null;
    }

    return new Date(
        Number(m[3] || 1970),
        mon,
        Number(m[1])
    ).getTime();

}


function istDayStart(nowMs) {

    /* IST midnight for stable day math */

    const d =
        new Date(nowMs + 5.5 * 3600_000);

    d.setUTCHours(0, 0, 0, 0);

    return d.getTime() - 5.5 * 3600_000;

}


// ---------------------------------------------------------
// PARSE
// ---------------------------------------------------------

function parseFile(exch) {

    const raw =
        fs.readFileSync(txtPath(exch), "utf8");

    const lines =
        raw.split(/\r?\n/);

    const sample =
        lines.find(l => l.trim().length > 0) || "";

    const delim =
        sample.includes("|") ? "|" : ",";

    let colIdx = null;

    const headerCols =
        lines[0] && /^Exchange/i.test(lines[0])
            ? lines[0].split(delim)
            : [];


    const find = name =>
        headerCols.findIndex(
            h => h.trim().toUpperCase().startsWith(name)
        );


    const rows = [];

    const startIndex =
        headerCols.length ? 1 : 0;


    for (let i = startIndex; i < lines.length; i++) {

        const line = lines[i];

        if (!line.trim()) continue;

        const c =
            line.split(delim);


        if (!colIdx) {

            colIdx = {
                token:
                    headerCols.length && find("TOKEN") >= 0
                        ? find("TOKEN")
                        : 1,

                lot:
                    headerCols.length && find("LOT") >= 0
                        ? find("LOT")
                        : 2,

                symbol:
                    headerCols.length && find("SYMBOL") >= 0 &&
                    !(find("TRADINGSYMBOL") === find("SYMBOL"))
                        ? find("SYMBOL")
                        : delim === ","
                            ? 4
                            : 3,

                tsym:
                    headerCols.length && find("TRADINGSYMBOL") >= 0
                        ? find("TRADINGSYMBOL")
                        : delim === ","
                            ? 5
                            : 4,

                expiry:
                    headerCols.length && find("EXPIRY") >= 0
                        ? find("EXPIRY")
                        : delim === ","
                            ? 6
                            : 5,

                instr:
                    headerCols.length && find("INSTRUMENT") >= 0
                        ? find("INSTRUMENT")
                        : delim === ","
                            ? 7
                            : 6,

                tick:
                    headerCols.length && find("TICK") >= 0
                        ? find("TICK")
                        : delim === ","
                            ? 10
                            : 9,
            };

        }


        const token =
            c[colIdx.token];

        const tradingSymbol =
            String(c[colIdx.tsym] || "").trim();

        if (!token || !tradingSymbol) continue;


        const expiryRaw =
            String(c[colIdx.expiry] || "").trim();


        rows.push({

            exch,

            token:
                String(token).trim(),

            symbol:
                String(c[colIdx.symbol] || "").trim(),

            tradingSymbol,

            instrumentType:
                String(c[colIdx.instr] || "").trim(),

            expiryRaw,

            expiry:
                expiryMs(expiryRaw),

            lotSize:
                Number(c[colIdx.lot]) || null,

            tickSize:
                Number(String(c[colIdx.tick] || "").trim()) ||
                null,

        });

    }

    return rows;

}


// ---------------------------------------------------------
// REGISTRY BUILD (per exchange)
// ---------------------------------------------------------

function buildRegistry(exch, rawRows) {

    const now =
        istDayStart(Date.now());

    const bufferMs =
        ROLLOVER_DAYS * 86400000;


    /*
     * Split rows into:
     *   - perpetuals (no expiry): NSE/BSE equities etc.
     *   - derivatives grouped by root symbol
     */

    const perpetuals = [];
    const groups =
        new Map();


    for (const r of rawRows) {

        const row = {

            exchange:
                r.exch || exch,

            token:
                r.token,

            symbol:
                r.symbol,

            tradingSymbol:
                r.tradingSymbol,

            instrumentType:
                r.instrumentType,

            expiry:
                r.expiry,

            expiryText:
                r.expiryRaw,

            lotSize:
                r.lotSize,

            tickSize:
                r.tickSize,

            name:
                r.name || "",

        };


        if (
            !r.expiry &&
            !/^(FUT|OPT)/i.test(r.instrumentType || "")
        ) {

            perpetuals.push(row);

            continue;

        }


        /* Options never represent the current contract */
        if (/^OPT/i.test(r.instrumentType || "")) {
            continue;
        }

        if (r.expiry !== null && r.expiry < now) {
            continue;
        }


        const key =

            r.symbol ||
            r.tradingSymbol;


        if (!groups.has(key)) {
            groups.set(key, []);
        }

        groups.get(key).push(row);

    }


    /* Pick current contract per derivative group */

    const current = [];

    for (
        const [, list] of
            groups
    ) {

        list.sort((a, b) =>
            (a.expiry ?? 0) -
            (b.expiry ?? 0));

        /* First contract beyond the rollover buffer… */

        const picked =

            list.find(
                r =>
                    (r.expiry ?? 0) >=
                    now + bufferMs
            )

        /* …else the furthest-out survivor */

            || list[list.length - 1];

        if (picked) current.push(picked);

    }

    current.sort((a, b) =>
        a.tradingSymbol.localeCompare(b.tradingSymbol));


    perpetuals.sort((a, b) =>
        a.tradingSymbol.localeCompare(b.tradingSymbol));


    return [...current, ...perpetuals];

}


// ---------------------------------------------------------
// COMPANY NAMES (optional side-file per exchange)
//   data/symbols/<EXCH>_names.csv  ->  SYMBOL,<name>
// NSE's official EQUITY_L.csv is auto-downloaded.
// ---------------------------------------------------------

const nameCache =
    new Map();

async function getNameMap(exch) {

    if (nameCache.has(exch)) {
        return nameCache.get(exch);
    }

    const f = path.join(
        SYMBOLS_DIR,
        exch + "_names.csv"
    );


    /* Auto-download NSE company names */

    if (
        !fs.existsSync(f) &&
        exch === "NSE"
    ) {
        try {
            const res =
                await fetch(
                    "https://archives.nseindia.com/content/equities/EQUITY_L.csv",
                    { headers: { "User-Agent": "Mozilla/5.0" } }
                );

            if (res.ok) {
                fs.writeFileSync(
                    f,
                    Buffer.from(await res.arrayBuffer())
                );
            }
        } catch {
            // offline — continue without names
        }
    }

        /* FALLBACK: dual-listed companies share names across
         * NSE/BSE — reuse the NSE name map when needed. */
        if (exch !== "NSE") {
            const nseMap =
                await getNameMap("NSE");
            nameCache.set(
                exch,
                nseMap
            );
            return nseMap;
        }


    const map = {};

    try {

        const lines =
            fs.readFileSync(f, "utf8")
                .split(/\r?\n/);

        const hdr =
            (lines[0] || "")
                .split(",")
                .map(h => h.trim().toUpperCase());

        const si =
            hdr.findIndex(h => h === "SYMBOL");

        const ni =
            hdr.findIndex(
                h =>
                    h.includes("NAME OF") ||
                    h.includes("COMPANY NAME") ||
                    h.includes("ISSUER")
            );

        if (si >= 0 && ni >= 0) {

            for (let i = 1; i < lines.length; i++) {

                const c = lines[i].split(",");

                const k = (c[si] || "").trim().toUpperCase();
                const v = (c[ni] || "").replace(/\"/g, "").trim();

                if (k && v && !map[k]) map[k] = v;

            }

        }

    } catch {
        // no name file — fine
    }

    nameCache.set(exch, map);

    return map;

}


// ---------------------------------------------------------
// PUBLIC API
// ---------------------------------------------------------

async function getRegistry(exch) {

    const E =
        String(exch || "")
            .trim()
            .toUpperCase();

    if (!EXCHANGES.includes(E)) return [];

    if (cache.has(E)) return cache.get(E);

    if (inflight.has(E)) return inflight.get(E);


    // COMEX has no Shoonya symbol file — use the built-in static list.
    if (E === "COMEX") {
        return COMEX_SYMBOLS;
    }


    const job = (async () => {

        await ensureFile(E);

        const nameMap =
            await getNameMap(E);

        try {
            reg = buildRegistry(
                E,
                parseFile(E).map(r => ({
                    ...r,
                    name:
                        nameMap[String(r.symbol || "").toUpperCase()] || "",
                }))
            );
        } catch (error) {
            console.error(
                `[registry] ${E} failed:`,
                error?.message || error
            );
        }

        cache.set(E, reg);

        return reg;

    })();

    inflight.set(E, job);

    const rows =
        await job;

    inflight.delete(E);

    return rows;

}


async function searchSymbols({
    query,
    exchange,
    limit = 30,
}) {

    const q =
        String(query || "").trim().toUpperCase();

    const exchs =
        exchange
            ? [String(exchange).toUpperCase()]
            : EXCHANGES;

    let pool = [];

    for (const E of exchs) {

        const rows =
            await getRegistry(E).catch(() => []);

        for (const r of rows) {

            const hay = [
                r.tradingSymbol,
                r.symbol,
                r.name || "",
            ]
                .join(" ")
                .toUpperCase();

            if (!q || hay.includes(q)) {
                pool.push(r);
            }

        }

    }


    pool.sort((a, b) => {

        const ai =
            a.tradingSymbol.toUpperCase()
                .indexOf(q) === 0
                ? 0
                : 1;

        const bi =
            b.tradingSymbol.toUpperCase()
                .indexOf(q) === 0
                ? 0
                : 1;

        if (ai !== bi) return ai - bi;

        return a.tradingSymbol.length -
            b.tradingSymbol.length;

    });


    /* Legacy flat shape + rich fields */

    return pool.slice(0, limit).map(r => ({

        exch: r.exchange,

        exchange: r.exchange,

        token: r.token,

        symbol: r.symbol,

        tsym: r.tradingSymbol,

        tradingSymbol:
            r.tradingSymbol,

        instrumentType:
            r.instrumentType,

        expiry:
            r.expiry,

        name:
            r.name,

        lotSize:
            r.lotSize,

        tickSize:
            r.tickSize,

    }));

}


async function getRawRows(exch) {
    const E =
        String(exch || "")
            .trim()
            .toUpperCase();
    if (!EXCHANGES.includes(E)) return [];
    await ensureFile(E);
    return parseFile(E);
}

module.exports = {
    searchSymbols,
    getRegistry,
    getExchangeRows:
        getRegistry,
    // Return ALL parsed rows for an exchange (includes expired
    // contracts and options) — useful for rollover fallback logic
    // that needs the previous contract even after it expires.
    getRawExchangeRows:
        getRawRows,
};
