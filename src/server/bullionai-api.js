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
    registerUser,
    loginUser,
    signToken,
    verifyToken,
    readBody,
} = require("../auth/users");

const {
    searchSymbols,
} = require("../market/symbol-master");

const {
    CandleDataManager,
} = require("../market/candle-data-manager");

const {
    isShoonyaAuthFailure,
} = require("../market/market-data-service");

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

        /*
         * No default instruments: every script
         * enters the system through the search
         * box (/api/symbols -> /api/subscribe).
         */

        this.aggregator =
            new CandleAggregator({

                instruments: [],

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
         * Instruments explicitly added by the
         * user (search box). Drives live
         * reconciliation — nothing is
         * reconciled until it is added here.
         */

        this.activeInstruments =
            new Map();


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


        this.dynStores = new Map();

        this.reconcileTimer =
            null;

        this.reconcileRetryMs = 30_000;

        /*
         * Set when Shoonya rejects the session
         * during reconciliation; blocks further
         * historical calls until a valid
         * session exists again.
         */

        this.reconcilePaused =
            false;

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
                    "GET, POST, OPTIONS",

                "Access-Control-Allow-Headers":
                    "Content-Type, Authorization",
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

    getStore(exchange, token) {

        if (String(token) === "483079") return GOLD_STORE;
        if (String(token) === "471725") return SILVER_STORE;

        const key = `${exchange}_${token}`;

        if (!this.dynStores.has(key)) {
            this.dynStores.set(
                key,
                new CandleDataManager({
                    dataDirectory: "./data",
                    exchange,
                    token: String(token),
                })
            );
        }

        return this.dynStores.get(key);
    }

    getMarketService() {
        return (
            this.coordinator?.market
        ) ?? null;
    }

    async reconcileTimeframe(instrumentKey, timeframeKey) {
        const market = this.getMarketService();
        if (!market || !market.isAuthenticated()) {
            return { ok: false, reason: "no-session" };
        }

        /*
         * Accept either a resolved instrument object
         * (user-added scripts) or a legacy key.
         */

        const inst =
            typeof instrumentKey === "object" &&
            instrumentKey !== null
                ? {
                      key:
                          instrumentKey.key ??
                          String(instrumentKey.token),

                      symbol: instrumentKey.symbol ?? null,

                      exchange: instrumentKey.exchange,

                      token: instrumentKey.token,
                  }
                : this.resolveInstrument(
                      instrumentKey
                  );

        const tf = getTimeframe(timeframeKey);

        if (!Number.isFinite(Number(tf.interval))) {
            return { ok: false, reason: "non-minute" };
        }

        const store = this.getStore(
                inst.exchange ?? "MCX",
                inst.token
            );
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

            if (
                isShoonyaAuthFailure(
                    error
                )
            ) {

                console.error(
                    "[reconcile] Shoonya rejected the session (" +
                        (error?.message || error) +
                        ") - pausing reconciliation."
                );

                return {
                    ok: false,
                    authRejected: true,
                };

            }

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

        const market =
            this.getMarketService();

        /*
         * Never hammer Shoonya with a session
         * it has already rejected. Resume only
         * once the shared session state is
         * authenticated again.
         */

        if (
            this.reconcilePaused &&
            !market?.isAuthenticated()
        ) {

            console.log(
                "[reconcile:" +
                    label +
                    "] skipped - waiting for a valid Shoonya session."
            );

            return false;

        }

        if (
            this.reconcilePaused &&
            market?.isAuthenticated()
        ) {

            this.reconcilePaused =
                false;

            console.log(
                "[reconcile:" +
                    label +
                    "] session restored - resuming reconciliation."
            );

        }

        console.log(
            "[reconcile:" +
                label +
                "] starting..."
        );

        try {

            let changedAny = false;

        /*
         * Only user-added scripts are reconciled.
         * Nothing is pre-seeded by default.
         */

        const actives =
            [
                ...(this.activeInstruments?.values() || []),
            ];

        if (
            actives.length === 0
        ) {

            console.log(
                "[reconcile:" +
                    label +
                    "] no scripts added yet - nothing to reconcile"
            );

            return true;

        }

        outer:
        for (const inst of actives) {
            for (const tf of ["15m", "30m", "45m", "60m", "120m", "240m"]) {
                const r = await this.reconcileTimeframe(inst, tf).catch(() => ({ ok: false }));

                if (r.authRejected) {

                    this.reconcilePaused = true;

                    /*
                     * Route through the coordinator so the SAME
                     * invalidation + re-login flow used by the
                     * WebSocket also runs here — exactly one
                     * authentication state for everything.
                     */

                    this.coordinator
                        .handleAuthFailure()
                        .catch(() => {});

                    break outer;

                }

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

        const instrumentConfigs = {
            silver: {
                key: "silver",
                name: "Silver Mega",
                symbol: process.env.SHOONYA_SILVER_SYMBOL || "SILVER04SEP26",
                token: process.env.SHOONYA_SILVER_TOKEN || "471725",
            },
            copper: {
                key: "copper",
                name: "Copper Mega",
                symbol: process.env.SHOONYA_COPPER_SYMBOL || "COPPER30SEP26",
                token: process.env.SHOONYA_COPPER_TOKEN || "483080",
            },
            lead: {
                key: "lead",
                name: "Lead Mega",
                symbol: process.env.SHOONYA_LEAD_SYMBOL || "LEAD30SEP26",
                token: process.env.SHOONYA_LEAD_TOKEN || "483081",
            },
            natural_gas: {
                key: "natural_gas",
                name: "Natural Gas Mega",
                symbol: process.env.SHOONYA_NATURAL_GAS_SYMBOL || "NATURALGAS28SEP26",
                token: process.env.SHOONYA_NATURAL_GAS_TOKEN || "483082",
            },
            zinc: {
                key: "zinc",
                name: "Zinc Mega",
                symbol: process.env.SHOONYA_ZINC_SYMBOL || "ZINC30SEP26",
                token: process.env.SHOONYA_ZINC_TOKEN || "483083",
            },
            nickel: {
                key: "nickel",
                name: "Nickel Mega",
                symbol: process.env.SHOONYA_NICKEL_SYMBOL || "NICKEL30SEP26",
                token: process.env.SHOONYA_NICKEL_TOKEN || "483084",
            },
            crude_oil: {
                key: "crude_oil",
                name: "Crude Oil Mega",
                symbol: process.env.SHOONYA_CRUDE_OIL_SYMBOL || "CRUDEOIL19SEP26",
                token: process.env.SHOONYA_CRUDE_OIL_TOKEN || "483085",
            },
        };

        if (instrumentConfigs[key]) {
            return instrumentConfigs[key];
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

        let notice = null;


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
        timeframeKey,
        instOverride
    ) {

        const inst =
            instOverride ??
            this.resolveInstrument(
                instrumentKey
            );

        const tf =
            getTimeframe(
                timeframeKey
            );


        const exchange =
            inst.exchange ||
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

            /* EMPTY DATASET BACKFILL
             *
             * Brand-new symbol: pull initial history
             * from Shoonya before serving.
             */

            if (
                candles.length === 0 &&
                market &&
                market.isAuthenticated() &&
                Number.isFinite(Number(tf.interval))
            ) {
                try {
                    const upd = await market.updateCandles([], {
                        interval: tf.interval,
                        exchange: inst.exchange || "MCX",
                        token: inst.token,
                        lookbackSeconds:
                            tf.seconds > 3600
                                ? 30 * 86400
                                : 7 * 86400,
                    });

                    if (upd.candles.length > 0) {
                        fs.writeFileSync(
                            filePath,
                            JSON.stringify(upd.candles, null, 2),
                            "utf8"
                        );

                        console.log(
                            "[ensure] backfilled " +
                                inst.symbol +
                                " " + tf.key +
                                " -> " + upd.candles.length + " candles"
                        );

                        candles = upd.candles;
                    }
                } catch (error) {
                    console.error(
                        "[ensure] backfill failed " + fileName + ":",
                        error?.message || error
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

            /* Tell the UI why nothing rendered */
            if (
                candles.length === 0 &&
                market &&
                market.isAuthenticated()
            ) {
                notice =
                    "No historical data returned by Shoonya for " +
                    (inst.symbol || inst.token) +
                    " (" + tf.key + "). This script may be illiquid or unsupported.";
            }

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
                exchange:
                    inst.exchange ||
                    "MCX",
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

                        exchange:
                            inst.exchange ||
                            "MCX",

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
        timeframeKey,
        instOverride
    ) {

        const ensured =
            await this.ensureCandles(
                instrumentKey,
                timeframeKey,
                instOverride
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

            /* every subscribed token, keyed by token */

            ...prices,

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
        }        // -----------------------------------------------------
        // SHOONYA LOGIN (redirect URL via browser/HTTP)
        //
        // Fallback for hosts where the interactive
        // console prompt cannot read stdin.
        //
        //   GET  /api/shoonya/login              -> HTML form
        //   GET  /api/shoonya/login?url=<enc>    -> login
        //   POST /api/shoonya/login              -> {"redirectUrl": "..."}
        // -----------------------------------------------------

        if (
            url.pathname ===
            "/api/shoonya/login"
        ) {

            try {

                let redirectUrl =
                    url.searchParams.get(
                        "url"
                    ) || "";


                if (
                    !redirectUrl &&
                    request.method === "POST"
                ) {

                    const body =
                        await readBody(request);

                    redirectUrl =
                        String(
                            body?.redirectUrl ||
                            body?.url ||
                            ""
                        );

                }


                if (
                    !redirectUrl
                ) {

                    /*
                     * No URL supplied: serve a minimal
                     * paste form so this can be used
                     * directly from a browser.
                     */

                    const html =
                        "<!doctype html>" +
                        '<html><head><meta charset="utf-8">' +
                        "<title>Shoonya Login</title></head>" +
                        '<body style="font-family:sans-serif;max-width:720px;margin:48px auto">' +
                        "<h2>Shoonya Login</h2>" +
                        "<p>Paste the fresh Shoonya redirect URL below.</p>" +
                        '<form method="GET" action="/api/shoonya/login">' +
                        '<input name="url" style="width:80%;padding:8px" ' +
                        'placeholder="https://...?code=..." autofocus>' +
                        ' <button style="padding:8px 16px">Login</button>' +
                        "</form></body></html>";

                    response.writeHead(
                        200,
                        {
                            "Content-Type":
                                "text/html; charset=utf-8",

                            "Cache-Control":
                                "no-cache",
                        }
                    );

                    response.end(html);

                    return;

                }


                const sessionState =

                    await this.coordinator.loginWithRedirectUrl(
                        redirectUrl
                    );


                this.sendJson(
                    response,
                    200,
                    {
                        ok:
                            true,

                        session:
                            sessionState,
                    }
                );

            } catch (
                error
            ) {

                console.error(
                    "HTTP Shoonya login failed:",
                    error?.message ||
                    error
                );

                this.sendJson(
                    response,
                    400,
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

        if (
            url.pathname === "/api/subscribe" &&
            request.method === "POST"
        ) {
            try {
                const body = await readBody(request);
                const exch = String(body.exchange || body.exch || "MCX").toUpperCase();
                const token = String(body.token || body.Token || "");
                if (!token) throw new Error("token required");

                const key = `${exch}_${token}`;

                /* Removals first */
                for (const rm of body.unsubscribe || []) {
                    const rmExch = String(rm.exchange || rm.exch || "MCX").toUpperCase();
                    this.activeInstruments.delete(`${rmExch}_${String(rm.token)}`);
                    this.aggregator.removeInstrument?.(
                        String(rm.exchange || rm.exch || "MCX").toUpperCase(),
                        String(rm.token)
                    );
                }

                /* Feed subscription */
                const live = this.coordinator?.liveMarket;
                if (live?.subscribeTokens) {
                    live.subscribeTokens([{ exch, token }]);
                }

                /* Aggregation bucket routing */
                this.aggregator.addInstrument({
                    key: body.tsym || body.tradingSymbol || token,
                    token,
                    exchange: exch,
                });

                /* Reconciliation tracking (search-box additions only) */
                this.activeInstruments.set(key, { exchange: exch, token });

                this.sendJson(response, 200, { ok: true });
            } catch (error) {
                this.sendJson(response, 400, {
                    ok: false,
                    error: error?.message || String(error),
                });
            }
            return;
        }


        if (
            url.pathname === "/api/instruments"
        ) {

            const exch =
                url.searchParams.get("exchange") || "MCX";

            const q =
                url.searchParams.get("q") || "";

            const limit =
                Math.min(200, Number(url.searchParams.get("limit")) || 100);

            try {

                const rows = await searchSymbols({
                    query: q,
                    exchange: exch,
                    limit,
                });

                this.sendJson(response, 200, {
                    ok: true,
                    exchange: exch.toUpperCase(),
                    count: rows.length,
                    instruments: rows.map(r => ({
                        exchange: r.exchange,
                        token: r.token,
                        symbol: r.symbol,
                        tradingSymbol: r.tsym || r.tradingSymbol,
                        instrumentType: r.instrumentType,
                        name: r.name || "",
                        expiry: r.expiry ?? null,
                        lotSize: r.lotSize,
                        tickSize: r.tickSize,
                    })),
                });

            } catch (error) {
                this.sendJson(response, 500, {
                    ok: false,
                    error: error?.message || String(error),
                });
            }
            return;
        }

        if (
            url.pathname === "/api/symbols"
        ) {
            const q = url.searchParams.get("q") || "";
            const exch = url.searchParams.get("exchange") || null;
            const limit = Math.min(60, Number(url.searchParams.get("limit")) || 30);
            try {
                const rows = await searchSymbols({ query: q, exchange: exch, limit });
                this.sendJson(response, 200, { ok: true, count: rows.length, symbols: rows });
            } catch (error) {
                this.sendJson(response, 500, { ok: false, error: error?.message || String(error) });
            }
            return;
        }



        // -----------------------------------------------------
        // -----------------------------------------------------
        // EMAIL AUTH
        // -----------------------------------------------------

        if (
            url.pathname === "/api/auth/register" &&
            request.method === "POST"
        ) {
            try {
                const body = await readBody(request);
                const user = registerUser(body);
                this.sendJson(response, 200, {
                    ok: true,
                    token: signToken(user.email),
                    user,
                });
            } catch (error) {
                this.sendJson(response, 400, {
                    ok: false,
                    error: error?.message || String(error),
                });
            }
            return;
        }

        if (
            url.pathname === "/api/auth/login" &&
            request.method === "POST"
        ) {
            try {
                const body = await readBody(request);
                const user = loginUser(body);
                this.sendJson(response, 200, {
                    ok: true,
                    token: signToken(user.email),
                    user,
                });
            } catch (error) {
                this.sendJson(response, 401, {
                    ok: false,
                    error: error?.message || String(error),
                });
            }
            return;
        }

        if (
            url.pathname === "/api/auth/me"
        ) {
            const header =
                request.headers.authorization || "";
            const token = header.startsWith("Bearer ")
                ? header.slice(7)
                : null;
            const data = verifyToken(token);
            if (!data) {
                this.sendJson(response, 401, {
                    ok: false,
                    error: "Invalid or expired session.",
                });
                return;
            }
            this.sendJson(response, 200, {
                ok: true,
                email: data.email,
            });
            return;
        }

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

                const reqExch =
                    url.searchParams.get("exchange");

                const reqToken =
                    url.searchParams.get("token");

                const reqTsym =
                    url.searchParams.get("tsym");

                const instOverride =
                    reqExch && reqToken
                        ? {
                              key: reqTsym || (reqExch + "_" + reqToken),
                              token: String(reqToken),
                              symbol: reqTsym || String(reqToken),
                              name: reqTsym || String(reqToken),
                              exchange: reqExch.toUpperCase(),
                          }
                        : undefined;


                const ensured =
                    await this.ensureCandles(
                        requestedInstrument,
                        requestedTimeframe,
                        instOverride
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

                        notice:
                            ensured.notice ?? null,

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

                const _ex =
                    url.searchParams.get("exchange");

                const _tk =
                    url.searchParams.get("token");

                const _ts =
                    url.searchParams.get("tsym");

                const instOverride = _ex && _tk ? {
                    key: _ts || (_ex + "_" + _tk),
                    token: String(_tk),
                    symbol: _ts || String(_tk),
                    name: _ts || String(_tk),
                    exchange: _ex.toUpperCase(),
                } : undefined;

                const result =
                    await this.runStrategyFor(
                        requestedInstrument,
                        requestedTimeframe,
                        instOverride
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
        // WATCHLIST ROUTE REMOVED
        //
        // There are no default scripts anymore.
        // The UI watchlist is built exclusively from
        // user-added scripts (search box ->
        // /api/subscribe) and live SSE prices.
        // -----------------------------------------------------


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
