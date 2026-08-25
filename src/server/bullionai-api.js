require("dotenv").config();

const http = require("http");
const fs = require("fs");
const path = require("path");

const {
    BullionAILiveCoordinator,
} = require("../runner/bullionai-live-coordinator");

const {
    StrategyEngine,
} = require("../strategy/strategy-engine");

const {
    getTimeframe,
    getAllTimeframes,
} = require("../config/timeframe-config");

const {
    IST_TIME_ZONE,
} = require("../utils/ist-time");

const {
    CandleAggregator,
} = require("../market/candle-aggregator");

const {
    CandleDataManager,
} = require("../market/candle-data-manager");

const GOLD_STORE = new CandleDataManager({
    dataDirectory: "./data",
    exchange: "MCX",
    token: "483079",
});

const SILVER_STORE = new CandleDataManager({
    dataDirectory: "./data",
    exchange: "MCX",
    token: "471725",
});


class BullionAIApi {

    constructor({
        timeframe = "15m",
        port = 8787,
    } = {}) {

        this.timeframe =
            timeframe;

        this.port =
            Number(port) || 8787;

        this.coordinator =
            new BullionAILiveCoordinator({
                timeframe:
                    this.timeframe,
            });

        this.server =
            null;

        this.state =
            null;

        this.started =
            false;

        this.coordinatorStartPromise =
            null;

        /*
         * Per (instrument, timeframe)
         * strategy result cache and
         * in-flight run guards.
         */

        this.strategyCache =
            new Map();

        this.strategyInflight =
            new Map();

        this.sseClients =
            new Set();

        /*
         * =====================================================
         * MARKET-DATA OWNERSHIP
         *
         * The backend — not the browser — owns candle
         * persistence:
         *
         *   1. Live ticks  -> CandleAggregator -> per-TF
         *      OHLCV buckets, completed candles persisted.
         *
         *   2. Startup + periodic reconciliation fills any
         *      gap (downtime / WS outage) from Shoonya
         *      history, merging + deduping by timestamp.
         *
         * Storage stays JSON via CandleDataManager with an
         * upsert interface so it can later be swapped for
         * PostgreSQL/TimescaleDB without touching this file's
         * call sites.
         * =====================================================
         */

        const aggTfs = [
            "15m",
            "30m",
            "45m",
            "60m",
            "120m",
            "240m",
        ].map(key => getTimeframe(key));

        const goldStore =
            new CandleDataManager({
                dataDirectory: "./data",

                exchange: "MCX",

                token: "483079",
            });

        const silverStore =
            new CandleDataManager({
                dataDirectory: "./data",

                exchange: "MCX",

                token: "471725",
            });

        const storeFor = token =>
            String(token) === "471725"
                ? silverStore
                : goldStore;

        this.aggregator =
            new CandleAggregator({

                instruments: [
                    {
                        key: "gold",
                        token: "483079",
                        exchange: "MCX",
                    },
                    {
                        key: "silver",
                        token: "471725",
                        exchange: "MCX",
                    },
                ],

                timeframes: aggTfs,

                storage: {

                    upsertCandle: (
                        exchange,
                        token,
                        tfKey,
                        candle
                    ) =>
                        storeFor(token).upsertCandle(
                            tfKey,
                            candle
                        ),

                },

            });


        /*
         * Tap the live feed's per-tick stream directly —
         * no change to the working WebSocket pipeline.
         */

        const feed =

            this.coordinator?.market?.feed;

        if (feed) {

            feed.on(
                "tick",
                tick =>
                    this.aggregator.onTick(
                        tick
                    )
            );

        }


        this.reconcileTimer =
            null;

        this.reconcileRetryMs = 30_000;

    }


    // =========================================================
    // JSON RESPONSE
    // =========================================================

    sendJson(
        response,
        statusCode,
        data
    ) {

        const body =
            JSON.stringify(
                data
            );

        response.writeHead(
            statusCode,
            {
                "Content-Type":
                    "application/json",

                "Cache-Control":
                    "no-cache",

                "Access-Control-Allow-Origin":
                    "*",

                "Access-Control-Allow-Methods":
                    "GET, OPTIONS",

                "Access-Control-Allow-Headers":
                    "Content-Type",
            }
        );

        response.end(
            body
        );
    }


    // =========================================================
    // START COORDINATOR
    // =========================================================

    async startCoordinator() {

        if (this.started) {
            return;
        }


        if (
            this.coordinatorStartPromise
        ) {

            return this.coordinatorStartPromise;

        }


        this.coordinatorStartPromise =

            this.doStartCoordinator()


                .catch(
                    error => {

                        this.coordinatorStartPromise =
                            null;

                        throw error;

                    }
                );


        return this.coordinatorStartPromise;

    }


    async doStartCoordinator() {

        this.coordinator.on(
            "update",
            rawState => {

                const state =

                    this.enrichState(
                        rawState
                    );

                this.state =
                    state;

                this.broadcastState(
                    state
                );
            }
        );


        this.coordinator.on(
            "market-error",
            error => {

                console.error(
                    "Market error:",
                    error?.message ||
                    error
                );

                this.broadcastEvent(
                    "error",
                    {
                        message:
                            error?.message ||
                            String(error),
                    }
                );
            }
        );


        this.coordinator.on(
            "market-connected",
            () => {

                /* Recover anything missed while disconnected */
                this.scheduleReconcileAll("ws-reconnect", 10000);


                this.broadcastEvent(
                    "market-connected",
                    {
                        connected:
                            true,
                    }
                );
            }
        );


        this.coordinator.on(
            "market-disconnected",
            reason => {

                this.broadcastEvent(
                    "market-disconnected",
                    {
                        connected:
                            false,

                        reason:
                            reason ??
                            null,
                    }
                );
            }
        );


        this.state =
            await this.coordinator.start();


        this.started =
            true;

        /*
         * Market-data ownership: fill any gap opened while we
         * were down, then keep reconciling periodically.
         */

        console.log(
            "[boot] coordinator live — launching reconciliation"
        );

        this.reconcileAll("startup").catch(
            error =>
                console.error(
                    "[reconcile] startup failed:",
                    error?.message || error
                )
        );

        this.startPeriodicReconcile();
    }


    // 
    // =========================================================
    // MARKET-DATA OWNERSHIP — reconciliation
    //
    // Fetches ONLY from latest stored candle onward (+overlap),
    // merges, dedupes by timestamp, sorts, persists. Existing
    // data is never destroyed on failure.
    // =========================================================

    getStore(token) {
        return String(token) === "471725"
            ? SILVER_STORE
            : GOLD_STORE;
    }

    getMarketService() {
        return (
            this.coordinator?.market?.market
        ) ?? null;
    }

    async reconcileTimeframe(instrumentKey, timeframeKey) {
        const market = this.getMarketService();
        if (!market || !market.isAuthenticated()) {
            return { ok: false, reason: "no-session" };
        }

        const inst = this.resolveInstrument(instrumentKey);
        const tf = getTimeframe(timeframeKey);

        if (!Number.isFinite(Number(tf.interval))) {
            return { ok: false, reason: "non-minute" };
        }

        const store = this.getStore(inst.token);
        const existing = store.load(tf.key);

        try {
            const upd = await market.updateCandles(existing, {
                interval: tf.interval,
                exchange: inst.exchange ?? "MCX",
                token: inst.token,
                overlapSeconds: tf.seconds * 3,
            });

            if (
                upd.candles.length > 0 &&
                upd.candles.length !== existing.length
            ) {
                store.save(tf.key, upd.candles);
                console.log(
                    "[reconcile] " +
                        String(inst.symbol ?? inst.token) +
                        " " + tf.key + ": " +
                        existing.length + " -> " + upd.candles.length +
                        " (+" + Math.max(0, upd.candles.length - existing.length) + ")"
                );
                return { ok: true, changed: true };
            }
            return { ok: true, changed: false };
        } catch (error) {
            console.error(
                "[reconcile] " +
                    String(inst.symbol ?? inst.token) +
                    " " + tf.key + " FAILED - keeping dataset:",
                error?.message || error
            );
            return { ok: false, error: String(error?.message || error) };
        }
    }
    async reconcileAll(label) {

        console.log(
            "[reconcile:" +
                label +
                "] starting..."
        );

        try {

            let changedAny = false;
        for (const inst of [{ key: "gold" }, { key: "silver" }]) {
            for (const tf of ["15m", "30m", "45m", "60m", "120m", "240m"]) {
                const r = await this.reconcileTimeframe(inst.key, tf).catch(() => ({ ok: false }));
                if (r.changed) changedAny = true;
                await new Promise(res => setTimeout(res, 200));
            }
        }
            console.log("[reconcile:" + label + "] " + (changedAny ? "datasets updated" : "all datasets current"));
            return true;

        } catch (error) {
            console.error(
                "[reconcile:" + label + "] crashed:",
                error?.message || error
            );
            return false;
        }
    }

    scheduleReconcileAll(label, delayMs) {
        const wait = Number(delayMs) || 15000;
        clearTimeout(this.reconcileTimer);
        this.reconcileTimer = setTimeout(() => {
            this.reconcileAll(label).catch(() => {});
        }, wait);
    }

    startPeriodicReconcile() {
        if (this.periodicTimer) return;
        this.periodicTimer = setInterval(() => {
            const authed =
                this.getMarketService()?.isAuthenticated?.() ?? false;
            if (authed) {
                this.reconcileAll("periodic").catch(() => {});
            }
        }, 5 * 60 * 1000);
        this.periodicTimer.unref?.();
    }

    // =========================================================
    // INSTRUMENT RESOLUTION
    // =========================================================

    resolveInstrument(
        instrument
    ) {

        const key =
            String(
                instrument ||
                "gold"
            )
                .trim()
                .toLowerCase();


        if (
            key === "silver"
        ) {

            return {

                key:
                    "silver",

                name:
                    "Silver Mega",

                symbol:
                    process.env.SHOONYA_SILVER_SYMBOL ||
                    "SILVER04SEP26",

                token:
                    process.env.SHOONYA_SILVER_TOKEN ||
                    "471725",

            };

        }


        return {

            key:
                "gold",

            name:
                "Gold Mega",

            symbol:
                process.env.SHOONYA_GOLD_SYMBOL ||
                process.env.SHOONYA_TOKEN ||
                "GOLD05OCT26",

            token:
                process.env.SHOONYA_GOLD_TOKEN ||
                process.env.SHOONYA_TOKEN ||
                "483079",

        };

    }


    // =========================================================
    // LOAD CANDLES
    // =========================================================

    loadCandles(
        timeframe,
        instrument
    ) {

        const normalized =
            String(
                timeframe ||
                this.timeframe
            )
                .trim()
                .toLowerCase();


const allowedTimeframes =
            new Set([
                "5m",
                "15m",
                "30m",
                "45m",
                "60m",
                "180m",
                "120m",
                "240m",
            ]);


        if (
            !allowedTimeframes.has(
                normalized
            )
        ) {

            throw new Error(
                `Unsupported timeframe: ${normalized}`
            );
        }


        const resolved =
            this.resolveInstrument(
                instrument
            );


        const exchange =
            process.env.SHOONYA_EXCHANGE ||
            "MCX";


        const token =
            resolved.token;


        const fileName =
            `${exchange}_${token}_${normalized}.json`;


        const filePath =
            path.resolve(
                process.cwd(),
                "data",
                fileName
            );


        let candles = [];

        if (
            fs.existsSync(
                filePath
            )
        ) {

            try {

                const raw =
                    fs.readFileSync(
                        filePath,
                        "utf8"
                    );


                candles =
                    JSON.parse(
                        raw
                    );


                if (
                    !Array.isArray(
                        candles
                    )
                ) {

                    throw new Error(
                        `Candle dataset must contain an array: ${fileName}`
                    );


                }

            } catch (error) {

                console.error(
                    "Failed to load candle file:",
                    error.message
                );

                candles = [];

            }

        }


        return {

            instrument:
                resolved.key,

            symbol:
                resolved.symbol,

            name:
                resolved.name,

            timeframe:
                normalized,

            exchange,

            token,

            count:
                candles.length,

            candles,
        };
    }


    // =========================================================
    // ENSURE CANDLES (REAL DATA, FETCHED ON DEMAND)
    //
    // Returns the dataset for an
    // instrument+timeframe. When the
    // file is missing or empty AND a
    // Shoonya session exists, real
    // candles are fetched once and
    // persisted — no dummy data.
    // =========================================================

    async ensureCandles(
        instrumentKey,
        timeframeKey
    ) {

        const inst =

            this.resolveInstrument(
                instrumentKey
            );

        const tf =
            getTimeframe(
                timeframeKey
            );


        const exchange =
            process.env.SHOONYA_EXCHANGE ||
            "MCX";


        const fileName =
            `${exchange}_${inst.token}_${tf.key.toLowerCase()}.json`;


        const filePath =
            path.resolve(
                process.cwd(),
                "data",
                fileName
            );


        let candles = [];


        if (
            fs.existsSync(
                filePath
            )
        ) {

            try {

                const parsed =
                    JSON.parse(
                        fs.readFileSync(
                            filePath,
                            "utf8"
                        )
                    );


                if (
                    Array.isArray(
                        parsed
                    ) &&
                    parsed.length >
                        0
                ) {

                    /*
                     * Normalize on read:
                     * dedupe by time and
                     * enforce ascending
                     * order.
                     */

                    const seen =
                        new Map();


                    for (
                        const c of
                            parsed
                    ) {

                        if (

                            c &&
                            Number.isFinite(
                                Number(
                                    c.time
                                )
                            )

                        ) {

                            seen.set(
                                Number(c.time),
                                c
                            );

                        }

                    }


                    candles =
                        Array.from(
                            seen.values()
                        ).sort(
                            (a, b) =>
                                a.time -
                                b.time
                        );

                }

            } catch (
                error
            ) {

                console.error(
                    "Corrupt candle file:",
                    fileName,
                    error.message
                );

            }

        }


        if (
            candles.length > 0
        ) {

            /*
             * FRESHNESS CHECK
             *
             * Refresh whenever the CURRENT
             * forming bar is missing, so the
             * dataset is always up to now.
             * Only for minute intervals —
             * D/W/M aggregates are rebuilt
             * by the backfill script.
             */

            const lastTimeMs =

                Number(
                    candles[
                        candles
                            .length - 1
                    ]?.time
                ) || 0;


            const tfSec =
                Math.max(
                    tf.seconds,
                    60
                );


            const isMinuteTf =

                !Number.isNaN(
                    Number(
                        tf.interval
                    )
                );


            const currentBarStartMs =

                Math.floor(

                    Date.now() /

                        (tfSec *
                          1000)

                ) *

                tfSec *
                1000;


            const needsRefresh =

                lastTimeMs > 0 &&
                isMinuteTf &&
                lastTimeMs <
                    currentBarStartMs;


            const market =

                this.coordinator
                    ?.market;


            if (

                market &&
                market.isAuthenticated() &&
                needsRefresh

            ) {

                try {

                    console.log(
                        `Refreshing stale ${fileName}...`
                    );

                    const upd =
                        await market.updateCandles(
                            candles,
                            {
                                interval:
                                    tf.interval,

                                exchange,

                                token:
                                    inst.token,

                                overlapSeconds:

                                    tf.seconds *
                                    3,
                            }
                        );


                    const seen =
                        new Map();


                    for (
                        const c of
                            upd.candles ||
                            []
                    ) {

                        if (

                            c &&
                            Number.isFinite(
                                Number(
                                    c.time
                                )
                            )

                        ) {

                            seen.set(
                                Number(c.time),
                                c
                            );

                        }

                    }


                    const merged =
                        Array.from(

                            seen.values()

                        ).sort(
                            (a, b) =>
                                a.time -
                                b.time
                        );


                    if (

                        merged.length >
                            0 &&
                        merged[
                            merged
                                .length - 1
                        ].time >
                            lastTimeMs

                    ) {

                        fs.writeFileSync(
                            filePath,
                            JSON.stringify(
                                merged,
                                null,
                                2
                            ),
                            "utf8"
                        );


                        console.log(
                            `Refreshed → ${merged.length} candles (was ${candles.length})`
                        );

                        candles =
                            merged;

                    }

                } catch (
                    error
                ) {

                    console.error(
                        `Refresh failed for ${fileName}:`,
                        error?.message ||
                        error
                    );

                }

            }

            return {
                inst,
                tf,
                exchange,
                filePath,
                candles,
                fetched:
                    false,
            };

        }


        /*
         * Empty dataset → backfill
         * from Shoonya when a session
         * is available.
         */

        const market =

            this.coordinator
                ?.market;


        if (

            !market ||
            !market.isAuthenticated()

        ) {

            return {
                inst,
                tf,
                exchange,
                filePath,
                candles,
                fetched:
                    false,

                reason:
                    "no-session",
            };

        }


        const endSeconds =
            Math.floor(
                Date.now() / 1000
            );


        const lookbackSeconds =
            Math.min(

                Math.max(
                    tf.seconds *
                      400,
                    7 * 86400
                ),

                180 * 86400
            );


        try {

            console.log(
                `Backfilling ${fileName}...`
            );

            candles =
                await market.fetchCandles(
                    {
                        startSeconds:

                            endSeconds -
                            lookbackSeconds,

                        endSeconds,

                        exchange,

                        token:
                            inst.token,

                        interval:
                            tf.interval,
                    }
                );


            /*
             * Shoonya may return rows
             * newest-first with possible
             * duplicates. Normalize to
             * unique ascending order
             * before persisting.
             */

            const seen =
                new Map();


            for (
                const c of candles ||
                []
            ) {

                if (

                    c &&
                    Number.isFinite(
                        Number(
                            c.time
                        )
                    )

                ) {

                    seen.set(
                        Number(c.time),
                        c
                    );

                }

            }


            candles = Array.from(

                seen.values()

            ).sort(
                (a, b) =>
                    a.time - b.time
            );


            if (
                candles.length > 0
            ) {

                fs.writeFileSync(
                    filePath,
                    JSON.stringify(
                        candles,
                        null,
                        2
                    ),
                    "utf8"
                );


                console.log(
                    `Backfilled ${candles.length} candles → ${fileName}`
                );

            }

        } catch (
            error
        ) {

            console.error(
                `Backfill failed for ${fileName}:`,
                error?.message ||
                error
            );

        }


        return {
            inst,
            tf,
            exchange,
            filePath,
            candles,
            fetched:
                candles.length >
                0,
        };

    }


    // =========================================================
    // RUN PINE STRATEGY PER VIEW
    //
    // Executes BullionAI.pine on the
    // exact (instrument, timeframe)
    // dataset and caches until a new
    // candle arrives.
    // =========================================================

    async runStrategyFor(
        instrumentKey,
        timeframeKey
    ) {

        const ensured =
            await this.ensureCandles(
                instrumentKey,
                timeframeKey
            );

        const { inst, tf } =
            ensured;


        if (
            ensured.candles
                .length === 0
        ) {

            return {
                ok: false,

                instrument:
                    inst.key,

                symbol:
                    inst.symbol,

                timeframe:
                    tf.key,

                error:

                    ensured.reason ===
                    "no-session"

                        ? "No candle data yet and no Shoonya session available."

                        : "No candle data available.",
            };

        }


        const lastCandle =

            ensured.candles[
                ensured.candles
                    .length - 1
            ];


        const cacheKey =
            `${inst.token}_${tf.key}`;


        const cached =

            this.strategyCache.get(
                cacheKey
            );


        if (

            cached &&
            cached.count ===
                ensured.candles
                    .length &&
            cached.lastTime ===
                lastCandle.time

        ) {

            return cached.payload;

        }


        if (
            this.strategyInflight.has(
                cacheKey
            )
        ) {

            return this.strategyInflight.get(
                cacheKey
            );

        }


        const run =

            (async () => {

                const engine =
                    new StrategyEngine(
                        {

                            strategyFile:
                                "BullionAI.pine",

                            candlesFile:
                                path.relative(
                                    process.cwd(),
                                    ensured.filePath
                                ),

                            resultsFile:

                                `results-${inst.token}-${tf.key.toLowerCase()}.json`,
                        }
                    );


                const output =
                    engine.run();


                const payload = {
                    ok: true,

                    instrument:
                        inst.key,

                    symbol:
                        inst.symbol,

                    name:
                        inst.name,

                    timeframe:
                        tf.key,

                    count:

                        ensured.candles
                            .length,

                    strategy:

                        output.state,
                };


                this.strategyCache.set(
                    cacheKey,
                    {
                        count:

                            ensured
                                .candles
                                .length,

                        lastTime:

                            lastCandle.time,

                        payload,
                    }
                );


                return payload;

            })()


                .catch(
                    error => ({
                        ok: false,

                        instrument:
                            inst.key,

                        symbol:
                            inst.symbol,

                        timeframe:
                            tf.key,

                        error:

                            error?.message ||
                            String(
                                error
                            ),
                    })
                )


                .finally(
                    () => {

                        this.strategyInflight.delete(
                            cacheKey
                        );

                    }
                );


        this.strategyInflight.set(
            cacheKey,
            run
        );


        return run;

    }


    // =========================================================
    // 52-WEEK RANGE (BEST EFFORT)
    //
    // 1. Noren quotes expose week
    //    high/low (wh/wl) — used when
    //    a session is live.
    // 2. Fallback: extremes of the
    //    instrument's stored history.
    //
    // Cached per token for 5 minutes.
    // =========================================================

    async getWeek52(
        inst,
        exchange,
        historyBars
    ) {

        this.w52Cache =
            this.w52Cache ||
            new Map();


        const cached =

            this.w52Cache.get(
                inst.token
            );


        if (

            cached &&
            Date.now() -
                cached.at <
                5 * 60 * 1000

        ) {

            return cached;

        }


        let high = null;
        let low = null;
        let source =
            "history";


        try {

            const market =

                this.coordinator
                    ?.market;


            if (

                market &&
                market.isAuthenticated()

            ) {

                const q =
                    await market.client.getQuotes(
                        {
                            exch:
                                exchange,

                            token:
                                inst.token,
                        }
                    );


                const pick = (

                    obj,
                    keys

                ) => {

                    for (
                        const k of
                            keys
                    ) {

                        const v =
                            Number(
                                obj?.[k]
                            );

                        if (

                            Number.isFinite(
                                v
                            ) &&
                            v > 0

                        ) {

                            return v;

                        }

                    }

                    return null;

                };


                high =
                    pick(
                        q,
                        [
                            "wh",
                            "52h",
                            "weekHigh",
                            "yh",
                        ]
                    );

                low =
                    pick(
                        q,
                        [
                            "wl",
                            "52l",
                            "weekLow",
                            "yl",
                        ]
                    );

                if (
                    high != null &&
                    low != null
                ) {

                    source =
                        "quotes";

                }

            }

        } catch {
            // Quotes unavailable — fall through.
        }


        if (
            high == null ||
            low == null
        ) {

            let h = -Infinity;
            let l = Infinity;

            for (
                const c of
                    historyBars ||
                    []
            ) {

                h = Math.max(
                    h,
                    Number(c.high)
                );

                l = Math.min(
                    l,
                    Number(c.low)
                );

            }


            if (
                Number.isFinite(h)
            ) {

                high = high ?? h;

                low = low ?? l;

            }

        }


        const result = {
            week52High: high,
            week52Low: low,
            source,
            at:
                Date.now(),
        };


        this.w52Cache.set(
            inst.token,
            result
        );


        return result;

    }


    // =========================================================
    // DAY STATS (O/H/L/C + PREV CLOSE)
    //
    // TradingView-style daily figures
    // derived from the instrument's
    // real intraday candles, grouped
    // by exchange-local (IST) date.
    // =========================================================

    async computeDayStats(
        inst
    ) {

        const exchange =
            process.env.SHOONYA_EXCHANGE ||
            "MCX";


        const candidates = [
            "15m",
            "30m",
            "60m",
            "120m",
            "240m",
        ];


        let series = null;


        for (
            const tf of candidates
        ) {

            const p =
                path.resolve(
                    process.cwd(),
                    "data",
                    `${exchange}_${inst.token}_${tf}.json`
                );


            if (
                !fs.existsSync(p)
            ) {
                continue;
            }


            try {

                const parsed =
                    JSON.parse(
                        fs.readFileSync(
                            p,
                            "utf8"
                        )
                    );

                if (

                    Array.isArray(
                        parsed
                    ) &&
                    parsed.length >
                        0

                ) {

                    series =
                        parsed;

                    break;

                }

            } catch {
                continue;
            }

        }


        if (!series) {
            return null;
        }


        const seen =
            new Map();


        for (
            const c of series
        ) {

            if (
                c &&
                Number.isFinite(
                    Number(c.time)
                )
            ) {

                seen.set(
                    Number(c.time),
                    c
                );

            }

        }


        const bars = Array.from(

            seen.values()

        ).sort(
            (a, b) =>
                a.time - b.time
        );


        const istDay =
            t =>

                new Date(t).toLocaleDateString(
                    "en-CA",
                    {
                        timeZone:
                            IST_TIME_ZONE,
                    }
                );


        const dates = [
            ...new Set(

                bars.map(
                    c =>
                        istDay(c.time)
                )

            ),

        ];


        if (
            dates.length === 0
        ) {

            return null;

        }


        const today =
            dates[dates.length - 1];

        const prevDay =

            dates.length > 1

                ? dates[
                      dates.length -
                        2
                  ]

                : null;


        const todays =
            bars.filter(
                c =>
                    istDay(c.time) ===
                    today
            );

        const prevBars =

            prevDay

                ? bars.filter(
                      c =>
                          istDay(
                              c.time
                          ) === prevDay
                  )

                : [];


        if (
            todays.length === 0
        ) {

            return null;

        }


        let high =
            todays[0].high;

        let low =
            todays[0].low;


        for (
            const c of todays
        ) {

            high =
                Math.max(
                    high,
                    c.high
                );

            low =
                Math.min(
                    low,
                    c.low
                );

        }


        const lastToday =

            todays[
                todays.length - 1
            ];

        const lastPrev =

            prevBars.length > 0

                ? prevBars[

                    prevBars
                        .length - 1

                  ].close

                : null;


        const week52 =

            await this.getWeek52(
                inst,
                exchange,
                bars
            );


        return {
            date: today,

            open:
                Number(
                    todays[0].open
                ),

            high:

                Number(high),

            low:
                Number(low),

            close:

                Number(
                    lastToday.close
                ),

            prevClose:

                lastPrev != null

                    ? Number(lastPrev)

                    : null,

            week52High:

                week52?.week52High ??
                null,

            week52Low:

                week52?.week52Low ??
                null,

            range52Source:

                week52?.source ??
                "history",

        };

    }


    // =========================================================
    // LIVE PRICES PER INSTRUMENT
    // =========================================================

    buildLivePrices() {

        const liveMarket =

            this.coordinator
                ?.liveMarket;


        if (!liveMarket) {

            return null;

        }


        const state =
            liveMarket.getState();


        const goldToken =
            String(
                process.env
                    .SHOONYA_GOLD_TOKEN ||
                process.env
                    .SHOONYA_TOKEN ||
                "483079"
            );

        const silverToken =
            String(
                process.env
                    .SHOONYA_SILVER_TOKEN ||
                "471725"
            );


        const prices =

            state.prices ||
            {};


        return {

            connected:
                Boolean(
                    state.connected
                ),

            gold:

                prices[goldToken] ??
                null,

            silver:

                prices[silverToken] ??
                null,

        };

    }


    // =========================================================
    // ENRICH STATE FOR CLIENTS
    // =========================================================

    enrichState(
        state
    ) {

        if (!state) {

            return state;

        }


        return {

            ...state,

            livePrices:

                this.buildLivePrices(),

        };

    }


    // =========================================================
    // SSE HEADERS
    // =========================================================

    setupSse(
        response
    ) {

        response.writeHead(
            200,
            {
                "Content-Type":
                    "text/event-stream",

                "Cache-Control":
                    "no-cache, no-transform",

                "Connection":
                    "keep-alive",

                "Access-Control-Allow-Origin":
                    "*",

                "X-Accel-Buffering":
                    "no",
            }
        );


        response.write(
            ": connected\n\n"
        );
    }


    // =========================================================
    // SEND SSE EVENT
    // =========================================================

    sendSseEvent(
        response,
        event,
        data
    ) {

        response.write(
            `event: ${event}\n`
        );

        response.write(
            `data: ${JSON.stringify(data)}\n\n`
        );
    }


    // =========================================================
    // BROADCAST STATE
    // =========================================================

    broadcastState(
        state
    ) {

        for (
            const client of this.sseClients
        ) {

            try {

                this.sendSseEvent(
                    client,
                    "state",
                    state
                );

            } catch {

                this.sseClients.delete(
                    client
                );
            }
        }
    }


    // =========================================================
    // BROADCAST EVENT
    // =========================================================

    broadcastEvent(
        event,
        data
    ) {

        for (
            const client of this.sseClients
        ) {

            try {

                this.sendSseEvent(
                    client,
                    event,
                    data
                );

            } catch {

                this.sseClients.delete(
                    client
                );
            }
        }
    }


    // =========================================================
    // SSE STREAM
    // =========================================================

    async handleSse(
        request,
        response
    ) {

        await this.startCoordinator();


        this.setupSse(
            response
        );


        this.sseClients.add(
            response
        );


        if (this.state) {

            this.sendSseEvent(
                response,
                "state",
                this.state
            );
        }


        const heartbeat =
            setInterval(
                () => {

                    try {

                        response.write(
                            ": heartbeat\n\n"
                        );

                    } catch {

                        clearInterval(
                            heartbeat
                        );

                        this.sseClients.delete(
                            response
                        );
                    }

                },
                15000
            );


        request.on(
            "close",
            () => {

                clearInterval(
                    heartbeat
                );

                this.sseClients.delete(
                    response
                );

                try {

                    response.end();

                } catch {
                    // Already closed.
                }
            }
        );
    }


    // =========================================================
    // ROUTER
    // =========================================================

    async handleRequest(
        request,
        response
    ) {

        // -----------------------------------------------------
        // CORS PREFLIGHT
        // -----------------------------------------------------

        if (
            request.method ===
            "OPTIONS"
        ) {

            response.writeHead(
                204,
                {
                    "Access-Control-Allow-Origin":
                        "*",

                    "Access-Control-Allow-Methods":
                        "GET, OPTIONS",

                    "Access-Control-Allow-Headers":
                        "Content-Type",
                }
            );

            response.end();

            return;
        }


        const url =
            new URL(
                request.url,
                `http://localhost:${this.port}`
            );


        // -----------------------------------------------------
        // HEALTH
        // -----------------------------------------------------

        if (
            url.pathname ===
            "/health"
        ) {

            this.sendJson(
                response,
                200,
                {
                    ok:
                        true,

                    service:
                        "BullionAI API",

                    timeframe:
                        this.timeframe,

                    started:
                        this.started,

                    sseClients:
                        this.sseClients.size,
                }
            );

            return;
        }


        // -----------------------------------------------------
        // CURRENT STRATEGY + MARKET STATE
        // -----------------------------------------------------

        if (
            url.pathname ===
            "/api/state"
        ) {

            await this.startCoordinator();


            this.sendJson(
                response,
                200,
                this.enrichState(
                    this.state ||
                    this.coordinator.getState()
                )
            );

            return;
        }


        // -----------------------------------------------------
        // HISTORICAL CANDLES
        // -----------------------------------------------------

        if (
            url.pathname ===
            "/api/candles"
        ) {

            try {

                const requestedTimeframe =
                    url.searchParams.get(
                        "timeframe"
                    ) ||
                    this.timeframe;


                const requestedInstrument =
                    url.searchParams.get(
                        "instrument"
                    ) ||
                    "gold";


                const ensured =
                    await this.ensureCandles(
                        requestedInstrument,
                        requestedTimeframe
                    );


                /* Backend-built LIVE forming candle -> continuous series */

                let outCandles = ensured.candles;

                try {

                    const forming = this.aggregator.getForming(
                        ensured.inst.token,
                        ensured.tf.key
                    );

                    if (forming) {
                        const arr = outCandles.slice();
                        const fi = arr.findIndex(
                            c => Number(c.time) === forming.time
                        );
                        if (fi >= 0) arr[fi] = { ...arr[fi], ...forming };
                        else arr.push(forming);
                        arr.sort((a, b) => a.time - b.time);
                        outCandles = arr;
                    }

                } catch {
                    /* never fail the request over the live tail */
                }




                this.sendJson(
                    response,
                    200,
                    {
                        instrument:
                            ensured.inst
                                .key,

                        symbol:
                            ensured.inst
                                .symbol,

                        name:
                            ensured.inst
                                .name,

                        timeframe:
                            ensured.tf
                                .key,

                        exchange:
                            ensured.exchange,

                        token:
                            ensured.inst
                                .token,

                        count:

                            outCandles
                                .length,

                        candles:

                            outCandles,

                        dayStats:

                            await this.computeDayStats(
                                ensured.inst
                            ),
                    }
                );

            } catch (error) {

                this.sendJson(
                    response,
                    404,
                    {
                        ok:
                            false,

                        error:
                            error?.message ||
                            String(error),
                    }
                );
            }

            return;
        }


        // -----------------------------------------------------
        // PINE STRATEGY PER VIEW
        // -----------------------------------------------------

        if (
            url.pathname ===
            "/api/strategy"
        ) {

            try {

                const requestedTimeframe =
                    url.searchParams.get(
                        "timeframe"
                    ) ||
                    this.timeframe;


                const requestedInstrument =
                    url.searchParams.get(
                        "instrument"
                    ) ||
                    "gold";


                const result =
                    await this.runStrategyFor(
                        requestedInstrument,
                        requestedTimeframe
                    );


                this.sendJson(
                    response,
                    200,
                    result
                );

            } catch (error) {

                this.sendJson(
                    response,
                    500,
                    {
                        ok:
                            false,

                        error:
                            error?.message ||
                            String(error),
                    }
                );
            }

            return;
        }


        // -----------------------------------------------------
        // WATCHLIST (BOTH INSTRUMENTS)
        // -----------------------------------------------------

        if (
            url.pathname ===
            "/api/watchlist"
        ) {

            try {

                const rows = [];


                for (
                    const key of [
                        "gold",
                        "silver",
                    ]
                ) {

                    const inst =

                        this.resolveInstrument(
                            key
                        );


                    const liveMarket =

                        this.coordinator
                            ?.liveMarket;


                    let price =
                        null;


                    if (
                        liveMarket
                    ) {

                        const st =
                            liveMarket.getState();


                        const p =

                            st.prices?.[
                                String(
                                    inst.token
                                )
                            ];


                        if (
                            p?.price !=
                            null
                        ) {

                            price =
                                p.price;

                        }

                    }


                    const ds =
                        await this.computeDayStats(
                            inst
                        );


                    const prevClose =

                        ds?.prevClose ??
                        null;


                    const change =

                        price != null &&
                        prevClose !=
                            null

                            ? price -
                              prevClose

                            : null;


                    const changePct =

                        change !=
                            null &&
                        prevClose

                            ? (change /
                                prevClose) *

                              100

                            : null;


                    rows.push({

                        instrument:
                            inst.key,

                        tvName:

                            key ===
                            "gold"

                                ? "GOLD1!"

                                : "SILVER1!",

                        symbol:
                            inst.symbol,

                        name:
                            inst.name,

                        price,

                        open:

                            ds?.open ??
                            null,

                        dayHigh:

                            ds?.high ??
                            null,

                        dayLow:

                            ds?.low ??
                            null,

                        prevClose,

                        change,

                        changePct,

                    });

                }


                this.sendJson(
                    response,
                    200,
                    { rows }
                );

            } catch (
                error
            ) {

                this.sendJson(
                    response,
                    500,
                    {
                        ok: false,

                        error:

                            error?.message ||
                            String(
                                error
                            ),
                    }
                );

            }

            return;
        }


        // -----------------------------------------------------
        // SSE STREAM
        // -----------------------------------------------------

        if (
            url.pathname ===
            "/api/stream"
        ) {

            await this.handleSse(
                request,
                response
            );

            return;
        }


        // -----------------------------------------------------
        // NOT FOUND
        // -----------------------------------------------------

        this.sendJson(
            response,
            404,
            {
                ok:
                    false,

                error:
                    "Route not found.",
            }
        );
    }


    // =========================================================
    // START SERVER
    // =========================================================

    async start() {

        /*
         * IMPORTANT:
         *
         * The coordinator (Shoonya auth + live feed)
         * starts in the background.
         *
         * The HTTP server listens immediately so
         * /health and /api/candles work without
         * waiting for an interactive login.
         */

        this.startCoordinator().catch(
            error => {

                console.error(
                    "Coordinator startup pending:",
                    error?.message ||
                    error
                );

            }
        );


        this.server =
            http.createServer(
                async (
                    request,
                    response
                ) => {

                    try {

                        await this.handleRequest(
                            request,
                            response
                        );

                    } catch (error) {

                        console.error(
                            "API error:",
                            error
                        );


                        if (
                            !response.headersSent
                        ) {

                            this.sendJson(
                                response,
                                500,
                                {
                                    ok:
                                        false,

                                    error:
                                        error?.message ||
                                        String(error),
                                }
                            );

                        } else {

                            try {

                                response.end();

                            } catch {
                                // Ignore.
                            }
                        }
                    }
                }
            );


        await new Promise(
            (
                resolve,
                reject
            ) => {

                this.server.once(
                    "error",
                    reject
                );


                this.server.listen(
                    this.port,
                    "0.0.0.0",
                    () => {

                        resolve();
                    }
                );
            }
        );


        console.log("");

        console.log(
            "===================================="
        );

        console.log(
            "       BULLIONAI API READY"
        );

        console.log(
            "===================================="
        );

        console.log(
            "Port:",
            this.port
        );

        console.log(
            "Timeframe:",
            this.timeframe
        );

        console.log(
            "Health:",
            `http://localhost:${this.port}/health`
        );

        console.log(
            "State:",
            `http://localhost:${this.port}/api/state`
        );

        console.log(
            "Candles:",
            `http://localhost:${this.port}/api/candles?timeframe=${this.timeframe}`
        );

        console.log(
            "SSE:",
            `http://localhost:${this.port}/api/stream`
        );

        console.log(
            "===================================="
        );
    }


    // =========================================================
    // STOP
    // =========================================================

    async stop() {

        for (
            const client of this.sseClients
        ) {

            try {

                client.end();

            } catch {
                // Ignore.
            }
        }


        this.sseClients.clear();


        try {

            await this.coordinator.stop();

        } catch {
            // Ignore coordinator shutdown errors.
        }


        if (
            this.server
        ) {

            await new Promise(
                resolve => {

                    this.server.close(
                        () => {

                            resolve();
                        }
                    );
                }
            );
        }


        this.server =
            null;

        this.started =
            false;
    }
}


// =============================================================
// MAIN
// =============================================================

async function main() {

    const timeframe =
        process.argv[2] ||
        "15m";


    const port =
        Number(
            process.env.BULLIONAI_API_PORT
        ) ||
        8787;


    const api =
        new BullionAIApi({
            timeframe,
            port,
        });


    global.__bullionaiApi =
        api;


    const shutdown =
        async () => {

            console.log("");

            console.log(
                "Stopping BullionAI API..."
            );


            await api.stop();


            process.exit(
                0
            );
        };


    process.on(
        "SIGINT",
        shutdown
    );

    process.on(
        "SIGTERM",
        shutdown
    );


    try {

        await api.start();

    } catch (error) {

        console.error("");

        console.error(
            "BULLIONAI API FAILED:"
        );

        console.error(
            error?.message ||
            error
        );

        process.exitCode =
            1;
    }
}


if (
    require.main ===
    module
) {

    main();
}


module.exports = {
    BullionAIApi,
};
