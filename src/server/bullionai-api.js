require("dotenv").config();

const http = require("http");
const fs = require("fs");
const path = require("path");

const {
    BullionAILiveCoordinator,
} = require("../runner/bullionai-live-coordinator");

const {
    getMarketStatus,
} = require("../market/segment-config");

const {
    fetchYahooHistory,
    toYahooSymbol,
} = require("../market/yahoo-history");

const {
    StrategyEngine,
} = require("../strategy/strategy-engine");

const {
    TradeEngine,
} = require("../strategy/trade-engine");

const {
    latestSignal,
    generateSignalSeries,
} = require("../strategy/signal-engine");

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

const {
    getRolloverDate,
    shouldRollover,
    getStitchedCandles,
    stitchWithBackAdjust,
    getCandlesWithPreviousFallback,
} = require("../market/rollover-manager");

const {
    getRegistry,
    getRawExchangeRows,
} = require("../market/symbol-master");

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
            Number(process.env.PORT) || Number(port) || 8787;

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

        /*
         * Phase 4: JS-native signal + trade engines (multi-segment,
         * per exchange:symbol:timeframe). These are the authoritative
         * source for the segment-aware information centre.
         */

        this.tradeEngine =
            new TradeEngine();

        // instrumentKey -> { exchange, symbol, token, timeframe, signal, lastCandleTime }
        this.jsSignals =
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
            "1m",
            "3m",
            "5m",
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

        const storeFor = (exchange, token) => {
            const exch = String(exchange || "MCX").toUpperCase();
            const t = String(token);
            // Dedicated stores for the default gold/silver datasets.
            if (t === "483079") return goldStore;
            if (t === "471725") return silverStore;
            // Dynamic per-symbol store (also used by getStore()).
            const key = `${exch}_${t}`;
            if (!this.dynStores.has(key)) {
                this.dynStores.set(
                    key,
                    new CandleDataManager({
                        dataDirectory: "./data",
                        exchange: exch,
                        token: t,
                    })
                );
            }
            return this.dynStores.get(key);
        };

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
                        storeFor(
                            exchange,
                            token
                        ).upsertCandle(
                            tfKey,
                            candle
                        ),

                },

                // Incremental candle events -> SSE (phase 2)
                onCandleUpdate: (
                    ev
                ) =>
                    this.broadcastEvent(
                        "candle_update",
                        this.segmentEvent("candle", ev)
                    ),

                onCandleClose: (
                    ev
                ) =>
                    this.broadcastEvent(
                        "candle_close",
                        this.segmentEvent("candle", ev)
                    ),

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
                tick => {
                    this.aggregator.onTick(
                        tick
                    );
                    this.emitTickEvent(
                        tick
                    );
                }
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
                    "GET, POST, PUT, DELETE, OPTIONS",

                "Access-Control-Allow-Headers":
                    "Content-Type, Authorization, X-Admin-Key, X-Admin-Token",
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

            // Already starting (in the background). Do not block the
            // caller waiting on it — serve whatever state exists now.
            return;

        }


        this.coordinatorStartPromise =

            this.doStartCoordinator()


                .catch(
                    error => {

                        console.error(
                            "[coordinator] start failed:",
                            error?.message || error
                        );

                        this.coordinatorStartPromise =
                            null;

                    }
                );


        /*
         * Do NOT await the coordinator here. Starting the coordinator
         * can block while waiting for a Shoonya session; if we awaited it
         * the API endpoints would hang and the browser would report
         * "failed to fetch" / CORS-timeout errors. Kick it off in the
         * background and let it populate this.state whenconnected.
         */
        return;

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

                // Incremental strategy/signal/trade event so the frontend
                // updates the info centre without waiting for a full state.
                const st =
                    state?.strategy ??
                    null;
                this.broadcastEvent(
                    "strategy",
                    this.segmentEvent(
                        "strategy",
                        {
                            signal:
                                st?.signal ??
                                null,
                            status:
                                st?.status ??
                                null,
                            entryPrice:
                                st?.entryPrice ??
                                null,
                            trailSL:
                                st?.trailSL ??
                                null,
                            currentPL:
                                st?.currentPL ??
                                null,
                            bestPL:
                                st?.bestPL ??
                                null,
                            realizedPL:
                                st?.realizedPL ??
                                null,
                            entryTime:
                                st?.entryTime ??
                                null,
                            exitTime:
                                st?.exitTime ??
                                null,
                        }
                    )
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

                this.broadcastEvent(
                    "connection_status",
                    this.segmentEvent(
                        "connection_status",
                        {
                            connected: true,
                            status: "connected",
                            message:
                                "Shoonya market feed connected",
                        }
                    )
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

                this.broadcastEvent(
                    "connection_status",
                    this.segmentEvent(
                        "connection_status",
                        {
                            connected: false,
                            status: "disconnected",
                            message:
                                "Shoonya market feed disconnected",
                        }
                    )
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

        // Wire all MCX current contracts into the live candle builder
        // so they accumulate history autonomously during market hours.
        this.bootstrapMCXContracts().catch(() => {});

        // Detect and execute any pending contract rollover at boot.
        this.rolloverAllActive("startup").catch(() => {});

        // Prime the JS segment snapshot so /api/state + event stream
        // carry segment signal/trade data immediately.
        this.refreshSegmentSnapshot().catch(() => {});

        // Attempt an immediate missing-history backfill pass.
        this.retryMissingBackfill("startup").catch(() => {});
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
                // Runtime contract rollover check for contract-based segments.
                this.rolloverAllActive("periodic").catch(() => {});
                // Recompute the JS signal/trade segment snapshot.
                this.refreshSegmentSnapshot().catch(() => {});
            }
        }, 5 * 60 * 1000);
        this.periodicTimer.unref?.();

        // Aggressive missing-history retry: re-attempt the Shoonya backfill
        // for any script with no data yet, so it populates as soon as
        // Shoonya's historical endpoint unblocks.
        if (!this.missingRetryTimer) {
            this.missingRetryTimer = setInterval(() => {
                const result = this.retryMissingBackfill("retry").catch(() => ({ attempted: 0, filled: 0 }));
                if (result) result.then?.(() => {});
            }, 2 * 60 * 1000);
            this.missingRetryTimer.unref?.();
        }
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

        // Fall back to env/config when auto-resolution finds nothing.
        const instrumentConfigs = {
            silver: {
                key: "silver",
                name: "Silver Mega",
                // root symbol used to match the current contract in the registry
                rootSymbol: "SILVER",
                exchange: process.env.SHOONYA_EXCHANGE || "MCX",
                symbol: process.env.SHOONYA_SILVER_SYMBOL || "SILVER04SEP26",
                token: process.env.SHOONYA_SILVER_TOKEN || "471725",
            },
            copper: {
                key: "copper",
                name: "Copper Mega",
                rootSymbol: "COPPER",
                exchange: process.env.SHOONYA_EXCHANGE || "MCX",
                symbol: process.env.SHOONYA_COPPER_SYMBOL || "COPPER30SEP26",
                token: process.env.SHOONYA_COPPER_TOKEN || "483080",
            },
            lead: {
                key: "lead",
                name: "Lead Mega",
                rootSymbol: "LEAD",
                exchange: process.env.SHOONYA_EXCHANGE || "MCX",
                symbol: process.env.SHOONYA_LEAD_SYMBOL || "LEAD30SEP26",
                token: process.env.SHOONYA_LEAD_TOKEN || "483081",
            },
            natural_gas: {
                key: "natural_gas",
                name: "Natural Gas Mega",
                rootSymbol: "NATURALGAS",
                exchange: process.env.SHOONYA_EXCHANGE || "MCX",
                symbol: process.env.SHOONYA_NATURAL_GAS_SYMBOL || "NATURALGAS28SEP26",
                token: process.env.SHOONYA_NATURAL_GAS_TOKEN || "483082",
            },
            zinc: {
                key: "zinc",
                name: "Zinc Mega",
                rootSymbol: "ZINC",
                exchange: process.env.SHOONYA_EXCHANGE || "MCX",
                symbol: process.env.SHOONYA_ZINC_SYMBOL || "ZINC30SEP26",
                token: process.env.SHOONYA_ZINC_TOKEN || "483083",
            },
            nickel: {
                key: "nickel",
                name: "Nickel Mega",
                rootSymbol: "NICKEL",
                exchange: process.env.SHOONYA_EXCHANGE || "MCX",
                symbol: process.env.SHOONYA_NICKEL_SYMBOL || "NICKEL30SEP26",
                token: process.env.SHOONYA_NICKEL_TOKEN || "483084",
            },
            crude_oil: {
                key: "crude_oil",
                name: "Crude Oil Mega",
                rootSymbol: "CRUDEOIL",
                exchange: process.env.SHOONYA_EXCHANGE || "MCX",
                symbol: process.env.SHOONYA_CRUDE_OIL_SYMBOL || "CRUDEOIL19SEP26",
                token: process.env.SHOONYA_CRUDE_OIL_TOKEN || "483085",
            },
            gold: {
                key: "gold",
                name: "Gold Mega",
                rootSymbol: "GOLD",
                exchange: process.env.SHOONYA_EXCHANGE || "MCX",
                symbol:
                    process.env.SHOONYA_GOLD_SYMBOL ||
                    process.env.SHOONYA_TOKEN ||
                    "GOLD05OCT26",
                token:
                    process.env.SHOONYA_GOLD_TOKEN ||
                    process.env.SHOONYA_TOKEN ||
                    "483079",
            },
        };

        const cfg =
            instrumentConfigs[key] ||
            instrumentConfigs.gold;

        return cfg;

    }


    // =========================================================
    // AUTO-RESOLVE CURRENT CONTRACT (not hardcoded)
    //
    // Queries the live registry (SymbolMaster.getRegistry), which already
    // selects the CURRENT active contract per root symbol based on expiry
    // (nearest expiry beyond the rollover buffer). Returns the current
    // contract's token/symbol/expiry so the app never hardcodes an expiry.
    // Falls back to the env/default config if the registry is unavailable.
    // =========================================================

    async resolveCurrentContract(
        instrument
    ) {

        const cfg =
            this.resolveInstrument(
                instrument
            );

        const exchange =
            cfg.exchange ||
            process.env.SHOONYA_EXCHANGE ||
            "MCX";

        try {

            const rows =
                await getRegistry(
                    exchange
                ).catch(
                    () => []
                );

            if (Array.isArray(rows) && rows.length) {

                const root =
                    String(
                        cfg.rootSymbol ||
                        cfg.symbol ||
                        ""
                    )
                        .trim()
                        .toUpperCase();

                // Match by root symbol (symbol/tradingSymbol prefix).
                const match =
                    rows.find(
                        r =>
                            String(
                                r.symbol ||
                                r.tradingSymbol ||
                                ""
                            )
                                .trim()
                                .toUpperCase() === root
                    ) ||
                    rows.find(
                        r =>
                            String(
                                r.symbol ||
                                r.tradingSymbol ||
                                ""
                            )
                                .trim()
                                .toUpperCase()
                                .startsWith(root)
                    );

                if (match) {

                    return {
                        key: cfg.key,
                        name: cfg.name,
                        exchange,
                        symbol: match.symbol || match.tradingSymbol || cfg.symbol,
                        token: String(match.token || cfg.token),
                        expiry: match.expiry ?? null,
                        expiryText: match.expiryText ?? null,
                        rootSymbol: root,
                        instrumentType: match.instrumentType ?? null,
                        lotSize: match.lotSize ?? null,
                        tickSize: match.tickSize ?? null,
                        resolved: "registry",
                    };

                }

            }

        } catch (error) {
            console.error(
                `[contract] resolve ${cfg.key} failed:`,
                error?.message || error
            );
        }

        // Registry lookup failed -> use the configured/current default.
        return {
            key: cfg.key,
            name: cfg.name,
            exchange,
            symbol: cfg.symbol,
            token: String(cfg.token),
            expiry: null,
            expiryText: null,
            rootSymbol: cfg.rootSymbol || null,
            instrumentType: null,
            lotSize: null,
            tickSize: null,
            resolved: "default",
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
    // LIVE-FIRST SUBSCRIPTION
    //
    // Guarantees any requested script is subscribed to the
    // Shoonya WebSocket feed and routed into the candle
    // aggregator. Ticks then build OHLCV buckets and completed
    // candles persist to disk — a reliable source that does not
    // depend on the (sometimes unavailable) historical endpoint.
    // =========================================================

    ensureLiveSubscription(inst) {
        const exch =
            String(inst.exchange || "MCX").toUpperCase();
        const token = String(inst.token);

        if (!token) return;

        const key = `${exch}_${token}`;

        // Track for background reconciliation of live-formed data.
        if (!this.activeInstruments.has(key)) {
            this.activeInstruments.set(key, { exchange: exch, token });
        }

        // Route ticks into the candle aggregator for every TF.
        try {
            this.aggregator.addInstrument({
                key: inst.key || inst.symbol || token,
                token,
                exchange: exch,
            });
        } catch {
            // already registered is fine
        }

        // Subscribe the token on the live WebSocket feed.
        const live = this.coordinator?.liveMarket;
        if (live?.subscribeTokens) {
            live.subscribeTokens([{ exch, token }]);
        }
    }

    // =========================================================
    // LIVE ACCUMULATION BOOTSTRAP
    //
    // Subscribes every MCX current contract to the live feed +
    // aggregator so their candle datasets build automatically from
    // ticks during market hours — even for symbols Shoonya's
    // historical endpoint won't backfill. Also registers them for
    // periodic reconciliation.
    // =========================================================

    async bootstrapMCXContracts() {
        try {
            const registry =
                await getRegistry("MCX").catch(() => []);
            let wired = 0;
            for (const row of registry) {
                if (!row?.token) continue;
                this.ensureLiveSubscription({
                    key: row.symbol || row.tradingSymbol || row.token,
                    symbol: row.symbol || row.tradingSymbol,
                    name: row.name || row.tradingSymbol,
                    token: row.token,
                    exchange: "MCX",
                });
                wired++;
            }
            console.log(
                `[boot] wired ${wired} MCX contracts into live candle build`
            );
            return wired;
        } catch (error) {
            console.error(
                "[boot] MCX contract bootstrap failed:",
                error?.message || error
            );
            return 0;
        }
    }

    // =========================================================
    // RUNTIME CONTRACT ROLLOVER
    //
    // For contract-based segments (MCX derivatives), periodically
    // checks whether the currently subscribed contract should roll
    // to the next expiry. On rollover:
    //
    //   OLD CONTRACT -> STOP SUBSCRIPTION
    //                -> RESOLVE NEW CONTRACT
    //                -> LOAD/CONTINUE HISTORY
    //                -> START NEW WEBSOCKET SUBSCRIPTION
    //                -> CONTINUE SIGNAL ENGINE
    //                -> EMIT contract_change
    //
    // Never mixes two contracts into one live series; the old token
    // is unsubscribed and removed from the aggregator before the new
    // one is added.
    // =========================================================

    async handleRolloverForInstrument(exchange, token) {
        const exch = String(exchange || "MCX").toUpperCase();
        if (!token) return { rolled: false };

        // Only contract-based segments roll (MCX futures etc.).
        const live = this.coordinator?.liveMarket;
        const rows = await getRegistry(exch).catch(() => []);
        const cur = rows.find(r => String(r.token) === String(token));
        if (!cur || !cur.expiry) return { rolled: false };

        const decision = await shouldRollover({
            exchange: exch,
            token,
            getRegistry,
            market: this.coordinator?.market,
        }).catch(() => ({ roll: false }));

        if (!decision?.roll || !decision.next) {
            return { rolled: false };
        }

        const next = decision.next;
        const newKey = `${exch}_${next.token}`;
        const oldKey = `${exch}_${token}`;

        console.log(
            `[CONTRACT] ${exch} ${cur.tradingSymbol || cur.symbol} (${token}) -> ` +
                `rolling to ${next.tradingSymbol || next.symbol} (${next.token}) ` +
                `[${decision.reason}]`
        );

        // 1. Stop old subscription.
        if (live?.unsubscribeTokens) {
            live.unsubscribeTokens([{ exch, token: String(token) }]);
        }
        try {
            this.aggregator.removeInstrument(exch, token);
        } catch {}
        this.activeInstruments.delete(oldKey);

        // Clear any cached strategy/history for the OLD token (per timeframe).
        const oldPrefix = `${exch}_${token}`;
        for (const k of [...this.strategyCache.keys()]) {
            if (String(k).startsWith(oldPrefix)) this.strategyCache.delete(k);
        }
        for (const k of [...(this.strategyInflight?.keys?.() || [])]) {
            if (String(k).startsWith(oldPrefix)) this.strategyInflight.delete(k);
        }

        // 2. Resolve + subscribe new contract.
        this.ensureLiveSubscription({
            key: next.symbol || next.tradingSymbol || next.token,
            symbol: next.symbol || next.tradingSymbol,
            name: next.name || next.tradingSymbol,
            token: next.token,
            exchange: exch,
        });

        // 3. Emit contract_change so the frontend swaps to the new token.
        this.emitSegmentEvent("contract_change", {
            exchange: exch,
            prevToken: String(token),
            prevSymbol: cur.tradingSymbol || cur.symbol,
            nextToken: String(next.token),
            nextSymbol: next.tradingSymbol || next.symbol,
            nextExpiry: next.expiry ?? null,
            reason: decision.reason,
        });

        return {
            rolled: true,
            exchange: exch,
            from: { token: String(token), symbol: cur.tradingSymbol || cur.symbol },
            to: { token: String(next.token), symbol: next.tradingSymbol || next.symbol },
            reason: decision.reason,
        };
    }

    // Iterate all active instruments and roll any expired contract.
    async rolloverAllActive(label = "periodic") {
        const actives = [...(this.activeInstruments?.values() || [])];
        let rolled = 0;
        for (const inst of actives) {
            if (!inst?.token) continue;
            const result = await this.handleRolloverForInstrument(
                inst.exchange || "MCX",
                inst.token
            ).catch(() => ({ rolled: false }));
            if (result?.rolled) rolled++;
            await new Promise(r => setTimeout(r, 200));
        }
        if (rolled) {
            console.log(`[CONTRACT:${label}] rolled ${rolled} contract(s)`);
        }
        return rolled;
    }

    // =========================================================
    // MISSING-HISTORY RETRY (scheduled)
    //
    // Periodically re-attempts the Shoonya historical backfill for
    // any active instrument that still has no cached 15m dataset.
    // As soon as Shoonya's TPSeries endpoint becomes available
    // again, the script populates automatically — no manual action.
    // =========================================================

    hasDataset(exchange, token, tfKey = "15m") {
        const file = path.resolve(
            process.cwd(),
            "data",
            `${String(exchange || "MCX").toUpperCase()}_${token}_${String(tfKey).toLowerCase()}.json`
        );
        if (!fs.existsSync(file)) return false;
        try {
            const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
            return Array.isArray(parsed) && parsed.length > 0;
        } catch {
            return false;
        }
    }

    async retryMissingBackfill(label = "periodic") {
        const authed =
            this.getMarketService()?.isAuthenticated?.() ?? false;
        // Only attempt when we have a live session (Shoonya may still
        // reject TPSeries, but we keep trying without hammering).
        if (!authed) return { attempted: 0, filled: 0, skipped: "no-session" };

        const actives = [...(this.activeInstruments?.values() || [])];
        let attempted = 0;
        let filled = 0;

        for (const inst of actives) {
            if (!inst?.token) continue;
            const exch = String(inst.exchange || "MCX").toUpperCase();
            if (this.hasDataset(exch, inst.token, "15m")) continue;

            attempted++;
            try {
                const key = `${exch}_${inst.token}_15m`;
                const ensured = await this.ensureCandles(key, "15m", {
                    key: inst.symbol || inst.token,
                    symbol: inst.symbol || inst.tradingSymbol || inst.token,
                    name: inst.name || inst.symbol || inst.token,
                    token: inst.token,
                    exchange: exch,
                });
                if ((ensured.candles || []).length > 0) {
                    filled++;
                    console.log(
                        `[BACKFILL:${label}] ${exch}:${inst.token} populated (${ensured.candles.length} candles)`
                    );
                    this.broadcastEvent(
                        "contract_change",
                        this.segmentEvent("contract_change", {
                            exchange: exch,
                            token: String(inst.token),
                            symbol: inst.symbol || inst.token,
                            note: "history-available",
                        })
                    );
                }
            } catch {
                // TPSeries still unavailable — retry next cycle.
            }
            await new Promise(r => setTimeout(r, 1000));
        }

        return { attempted, filled };
    }

    // =========================================================
    // INSTRUMENT+TF DATASTORE
    //
    // Ensures a candle dataset exists for an
    // instrument+timeframe. When the
    // file is missing or empty AND a
    // Shoonya session exists, real
    // candles are fetched once and
    // persisted — no dummy data.
    // =========================================================

    // Yahoo Finance historical fallback for NSE/BSE. Called when
    // Shoonya's TPSeries returns nothing for an equity/index. Fetches
    // real OHLCV and persists to the same per-(exchange,token,tf) file.
    async tryYahooFallback({ exchange, token, symbol, tsym, tf, filePath }) {
        const exch = String(exchange || "MCX").toUpperCase();
        // Yahoo is the data source for NSE/BSE equities/indices AND for all
        // COMEX metals (Shoonya does not trade COMEX).
        if (!["NSE", "BSE", "COMEX"].includes(exch)) return [];

        // Map interval: Yahoo accepts minute buckets like "1m","3m","5m","15m","30m","60m",
        // and "1d" for daily. We only fall back for minute timeframes.
        const minute = Number.isNaN(Number(tf?.interval))
            ? null
            : Number(tf?.interval);
        if (minute == null) return [];

        const yahooInterval =
            minute >= 60 ? "60m" : `${minute}m`;

        // Yahoo caps intraday history (~60 days for 15m). Use 1mo for
        // sub-hour, 3mo for hourly; only daily intervals can go longer.
        const range =
            minute >= 60 ? "3mo" : "1mo";

        let result;
        try {
            result = await fetchYahooHistory({
                exchange: exch,
                token,
                symbol,
                tsym,
                interval: yahooInterval,
                range,
            });
        } catch (error) {
            console.error(
                `[yahoo] ${exch}:${symbol} fetch failed:`,
                error?.message || error
            );
            return [];
        }

        if (!result?.ok || !result.candles?.length) {
            return [];
        }

        try {
            fs.writeFileSync(
                filePath,
                JSON.stringify(result.candles, null, 2),
                "utf8"
            );
            console.log(
                `[yahoo] ${exch}:${symbol} backfilled ${result.candles.length} candles (${result.symbol})`
            );
        } catch (error) {
            console.error(
                `[yahoo] persist failed ${filePath}:`,
                error?.message || error
            );
        }

        return result.candles;
    }

    async ensureCandles(
        instrumentKey,
        timeframeKey,
        instOverride
    ) {

        // Auto-resolve the CURRENT active contract from the live registry so
        // the app never hardcodes an expiry. Only used when the caller does
        // not supply an explicit symbol/token override.
        const inst =
            instOverride ||
            (await this.resolveCurrentContract(
                instrumentKey
            ));

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
        // Track whether the current contract had no candles before the
        // previous-contract fallback, so we know to persist the fallback.
        let hadNoCandles = true;


        // -----------------------------------------------------
        // COMEX PRIMARY DATA SOURCE (Yahoo Finance)
        //
        // COMEX is a US exchange not traded on Shoonya, so historical OHLCV
        // comes directly from Yahoo Finance (GC=F, SI=F, HG=F, PL=F, PA=F).
        // Read the cached file first; if missing/stale, fetch from Yahoo and
        // persist to the same per-(exchange,token,tf) file shape.
        // -----------------------------------------------------

        if (
            String(
                inst.exchange ||
                exchange ||
                ""
            )
                .trim()
                .toUpperCase() ===
            "COMEX"
        ) {

            const cachedComex =
                fs.existsSync(filePath)
                    ? (() => {
                          try {
                              const p = JSON.parse(
                                  fs.readFileSync(
                                      filePath,
                                      "utf8"
                                  )
                              );
                              return Array.isArray(p)
                                  ? p
                                  : [];
                          } catch {
                              return [];
                          }
                      })()
                    : [];

            if (
                cachedComex.length
            ) {
                candles =
                    cachedComex;
            } else {
                const yah =
                    await this.tryYahooFallback({
                        exchange: "COMEX",
                        token: inst.token,
                        symbol: inst.symbol,
                        tsym:
                            inst.tradingSymbol ||
                            inst.symbol,
                        tf,
                        filePath,
                    });
                if (yah.length) {
                    candles = yah;
                    console.log(
                        `[comex] ${exchange}_${inst.token}_${tf.key} loaded ${yah.length} candles from Yahoo`
                    );
                }
            }

            return {
                inst,
                tf,
                exchange,
                filePath,
                candles,
                fetched: false,
            };

        }



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

                    hadNoCandles = false;

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

        // Rollover — stitch current + next with back-adjust (audit-safe, in-memory only)
        // If the CURRENT contract has no cached data yet, fall back to the
        // PREVIOUS contract's dataset so the chart + signal engine still render
        // (Shoonya's historical endpoint often cannot backfill a fresh contract).
        try {
            const registry =
                await getRegistry(exchange).catch(
                    () => []
                );
            let stitched;
            if (candles.length === 0 && registry.length) {
                // Pass ALL rows (incl. expired) so the previous contract can
                // be found even though getRegistry() only returns current ones.
                const allRows =
                    await getRawExchangeRows(exchange).catch(
                        () => registry
                    );
                stitched = getCandlesWithPreviousFallback({
                    exchange,
                    token: inst.token,
                    tfKey: tf.key,
                    getRegistryRows: allRows,
                });
                if (stitched.length) {
                    console.log(
                        `[rollover] ${exchange}_${inst.token}_${tf.key} empty -> using previous contract (${stitched.length} candles)`
                    );
                }
            } else {
                stitched = getStitchedCandles({
                    exchange,
                    token: inst.token,
                    tfKey: tf.key,
                    getRegistryRows: registry,
                });
            }
            if (
                stitched.length > candles.length
            ) {
                console.log(
                    `[rollover] ${exchange}_${inst.token}_${tf.key} stitched ${candles.length} -> ${stitched.length} (back-adjusted)`
                );
                candles = stitched;
            }
        } catch {}

        // Persist previous-contract fallback data so the strategy engine
        // (which reads the current token's file directly) still gets candles
        // even though Shoonya's historical endpoint can't backfill it.
        if (
            hadNoCandles &&
            candles.length > 0
        ) {
            try {
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
                    `[ensure] persisted previous-contract fallback -> ${fileName} (${candles.length} candles)`
                );
            } catch (error) {
                console.error(
                    "[ensure] failed to persist fallback:",
                    error?.message || error
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
                Number.isFinite(Number(tf.interval)) &&
                // COMEX is not traded on Shoonya — skip the Shoonya backfill
                // and go straight to the Yahoo Finance fallback below.
                String(inst.exchange || exchange).toUpperCase() !==
                    "COMEX"
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

                // Yahoo Finance fallback for NSE/BSE when Shoonya returns nothing.
                if (candles.length === 0) {
                    const yah = await this.tryYahooFallback({
                        exchange: inst.exchange || "MCX",
                        token: inst.token,
                        symbol: inst.symbol,
                        tsym: inst.tradingSymbol || inst.symbol,
                        tf,
                        filePath,
                    });
                    if (yah.length) candles = yah;
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

        // Yahoo Finance fallback for NSE/BSE when Shoonya returned nothing.
        if (candles.length === 0) {
            const yah = await this.tryYahooFallback({
                exchange: inst.exchange || "MCX",
                token: inst.token,
                symbol: inst.symbol,
                tsym: inst.tradingSymbol || inst.symbol,
                tf,
                filePath,
            });
            if (yah.length) candles = yah;
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

        // MCX (and COMEX) use the fixed-target strategy ONLY on 15m; on other
        // timeframes (or always for NSE/BSE) they use the trailing/open
        // strategy. The requested timeframe is honored for every segment.
        const _isContractBased =
            instOverride && instOverride.exchange
                ? ["MCX", "COMEX"].includes(
                      String(
                          instOverride.exchange
                      ).toUpperCase()
                  )
                : true; // legacy keys (gold/silver/...) are MCX

        const effectiveTimeframeKey = timeframeKey;

        const ensured =
            await this.ensureCandles(
                instrumentKey,
                effectiveTimeframeKey,
                instOverride
            );

        const { inst, tf } =
            ensured;

        // Pre-compute exchange for cache key (needed before strategy routing)
        const exchUpper = String(
            ensured.exchange ||
                inst.exchange ||
                instOverride?.exchange ||
                "MCX"
        )
            .trim()
            .toUpperCase();


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
            `${exchUpper}_${inst.token}_${tf.key}`;


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


        const strategyFileForInst =
            (exchUpper === "MCX" || exchUpper === "COMEX") &&
            tf.key === "15m"
                ? "BullionAI-fixedtgt.pine"
                : "BullionAI.pine";

        console.log(
            `[strategy] ${exchUpper} ${inst.token} ${tf.key} -> ${strategyFileForInst}`
        );

        const run =

            (async () => {

                const engine =
                    new StrategyEngine(
                        {

                            strategyFile:
                                strategyFileForInst,

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


                const panel =
                    strategyFileForInst === "BullionAI-fixedtgt.pine"
                        ? "fixed-target"
                        : "trailing";

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

                    strategyFile:
                        strategyFileForInst,

                    count:

                        ensured.candles
                            .length,

                    strategy: {
                        ...output.state,
                        panel,
                    },
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
    // JS SIGNAL + TRADE ENGINES (phase 4)
    //
    // For every active instrument, compute the latest candle-driven
    // signal on candle close and feed it into the multi-segment
    // trade engine. Returns a flat per-key snapshot for the frontend
    // information centre. The JS engines are the authoritative,
    // exchange-agnostic source (no frontend signal logic).
    // =========================================================

    async analyzeSegmentForInstrument(inst, timeframeKey) {
        const exch = String(inst.exchange || "MCX").toUpperCase();
        const token = String(inst.token);
        const symbol = String(inst.symbol || inst.tradingSymbol || token);
        const tf = getTimeframe(timeframeKey);
        const key = `${exch}_${token}_${tf.key}`;

        const ensured = await this.ensureCandles(key, tf.key, {
            key: symbol || token,
            symbol,
            name: inst.name || symbol,
            token,
            exchange: exch,
        }).catch(() => ({ candles: [] }));

        const candles = ensured.candles || [];
        if (candles.length === 0) {
            return { exchange: exch, symbol, token: String(token), timeframe: tf.key, status: "no-data" };
        }

        // Evaluate signal on the LAST CLOSED candle (authoritative).
        const sig = latestSignal(candles);
        const tradeKey = `${exch}:${symbol}:${tf.key}`;
        const active = this.tradeEngine.getState({ exchange: exch, symbol, timeframe: tf.key });

        let openResult = null;
        if (sig.signal === "BUY" || sig.signal === "SELL") {
            // Only open if no active trade exists for this key.
            if (!active.active) {
                const atr = sig.indicators?.atr;
                if (atr && Number.isFinite(atr) && atr > 0) {
                    const res = this.tradeEngine.openTrade({
                        exchange: exch,
                        symbol,
                        timeframe: tf.key,
                        signal: sig.signal,
                        entryPrice: sig.close,
                        atr,
                        time: sig.time || Date.now(),
                    });
                    if (res.ok) {
                        openResult = { signal: sig.signal, entry: res.trade.entryPrice, sl: res.trade.initialSL, t1: res.trade.target1, t2: res.trade.target2 };
                        this.broadcastEvent("trade_open", this.segmentEvent("trade_open", {
                            exchange: exch, symbol, timeframe: tf.key, signal: sig.signal,
                            entry: res.trade.entryPrice, sl: res.trade.initialSL, target1: res.trade.target1, target2: res.trade.target2,
                        }));
                    }
                }
            }
        }

        // Advance the active trade with the latest close (for live P/L / max points).
        if (active.active) {
            const upd = this.tradeEngine.updatePrice({
                exchange: exch, symbol, timeframe: tf.key,
                price: candles[candles.length - 1].close,
                time: candles[candles.length - 1].time,
            });
            for (const ev of upd.events) {
                this.broadcastEvent(ev.type, this.segmentEvent(ev.type, {
                    exchange: exch, symbol, timeframe: tf.key, ...(ev.trade || {}),
                    result: ev.result,
                    resultPoints: ev.resultPoints,
                }));
            }
        }

        const state = this.tradeEngine.getState({ exchange: exch, symbol, timeframe: tf.key });
        const t = state.active || state.lastClosed;

        this.jsSignals.set(key, {
            exchange: exch, symbol, token: String(token), timeframe: tf.key,
            signal: sig.signal,
            lastCandleTime: candles[candles.length - 1]?.time ?? null,
        });

        return {
            exchange: exch,
            symbol,
            token: String(token),
            timeframe: tf.key,
            status: "ok",
            signal: sig.signal,
            indicators: sig.indicators,
            trade: t
                ? {
                      signal: t.signal,
                      status: t.status,
                      entryPrice: t.entryPrice,
                      activeSL: t.activeSL,
                      entrySL: t.initialSL,
                      target1: t.target1,
                      target2: t.target2,
                      target1Status: t.target1Status,
                      target2Status: t.target2Status,
                      currentPL: t.currentPL,
                      maxPoints: t.maxPoints,
                      entryTime: t.entryTime,
                      exitTime: t.exitTime,
                      result: t.result,
                  }
                : null,
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

            marketStatus:

                getMarketStatus(),

            segments:

                this.segmentSnapshot ?? null,

        };

    }


    // =========================================================
    // SEGMENT SNAPSHOT (phase 4)
    //
    // Lazily computes the JS signal/trade snapshot for every active
    // instrument. Cached; refreshed by the periodic reconcile so it
    // does not recompute candles on every SSE state broadcast.
    // =========================================================

    async refreshSegmentSnapshot() {
        const actives = [...(this.activeInstruments?.values() || [])];
        if (actives.length === 0) {
            this.segmentSnapshot = null;
            return null;
        }

        const out = [];
        for (const inst of actives) {
            const res = await this.analyzeSegmentForInstrument(inst, "15m")
                .catch(() => null);
            if (res) out.push(res);
            await new Promise(r => setTimeout(r, 150));
        }
        this.segmentSnapshot = out;
        return out;
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

        // Filter-aware: clients on /api/events only receive the
        // event types they subscribed to (unless it's a snapshot/heartbeat).
        const flt =
            response.__eventFilter;

        if (
            flt &&
            event !== "snapshot" &&
            event !== "state" &&
            flt.size > 0 &&
            !flt.has(event)
        ) {
            return;
        }

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
    // INCREMENTAL EVENT BUS (phase 2)
    //
    // Wraps an internal event into a stable, client-friendly
    // shape with an explicit type/exchange/symbol/timeframe so
    // the frontend can update only the affected instrument.
    // =========================================================

    segmentEvent(
        type,
        payload = {}
    ) {

        return {
            type,
            exchange:
                payload.exchange ?? null,
            symbol:
                payload.symbol ?? null,
            token:
                payload.token ?? null,
            timeframe:
                payload.tfKey ?? payload.timeframe ?? null,
            at:
                Date.now(),
            ...payload,
        };

    }


    emitSegmentEvent(
        type,
        payload
    ) {

        this.broadcastEvent(
            type,
            this.segmentEvent(
                type,
                payload
            )
        );

    }


    // Tick events are high-frequency; throttle them so the SSE
    // stream stays cheap while still updating live prices.
    _lastTickEmit =
        0;

    emitTickEvent(tick) {

        const now =
            Date.now();

        if (
            now - this._lastTickEmit <
                500
        ) {
            return;
        }

        this._lastTickEmit =
            now;

        this.broadcastEvent(
            "tick",
            this.segmentEvent(
                "tick",
                {
                    exchange:
                        tick?.exchange ??
                        null,
                    token:
                        tick?.token ??
                        null,
                    symbol:
                        tick?.symbol ??
                        null,
                    price:
                        tick?.price ??
                        tick?.ltp ??
                        null,
                    timestamp:
                        tick?.time ??
                        Date.now(),
                    volume:
                        tick?.volume ??
                        null,
                }
            )
        );

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
    // INCREMENTAL EVENT STREAM (phase 2)
    //
    // Lightweight SSE endpoint that only streams the granular
    // event bus (tick / candle_update / candle_close / strategy /
    // connection_status / contract_change), optionally filtered
    // by ?types=a,b,c. The full /api/stream (state) is unchanged.
    // =========================================================

    async handleEventsSse(
        request,
        response
    ) {

        await this.startCoordinator();

        this.setupSse(
            response
        );

        const filter =
            (request.url
                .split("?")[1] || "")
            .split("&")
            .map(kv => kv.split("="))
            .filter(kv => kv[0] === "types")
            .map(kv => decodeURIComponent(kv[1] || ""));

        const allowed =
            filter.length
                ? new Set(
                      filter
                          .flatMap(s => s.split(","))
                          .map(s => s.trim())
                          .filter(Boolean)
                  )
                : null;

        // Mark this client as filter-aware for /api/events.
        response.__eventFilter =
            allowed;

        this.sseClients.add(
            response
        );

        // Send a snapshot of current market + strategy so the client
        // is immediately up to date, then stream event deltas.
        if (this.state) {
            this.sendSseEvent(
                response,
                "snapshot",
                {
                    state: this.state,
                    marketStatus:
                        getMarketStatus(),
                }
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
                        "GET, POST, PUT, DELETE, OPTIONS",

                    "Access-Control-Allow-Headers":
                        "Content-Type, Authorization, X-Admin-Key, X-Admin-Token",
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
        // SHOONYA SESSION STATUS (lightweight, no strategy work)
        //
        // Used by the daily cron (scripts/check-session.js) to
        // detect a missing/expired Shoonya session and alert the
        // admin before the trading day starts.
        // -----------------------------------------------------

        if (
            url.pathname ===
            "/api/session/status"
        ) {

            let status =
                null;

            try {

                status =
                    this.coordinator?.getSessionStatus?.() ||
                    null;

            } catch {
                status =
                    null;
            }

            const authenticated = Boolean(
                status?.authenticated
            );
            const feedConnected = Boolean(
                status?.feedConnected
            );

            this.sendJson(
                response,
                200,
                {
                    ok:
                        true,

                    // HTTP_SERVER_READY is always true — the API is up.
                    server:
                        "ready",

                    // SHOONYA state machine
                    authenticated,
                    feedConnected,
                    status:
                        status?.status ||
                        (authenticated
                            ? feedConnected
                                ? "connected"
                                : "disconnected"
                            : "login_required"),
                    loginRequired:
                        Boolean(status?.loginRequired),

                    // session detail (non-secret)
                    uid:
                        status?.uid ?? null,
                    actid:
                        status?.actid ?? null,
                    authenticatedAt:
                        status?.authenticatedAt ?? null,
                    expiresAt:
                        status?.expiresAt ?? null,
                    expired:
                        Boolean(status?.expired),
                    lastTickAt:
                        status?.lastTickAt ?? null,

                    // legacy fields kept for compatibility
                    started:
                        Boolean(
                            this.started
                        ),
                    liveConnected:
                        Boolean(
                            feedConnected
                        ),
                    session:
                        status?.session ?? null,
                    market:
                        this.coordinator?.getState?.()?.market ||
                            null,
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
        // SHOONYA LOGIN (redirect URL via browser/HTTP)
        //
        // Fallback for hosts where the interactive
        // console prompt cannot read stdin.
        //
        //   GET  /api/shoonya/login              -> HTML form
        //   GET  /api/shoonya/login?url=<enc>    -> login
        //   POST /api/shoonya/login              -> {"redirectUrl": "..."}
        //   GET  /api/shoonya/config             -> diagnostic
        // -----------------------------------------------------

        // Diagnostic — shows exact redirect & IP Shoonya will see
        if (
            url.pathname === "/api/shoonya/config" &&
            request.method === "GET"
        ) {
            const clientIp = String(
                request.headers["x-forwarded-for"] ||
                    request.headers["x-real-ip"] ||
                    request.socket.remoteAddress ||
                    ""
            )
                .split(",")[0]
                .trim();
            const cfgRedirect =
                process.env.SHOONYA_REDIRECT_URL ||
                "not set";
            const clientId =
                process.env.SHOONYA_CLIENT_ID ||
                "not set";
            let egressIp = null;
            try {
                const r = await fetch(
                    "https://api.ipify.org?format=json",
                    {
                        signal: AbortSignal.timeout(
                            2000
                        ),
                    }
                ).catch(() => null);
                if (r && r.ok) {
                    const j =
                        await r
                            .json()
                            .catch(() => null);
                    egressIp = j?.ip || null;
                }
            } catch {}
            this.sendJson(response, 200, {
                ok: true,
                clientId:
                    clientId.length > 8
                        ? clientId.slice(0, 6) +
                          "..." +
                          clientId.slice(-4)
                        : clientId,
                clientId_raw: clientId,
                redirectConfigured: cfgRedirect,
                requestIp:
                    clientIp || "unknown",
                egressIp: egressIp || "unknown",
                hint: "Whitelist BOTH requestIp and egressIp in Shoonya. Redirect must exactly match SHOONYA_REDIRECT_URL (including trailing slash). Code is single-use and expires in ~30s.",
            });
            return;
        }

        if (
            url.pathname ===
            "/api/shoonya/login"
        ) {

            try {

                let redirectUrl =
                    url.searchParams.get(
                        "url"
                    ) || "";

                // Diagnostic: log every login attempt with IP + redirect + code preview
                try {
                    const clientIp = String(
                        request.headers[
                            "x-forwarded-for"
                        ] ||
                            request.headers[
                                "x-real-ip"
                            ] ||
                            request.socket
                                .remoteAddress ||
                            ""
                    )
                        .split(",")[0]
                        .trim();
                    const cfgRedirect =
                        process.env
                            .SHOONYA_REDIRECT_URL ||
                        "not set";
                    const codePreview = (() => {
                        try {
                            const u = new URL(
                                redirectUrl
                            );
                            const c =
                                u.searchParams.get(
                                    "code"
                                );
                            return c
                                ? c.slice(0, 8) + "..."
                                : "no-code";
                        } catch {
                            return redirectUrl
                                ? redirectUrl.slice(
                                      0,
                                      30
                                  ) + "..."
                                : "empty";
                        }
                    })();
                    if (redirectUrl) {
                        console.log(
                            `[Shoonya][HTTP] login ip=${clientIp || "unknown"} cfg_redirect=${cfgRedirect} code=${codePreview} url_len=${redirectUrl.length}`
                        );
                    }
                } catch {}

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

                // Recompute the JS signal/trade segment snapshot so the
                // newly-added instrument shows up immediately in /api/state.
                this.refreshSegmentSnapshot().catch(() => {});

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
                        exchange: r.exchange || r.exch || exch,
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
            url.pathname === "/api/contract"
        ) {

            const instrument =
                url.searchParams.get("instrument") ||
                "gold";

            try {

                const contract =
                    await this.resolveCurrentContract(
                        instrument
                    );

                this.sendJson(
                    response,
                    200,
                    {
                        ok: true,
                        resolved: contract.resolved,
                        exchange: contract.exchange,
                        instrument: contract.key,
                        symbol: contract.symbol,
                        token:
                            String(
                                contract.token
                            ),
                        expiry: contract.expiry ?? null,
                        expiryText: contract.expiryText ?? null,
                    }
                );

            } catch (error) {
                this.sendJson(
                    response,
                    500,
                    {
                        ok: false,
                        error:
                            error?.message ||
                            String(error),
                    }
                );
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
                const user = await registerUser(body);
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
                const user = await loginUser(body);
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
            try {
                const {
                    loadUsersPublic,
                } = require("../auth/users");
                const user =
                    await loadUsersPublic(
                        data.email
                    );
                this.sendJson(response, 200, {
                    ok: true,
                    email: data.email,
                    user,
                });
            } catch {
                this.sendJson(response, 200, {
                    ok: true,
                    email: data.email,
                });
            }
            return;
        }

        // -----------------------------------------------------
        // ADMIN — users & subscriptions (X-Admin-Key)
        // -----------------------------------------------------

        const isAdminRoute =
            url.pathname.startsWith(
                "/api/admin/"
            );

        const checkAdmin = async () => {
            // 1) Legacy secret key (back-compat)
            const hdr =
                request.headers["x-admin-key"] ||
                request.headers["x-admin-token"] ||
                "";
            const qKey =
                url.searchParams.get(
                    "adminKey"
                ) || "";
            const provided =
                String(hdr || qKey || "").trim();
            try {
                const {
                    getAdminKey,
                } = require("../auth/users");
                const expected =
                    getAdminKey().trim();
                if (
                    provided &&
                    provided === expected
                ) {
                    return true;
                }
            } catch {}
            // 2) Admin login via Bearer token + isAdmin flag
            const auth =
                request.headers.authorization ||
                "";
            const token = auth.startsWith(
                "Bearer "
            )
                ? auth.slice(7)
                : null;
            if (token) {
                const data =
                    verifyToken(token);
                if (
                    data &&
                    data.email
                ) {
                    try {
                        const {
                            isAdminEmail,
                        } = require(
                            "../auth/users"
                        );
                        const admin =
                            await isAdminEmail(
                                data.email
                            );
                        if (admin) {
                            return true;
                        }
                    } catch {}
                }
            }
            return false;
        };

        if (isAdminRoute) {
            if (!(await checkAdmin())) {
                this.sendJson(response, 401, {
                    ok: false,
                    error: "Admin authorization required. Login as admin or provide X-Admin-Key.",
                });
                return;
            }

            // GET /api/admin/verify
            if (
                url.pathname ===
                    "/api/admin/verify" &&
                request.method === "GET"
            ) {
                this.sendJson(response, 200, {
                    ok: true,
                });
                return;
            }

            // GET /api/admin/users
            if (
                url.pathname ===
                    "/api/admin/users" &&
                request.method === "GET"
            ) {
                const {
                    listUsersPublic,
                } = require("../auth/users");
                const users =
                    await listUsersPublic();
                this.sendJson(response, 200, {
                    ok: true,
                    users,
                    count: users.length,
                });
                return;
            }

            // POST /api/admin/users -> create user (admin only)
            if (
                url.pathname === "/api/admin/users" &&
                request.method === "POST"
            ) {
                try {
                    const body =
                        await readBody(request);
                    const {
                        registerUser: adminRegister,
                        updateUser: adminUpdate,
                    } = require("../auth/users");
                    let user = adminRegister({
                        email: body.email,
                        password: body.password,
                        name: body.name,
                        segments: body.segments,
                    });
                    // optional: set validity via calendar date
                    const validTillRaw =
                        body.validTill ||
                        body.accessUntil;
                    if (validTillRaw) {
                        let ts;
                        if (
                            typeof validTillRaw ===
                                "string" &&
                            isNaN(
                                Number(validTillRaw)
                            )
                        ) {
                            const d = new Date(
                                validTillRaw
                            );
                            ts = isNaN(d.getTime())
                                ? NaN
                                : d.getTime() +
                                  24 * 60 * 60 * 1000 -
                                  1000;
                        } else {
                            ts = Number(
                                validTillRaw
                            );
                        }
                        if (
                            Number.isFinite(ts) &&
                            ts > 0
                        ) {
                            user = adminUpdate(
                                body.email,
                                {
                                    accessUntil: ts,
                                    plan:
                                        body.plan ||
                                        "full",
                                }
                            );
                        }
                    } else if (body.plan) {
                        user = adminUpdate(
                            body.email,
                            { plan: body.plan }
                        );
                    }
                    if (body.isAdmin) {
                        user = adminUpdate(
                            body.email,
                            { isAdmin: true }
                        );
                    }
                    this.sendJson(response, 200, {
                        ok: true,
                        user,
                    });
                } catch (error) {
                    this.sendJson(response, 400, {
                        ok: false,
                        error:
                            error?.message ||
                            String(error),
                    });
                }
                return;
            }

            // POST /api/admin/users/:email/reset-password
            const resetMatch =
                url.pathname.match(
                    /^\/api\/admin\/users\/([^/]+)\/reset-password$/
                );
            if (
                resetMatch &&
                request.method === "POST"
            ) {
                try {
                    const email =
                        decodeURIComponent(
                            resetMatch[1]
                        );
                    const body =
                        await readBody(request);
                    const newPass = String(
                        body.newPassword ||
                            body.password ||
                            ""
                    );
                    if (
                        !newPass ||
                        newPass.length < 6
                    ) {
                        throw new Error(
                            "Password must be at least 6 characters."
                        );
                    }
                    const {
                        resetUserPassword,
                    } = require("../auth/users");
                    const user =
                        await resetUserPassword(
                            email,
                            newPass
                        );
                    this.sendJson(response, 200, {
                        ok: true,
                        user,
                    });
                } catch (error) {
                    this.sendJson(response, 400, {
                        ok: false,
                        error:
                            error?.message ||
                            String(error),
                    });
                }
                return;
            }

            // GET /api/admin/stats
            if (
                url.pathname ===
                    "/api/admin/stats" &&
                request.method === "GET"
            ) {
                const {
                    listUsersPublic,
                } = require("../auth/users");
                const users =
                    await listUsersPublic();
                const now = Date.now();
                const stats = {
                    total: users.length,
                    active: users.filter(
                        u => u.hasAccess
                    ).length,
                    expired: users.filter(
                        u => !u.hasAccess
                    ).length,
                    trial: users.filter(
                        u => u.plan === "trial"
                    ).length,
                    full: users.filter(
                        u => u.plan === "full"
                    ).length,
                    segments: {
                        MCX: users.filter(u =>
                            (
                                u.segments || []
                            ).includes("MCX")
                        ).length,
                        NSE: users.filter(u =>
                            (
                                u.segments || []
                            ).includes("NSE")
                        ).length,
                        BSE: users.filter(u =>
                            (
                                u.segments || []
                            ).includes("BSE")
                        ).length,
                    },
                };
                this.sendJson(response, 200, {
                    ok: true,
                    stats,
                });
                return;
            }

            // POST /api/admin/users/:email/renew  { days }
            const renewMatch =
                url.pathname.match(
                    /^\/api\/admin\/users\/([^/]+)\/renew$/
                );
            if (
                renewMatch &&
                request.method === "POST"
            ) {
                const email =
                    decodeURIComponent(
                        renewMatch[1]
                    );
                const body =
                    await readBody(request);
                const days = Number(
                    body.days ?? 30
                );
                const {
                    renewUser,
                } = require("../auth/users");
                const user = await renewUser(
                    email,
                    days
                );
                this.sendJson(response, 200, {
                    ok: true,
                    user,
                });
                return;
            }

            // /api/admin/users/:email  (GET, PUT, DELETE)
            const userMatch =
                url.pathname.match(
                    /^\/api\/admin\/users\/([^/]+)$/
                );
            if (userMatch) {
                const email =
                    decodeURIComponent(
                        userMatch[1]
                    );
                if (
                    request.method === "GET"
                ) {
                    const {
                        loadUsersPublic,
                    } = require("../auth/users");
                    const user =
                        await loadUsersPublic(email);
                    this.sendJson(response, 200, {
                        ok: true,
                        user,
                    });
                    return;
                }
                if (
                    request.method === "PUT"
                ) {
                    const body =
                        await readBody(request);
                    const {
                        updateUser,
                    } = require("../auth/users");
                    const user = await updateUser(
                        email,
                        body
                    );
                    this.sendJson(response, 200, {
                        ok: true,
                        user,
                    });
                    return;
                }
                if (
                    request.method === "DELETE"
                ) {
                    const {
                        deleteUser,
                    } = require("../auth/users");
                    await deleteUser(email);
                    this.sendJson(response, 200, {
                        ok: true,
                    });
                    return;
                }
            }
        }

        // ADMIN — clear server in-memory caches
        if (
            url.pathname === "/api/admin/clear-cache" &&
            request.method === "POST" &&
            isAdminRoute
        ) {
            try {
                if (!(await checkAdmin())) {
                    this.sendJson(response, 401, { ok: false, error: "Admin authorization required." });
                    return;
                }
                // Purge in-memory strategy + segment caches.
                const cleared = {
                    strategyCache: (this.strategyCache?.size ?? 0),
                    strategyInflight: (this.strategyInflight?.size ?? 0),
                    jsSignals: (this.jsSignals?.size ?? 0),
                    segmentSnapshot: this.segmentSnapshot ? 1 : 0,
                };
                this.strategyCache?.clear?.();
                this.strategyInflight?.clear?.();
                this.jsSignals?.clear?.();
                this.segmentSnapshot = null;
                console.log("[admin] cache cleared:", JSON.stringify(cleared));
                this.sendJson(response, 200, { ok: true, cleared });
            } catch (error) {
                this.sendJson(response, 400, { ok: false, error: error?.message || String(error) });
            }
            return;
        }

        // ADMIN — clear ALL users (destructive)
        if (
            url.pathname === "/api/admin/clear-users" &&
            request.method === "POST" &&
            isAdminRoute
        ) {
            try {
                if (!(await checkAdmin())) {
                    this.sendJson(response, 401, { ok: false, error: "Admin authorization required." });
                    return;
                }
                const { clearAllUsers } = require("../auth/db");
                await clearAllUsers();
                console.log("[admin] users cleared");
                this.sendJson(response, 200, { ok: true });
            } catch (error) {
                this.sendJson(response, 400, { ok: false, error: error?.message || String(error) });
            }
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

                // LIVE-FIRST: any requested script is immediately wired into
                // the WebSocket feed + candle aggregator so live ticks start
                // forming candles independent of the historical endpoint.
                if (instOverride) {
                    this.ensureLiveSubscription(
                        instOverride
                    );
                }

                const ensured =
                    await this.ensureCandles(
                        requestedInstrument,
                        requestedTimeframe,
                        instOverride
                    );


                /* Backend-built LIVE forming candle -> continuous series */

                let outCandles = ensured.candles;
                let liveOnly = false;

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
                        liveOnly = ensured.candles.length === 0;
                    }

                } catch {
                    /* never fail the request over the live tail */
                }

                // Friendly notice when only live ticks (no history) are available.
                let notice = ensured.notice ?? null;
                if (!notice && liveOnly) {
                    notice =
                        "Live candle only — historical data will fill in automatically as trading occurs.";
                } else if (!notice && outCandles.length === 0) {
                    notice =
                        "No candles yet. The script is now live-subscribed — candles will appear on the next market tick.";
                } else if (notice && notice.startsWith("No historical data")) {
                    notice =
                        notice + " Live subscription active — candles will appear on the next market tick.";
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

                        liveOnly,

                        live:

                            outCandles.length >
                            0,

                        notice,

                        candles:

                            outCandles,

                        dayStats:

                            await this.computeDayStats(
                                ensured.inst
                            ),

                        segmentState:

                            await this.analyzeSegmentForInstrument(
                                {
                                    exchange: ensured.exchange,
                                    token: ensured.inst.token,
                                    symbol: ensured.inst.symbol,
                                    tradingSymbol: ensured.inst.symbol,
                                    name: ensured.inst.name,
                                },
                                ensured.tf.key
                            ).catch(() => null),
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

        if (
            url.pathname ===
            "/api/events"
        ) {

            await this.handleEventsSse(
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

        // Initialize the users/subscriptions database (Postgres if
        // DATABASE_URL is set, JSON fallback otherwise).
        require("../auth/db").init()
            .then(info => console.log("[db] engine:", info?.engine || "unknown"))
            .catch(err => console.error("[db] init failed:", err?.message || err));

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
