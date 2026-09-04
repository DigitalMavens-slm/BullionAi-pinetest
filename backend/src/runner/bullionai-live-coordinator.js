require("dotenv").config();

const fs = require("fs");
const path = require("path");
const EventEmitter = require("events");

const {
    MarketDataService,
} = require("../market/market-data-service");

const {
    CandleDataManager,
} = require("../market/candle-data-manager");

const {
    ShoonyaSessionManager,
} = require("../auth/shoonya-session-manager");

const {
    StrategyEngine,
} = require("../strategy/strategy-engine");

const {
    LiveMarketState,
} = require("../market/live-market-state");

const {
    BullionAIDisplayState,
} = require("../state/bullionai-display-state");


class BullionAILiveCoordinator extends EventEmitter {

    constructor({
        timeframe = "60m",
    } = {}) {

        super();

        this.timeframe =
            timeframe;

        // =====================================================
        // CONFIGURATION
        // =====================================================

        this.clientId =
            process.env.SHOONYA_CLIENT_ID ||
            process.env.SHOONYA_USER_ID ||
            process.env.CLIENT_ID;

        this.secretCode =
            process.env.SHOONYA_SECRET_CODE ||
            process.env.SHOONYA_SECRET ||
            process.env.SECRET_CODE;

        this.exchange =
            process.env.SHOONYA_EXCHANGE ||
            "MCX";

        this.token =
            process.env.SHOONYA_TOKEN ||
            "483079";

        this.interval =
            this.resolveInterval(
                this.timeframe
            );


        // =====================================================
        // MARKET DATA SERVICE
        // =====================================================

        this.market =
            new MarketDataService({

                clientId:
                    this.clientId,

                secretCode:
                    this.secretCode,

                exchange:
                    this.exchange,

                token:
                    this.token,

                interval:
                    this.interval,

                baseUrl:
                    process.env.SHOONYA_BASE_URL ||
                    "https://api.shoonya.com",
            });


        // =====================================================
        // SESSION
        // =====================================================

        this.session =
            new ShoonyaSessionManager(
                this.market
            );


        // =====================================================
        // STRATEGY ENGINE
        //
        // IMPORTANT:
        //
        // This executes the actual BullionAI.pine.
        // It does NOT contain a second copy of the strategy.
        // =====================================================

        const strategyFileForExch =
            String(
                this.exchange || "MCX"
            ).toUpperCase() === "MCX"
                ? "BullionAI-fixedtgt.pine"
                : "BullionAI.pine";

        this.strategy =
            new StrategyEngine({
                strategyFile:
                    strategyFileForExch,

                candlesFile:
                    this.resolveStrategyDataFile(),

                resultsFile:
                    this.resolveResultsFile(),
            });


        // =====================================================
        // LIVE MARKET STATE
        // =====================================================

        this.liveMarket =
            null;


        // =====================================================
        // DISPLAY STATE
        // =====================================================

        this.display =
            new BullionAIDisplayState({
                timeframe:
                    this.timeframe,
            });


        // =====================================================
        // STATE
        // =====================================================

        this.initialized =
            false;

        this.running =
            false;

        this.strategyState =
            null;

        this.reauthenticating =
            false;

        // SHOONYA_LOGIN_REQUIRED: set when no valid session exists and a
        // manual login is required. Cleared on successful authentication.
        this.loginRequired =
            false;

        // Feed lifecycle tracking for the watchdog + status.
        this.feedStarted =
            false;
        this.lastValidTickAt =
            null;
        this.feedConnecting =
            false;
        this.feedReconnecting =
            false;

        this.initializingPromise =
            null;


        this.bindDisplayEvents();
    }


    // =========================================================
    // TIMEFRAME → INTERVAL
    // =========================================================

    resolveInterval(
        timeframe
    ) {

        const map = {

            "5m":
                "5",

            "15m":
                "15",

            "30m":
                "30",

            "60m":
                "60",

            "120m":
                "120",

            "180m":
                "180",

            "240m":
                "240",

        };


        const interval =
            map[
                String(
                    timeframe
                ).toLowerCase()
            ];


        if (!interval) {

            throw new Error(
                `Unsupported timeframe: ${timeframe}`
            );

        }


        return interval;
    }


    // =========================================================
    // STRATEGY DATA FILE
    // =========================================================

    resolveStrategyDataFile() {

        const map = {

            "5m":
                "data/MCX_483079_5m.json",

            "15m":
                "data/MCX_483079_15m.json",

            "30m":
                "data/MCX_483079_30m.json",

            "60m":
                "data/MCX_483079_60m.json",

            "120m":
                "data/MCX_483079_120m.json",

            "240m":
                "data/MCX_483079_240m.json",

        };


        const file =
            map[
                String(
                    this.timeframe
                ).toLowerCase()
            ];


        if (!file) {

            throw new Error(
                `No strategy dataset configured for ${this.timeframe}`
            );

        }


        return file;
    }


    // =========================================================
    // RESULTS FILE
    // =========================================================

    resolveResultsFile() {

        return `results-${this.timeframe}.json`;
    }


    // =========================================================
    // ENSURE STRATEGY CANDLES (fresh-host bootstrap)
    //
    // On a fresh Hostinger deploy data/MCX_*.json does not exist.
    // Reuse the existing MarketDataService + CandleDataManager
    // infrastructure (no fake data, no hardcoded dataset) to
    // backfill legitimate history before the first Pine run.
    // If backfill yields no candles, keep API alive with no-data.
    // =========================================================

    async ensureStrategyCandles() {

        const file =
            this.strategy.candlesFile;

        // Already has data -> done
        try {
            if (fs.existsSync(file)) {
                const arr =
                    JSON.parse(
                        fs.readFileSync(
                            file,
                            "utf8"
                        )
                    );
                if (
                    Array.isArray(arr) &&
                    arr.length > 0
                ) {
                    return true;
                }
            }
        } catch {}

        // No file or empty — try legitimate historical backfill
        if (
            !this.market ||
            !this.market.isAuthenticated()
        ) {
            console.log(
                "[coordinator] no candles file and market not authenticated — deferring backfill, live ticks will build history"
            );
            return false;
        }

        try {
            console.log(
                "[coordinator] candles file missing — attempting historical backfill for",
                path.basename(file)
            );

            // Ensure data directory exists on Linux
            try {
                fs.mkdirSync(
                    path.dirname(file),
                    { recursive: true }
                );
            } catch {}

            const mgr =
                new CandleDataManager({
                    dataDirectory:
                        "./data",
                    exchange:
                        this.exchange,
                    token:
                        this.token,
                });

            // MarketDataService handles Shoonya TPSeries + dedup + sort
            const result =
                await this.market.updateCandles(
                    [],
                    {
                        exchange:
                            this.exchange,
                        token:
                            this.token,
                        interval:
                            this.interval,
                    }
                );

            if (
                result &&
                Array.isArray(
                    result.candles
                ) &&
                result.candles.length > 0
            ) {
                // Persist via existing manager (timeframe key, e.g. "15m")
                const tfKey =
                    String(
                        this.timeframe
                    ).toLowerCase();
                mgr.save(
                    tfKey,
                    result.candles
                );
                console.log(
                    `[coordinator] backfilled ${result.candles.length} candles to ${path.basename(file)}`
                );
                return true;
            }

            console.log(
                "[coordinator] backfill returned no candles — live aggregator will build history"
            );
            return false;
        } catch (error) {
            console.error(
                "[coordinator] backfill failed:",
                error?.message ||
                error
            );
            return false;
        }
    }


    // =========================================================
    // DISPLAY EVENTS
    // =========================================================

    bindDisplayEvents() {

        this.display.on(
            "update",
            state => {

                this.emit(
                    "update",
                    state
                );

            }
        );
    }


    // =========================================================
    // AUTHENTICATE
    // =========================================================

    async authenticate() {

        if (
            !this.clientId
        ) {

            this.loginRequired =
                true;

            throw new Error(
                "Shoonya client ID is missing."
            );

        }


        if (
            !this.secretCode
        ) {

            this.loginRequired =
                true;

            throw new Error(
                "Shoonya secret code is missing."
            );

        }


        console.log("");

        console.log(
            "===================================="
        );

        console.log(
            "       BULLIONAI LIVE INIT"
        );

        console.log(
            "===================================="
        );

        console.log(
            "Timeframe:",
            this.timeframe
        );

        console.log(
            "Interval:",
            this.interval
        );

        console.log(
            "Exchange:",
            this.exchange
        );

        console.log(
            "Token:",
            this.token
        );


        /*
         * Auth resolution order:
         *
         * 0. Persisted session from an
         *    earlier login today —
         *    restored, then VERIFIED
         *    against Shoonya before it
         *    is trusted.
         *
         * 1. Drop file  data/shoonya-auth.txt
         *
         * 2. Interactive console prompt
         *
         * 3. Non-interactive → keep polling
         *    the drop file until it appears.
         */

        const fresh =
            await this.ensureFreshSession();

        if (
            this.loginRequired ||
            !this.session.isAuthenticated()
        ) {
            // No valid session (non-interactive) — LOGIN_REQUIRED.
            this.loginRequired =
                true;

            console.log(
                "[shoonya] login required"
            );

            return "login_required";
        }

        return "authenticated";
    }


    // =========================================================
    // ENSURE A FRESH, SERVER-VERIFIED SESSION
    //
    // Single source of truth for authentication.
    // Every consumer (historical API, WebSocket,
    // live feed, reconciliation, coordinator)
    // shares this one state.
    //
    // A stored session file is only a hint:
    // it is validated with a real Shoonya call
    // and discarded immediately if rejected.
    // =========================================================

    async ensureFreshSession() {

        if (
            !this.session.isAuthenticated()
        ) {

            let restored = false;

            try {

                restored =

                    await this.session
                        .restoreSession();

            } catch (
                error
            ) {

                console.error(
                    "Session restore failed:",
                    error?.message ||
                    error
                );

            }

            if (restored) {

                console.log("[shoonya] session restored");

                console.log("");

                console.log(
                    "Stored Shoonya session found."
                );

                const verdict =

                    await this.session
                        .validateStoredSession();

                if (
                    verdict === "invalid"
                ) {

                    console.log(
                        "Shoonya re-authentication required."
                    );

                    this.session.invalidateSession();

                }

                /*
                 * "inconclusive" (network error):
                 * keep the session and let the
                 * runtime auth-failure handler deal
                 * with it if Shoonya really does
                 * reject it later.
                 */

            }

        }


        if (
            this.session.isAuthenticated()
        ) {
            // Valid session resolved -> authenticated. Clear login-required.
            this.loginRequired =
                false;
            return;
        }


        const dropFile =
            "data/shoonya-auth.txt";


        try {

            await this.session
                .authenticateFromDropFile(
                    dropFile
                );

        } catch (
            error
        ) {

            console.error(
                "Drop-file auth failed:",
                error?.message ||
                error
            );

        }


        if (
            this.session.isAuthenticated()
        ) {
            return;
        }


        const isInteractive =

            Boolean(
                process.stdin &&
                process.stdin.isTTY
            );

        if (isInteractive) {

            /*
             * A single bad paste must never kill
             * startup: keep offering the prompt
             * until a valid session exists. If
             * the console turns out to be unusable
             * (stdin EOF resolves the question
             * instantly), stop prompting and let
             * the drop-file watcher take over.
             */

            let instantFailures =
                0;

            while (
                !this.session
                    .isAuthenticated()
            ) {

                const attemptStartedAt =
                    Date.now();

                try {

                    await this.session
                        .authenticateFromConsole();

                } catch (
                    error
                ) {

                    console.log("");

                    console.error(
                        "Shoonya login failed:",
                        error?.message ||
                        error
                    );


                    if (

                        Date.now() -
                            attemptStartedAt <
                        250

                    ) {

                        instantFailures++;

                    } else {

                        instantFailures =
                            0;

                    }


                    if (
                        instantFailures >= 2
                    ) {

                        console.log(
                            "Console input unavailable."
                        );

                        console.log(
                            "Falling back to auth drop file:",
                            dropFile
                        );

                        break;

                    }


                    await new Promise(
                        resolve =>
                            setTimeout(
                                resolve,
                                300
                            )
                    );

                }

            }


            if (
                this.session.isAuthenticated()
            ) {
                return;
            }

        }


        if (
            !isInteractive
        ) {

            console.log(
                "Non-interactive session detected."
            );

        }

        this.printManualLoginHint();

        console.log(
            "Waiting for auth drop file:",
            dropFile
        );

        /*
         * Non-interactive hosts (Render, cron, CI) have no console and no
         * drop-file watcher. We must NOT block forever waiting for a login —
         * otherwise every API endpoint that awaits the coordinator hangs and
         * the browser reports "failed to fetch" / "CORS blocked" (timeout).
         *
         * Wait a short bounded window for a login to arrive (so a manual
         * authentication within that window still connects), then give up so
         * the API can respond promptly with a "no-session" state.
         */

        const authWaitStart =
            Date.now();

        const authWaitMs =
            Number(
                process.env.SHOONYA_AUTH_WAIT_MS ||
                60000
            );

        while (
            !this.session
                .isAuthenticated()
        ) {

            if (
                isInteractive &&
                Date.now() - authWaitStart >=
                    authWaitMs
            ) {

                // Interactive consoles can still wait indefinitely-ish,
                // but cap it so a stuck loop never hangs the process.
                if (
                    Date.now() - authWaitStart >=
                    authWaitMs * 4
                ) {

                    this.loginRequired =
                        true;

                    throw new Error(
                        "Shoonya login timed out (no session provided). Re-authenticate at /api/shoonya/login."
                    );

                }

            } else if (

                !isInteractive &&
                Date.now() - authWaitStart >=
                    authWaitMs

            ) {

                // No valid session and no interactive prompt available:
                // set SHOONYA_LOGIN_REQUIRED so the dashboard shows a clear
                // "Login to Shoonya" action and STOP (do not block startup).
                // The HTTP API stays healthy; a fresh /api/shoonya/login
                // re-triggers the full startup sequence.
                this.loginRequired =
                    true;

                console.log(
                    "[shoonya] login required — no valid session in non-interactive mode"
                );

                return false;

            }

            let consumed = false;

            try {

                consumed =
                    await this.session
                        .authenticateFromDropFile(
                            dropFile
                        );

            } catch (
                error
            ) {

                console.error(
                    "Drop-file auth failed, still waiting:",
                    error?.message ||
                    error
                );

            }

            if (

                consumed &&
                this.session
                    .isAuthenticated()

            ) {

                break;

            }

            await new Promise(
                resolve =>
                    setTimeout(
                        resolve,
                        2000
                    )
            );

        }

        // Reached a valid session via drop-file/console/loop: clear login
        // required so the dashboard reflects the authenticated state.
        this.loginRequired =
            false;

    }


    // =========================================================
    // MANUAL LOGIN HINT
    //
    // Shown whenever the console prompt cannot be
    // used. The HTTP login endpoint is served by
    // the API server, which starts independently
    // of authentication.
    // =========================================================

    printManualLoginHint() {

        const port =

            Number(
                process.env.BULLIONAI_API_PORT
            ) || 8787;

        console.log("");

        console.log(
            "To log in without this console:"
        );

        console.log(
            `  1. Open  http://localhost:${port}/api/shoonya/login  in a browser`
        );

        console.log(
            "  2. Paste the fresh Shoonya redirect URL and submit"
        );

        console.log("");

    }

    // =========================================================
    // LOGIN VIA REDIRECT URL (browser / HTTP / drop file)
    //
    // Reliable fallback for machines where the
    // interactive console prompt cannot read stdin
    // (the question resolves instantly with empty
    // input). Completes exactly what a console
    // login would: fresh session -> saved ->
    // finish startup OR reconnect the live feed.
    // =========================================================

    async loginWithRedirectUrl(
        redirectUrl
    ) {

        await this.session.authenticateFromRedirect(
            redirectUrl
        );

        // Successful OAuth code exchange -> SHOONYA_AUTHENTICATED. Clear the
        // login-required flag so the dashboard shows Connected / live data.
        if (this.session.isAuthenticated()) {
            this.loginRequired =
                false;
        }


        if (
            !this.initialized ||
            !this.liveMarket
        ) {

            /*
             * Boot-time login (or re-login after a LOGIN_REQUIRED state where
             * the feed was never started): complete the normal startup
             * sequence that was left pending.
             */

            this.running =
                true;

            // Force a fresh init so the feed + subscriptions start now that a
            // valid session is present.
            this.initialized =
                false;

            this.initializingPromise =
                null;

            await this.initialize();

        } else if (

            this.liveMarket &&
            !this.reauthenticating

        ) {

            /*
             * Runtime refresh: if a shared
             * re-auth cycle is already running it
             * will pick up the fresh session on
             * its next check — avoid double
             * reconnects here.
             */

            await this.liveMarket.feed.reconnectWithCurrentSession();

        }


        return this.session.getState();

    }


    // =========================================================
    // RUNTIME RE-AUTHENTICATION
    //
    // Invoked when Shoonya rejects the session
    // at runtime (WebSocket NOT_OK / 401 /
    // historical API 401). Invalidates the dead
    // session exactly once, falls back to the
    // normal login flow, then reconnects the
    // live feed using the fresh session.
    // =========================================================

    async handleAuthFailure() {

        if (
            this.reauthenticating
        ) {
            return;
        }

        this.reauthenticating =
            true;

        try {

            console.log("");

            console.log(
                "Shoonya session is no longer valid. Re-authentication required."
            );

            this.session.invalidateSession();

            await this.ensureFreshSession();


            if (
                !this.session.isAuthenticated()
            ) {

                console.log(
                    "Re-authentication incomplete; live feed stays paused until a valid session exists."
                );

                return;

            }


            if (
                this.liveMarket
            ) {

                console.log(
                    "Reconnecting live feed with fresh Shoonya session..."
                );

                await this.liveMarket.feed.reconnectWithCurrentSession();

                console.log(
                    "Live feed reconnected using the current authenticated session."
                );

            }

        } catch (
            error
        ) {

            console.error(
                "Shoonya re-authentication failed:",
                error?.message ||
                error
            );

        } finally {

            this.reauthenticating =
                false;

        }

    }


    // =========================================================
    // START LIVE MARKET
    // =========================================================

    async startLiveMarket() {

        /*
         * No default scripts: the WebSocket
         * connects with ZERO subscriptions.
         * Scripts enter only through the
         * search box -> /api/subscribe ->
         * subscribeTokens().
         */

        this.liveMarket =
            new LiveMarketState({

                marketDataService:
                    this.market,

                exchange:
                    this.exchange,

                token:
                    this.token,

                tokens:
                    [],

            });


        // -----------------------------------------------------
        // LIVE PRICE
        // -----------------------------------------------------

        this.liveMarket.on(
            "update",
            state => {

                /*
                 * IMPORTANT:
                 *
                 * This only updates display data.
                 *
                 * It does NOT modify:
                 *
                 * - Pine signal
                 * - Pine entry
                 * - Pine Trail SL
                 * - Pine status
                 * - Pine P/L
                 */

                this.display.setMarketState(
                    state
                );

                // Track the last VALID market tick for the feed watchdog.
                // IMPORTANT: use the SERVER receipt time (receivedAt), NOT
                // Shoonya's market timestamp (tickTime). Shoonya's ft can lag
                // (or otherwise differ from) the clock, so it is never valid
                // for a freshness/staleness calculation.
                const receivedAt =
                    Number(
                        state?.receivedAt ||
                        state?.price?.receivedAt ||
                        0
                    );
                const hadTick =
                    Number.isFinite(
                        Number(
                            state?.price?.price
                        )
                    );

                if (
                    hadTick &&
                    receivedAt > 0
                ) {
                    this.lastValidTickAt =
                        receivedAt;
                    this.feedConnecting =
                        false;
                    this.feedReconnecting =
                        false;
                }

            }
        );


        // -----------------------------------------------------
        // CONNECTION
        // -----------------------------------------------------

        this.liveMarket.on(
            "connected",
            () => {

                this.feedConnecting =
                    false;
                this.feedReconnecting =
                    false;

                console.log("");
                console.log(
                    "[shoonya] websocket connected"
                );

                this.emit(
                    "market-connected"
                );

            }
        );


        // -----------------------------------------------------
        // DISCONNECTION
        // -----------------------------------------------------

        this.liveMarket.on(
            "disconnected",
            reason => {

                this.feedConnecting =
                    false;

                console.log("");
                console.log(
                    "[shoonya] websocket disconnected — scheduling reconnect"
                );

                if (reason) {
                    console.log(
                        "Reason:",
                        reason
                    );
                }

                this.emit(
                    "market-disconnected",
                    reason
                );

            }
        );


        // -----------------------------------------------------
        // ERROR
        // -----------------------------------------------------

        this.liveMarket.on(
            "error",
            error => {

                console.error("");

                console.error(
                    "Live market error:",
                    error?.message ||
                    error
                );


                this.emit(
                    "market-error",
                    error
                );

            }
        );


        // -----------------------------------------------------
        // AUTH FAILURE (invalid session)
        //
        // One shared re-authentication flow for the
        // whole app; the feed must never keep
        // reconnecting with a token Shoonya
        // rejected.
        // -----------------------------------------------------

        this.liveMarket.on(
            "auth-failed",
            () => {

                this.handleAuthFailure()
                    .catch(() => {});

            }
        );


        // Mark the feed as having been started (used by the watchdog to know
        // live ticks are expected).
        this.feedStarted =
            true;
        this.feedConnecting =
            true;

        await this.liveMarket.start();
    }


    // =========================================================
    // RUN PINE STRATEGY
    // =========================================================

    runStrategy() {

        console.log("");

        console.log(
            "Running BullionAI strategy..."
        );


        /*
         * IMPORTANT:
         *
         * StrategyEngine:
         *
         * 1. Verifies Pine integrity.
         * 2. Executes the actual BullionAI.pine.
         * 3. Reads the PineTS output.
         *
         * No strategy formula is recreated here.
         */

        const result =
            this.strategy.run();


        this.strategyState =
            result.state;


        this.display.setStrategyState(
            this.strategyState
        );


        return result;
    }


    // =========================================================
    // INITIALIZE
    // =========================================================
    async initialize() {

        /*
         * Join-safe: concurrent callers (background
         * boot + HTTP login) share ONE startup so
         * the feed/strategy can never be started
         * twice.
         */

        if (
            this.initialized
        ) {

            return this.display.getState();

        }

        if (
            !this.initializingPromise
        ) {

            this.initializingPromise =

                this.doInitialize()

                    .finally(
                        () => {

                            this.initializingPromise =
                                null;

                        }
                    );

        }

        return this.initializingPromise;

    }


    async doInitialize() {

        this.initializing =
            true;

        try {

            const authVerdict =
                await this.authenticate();

            if (
                authVerdict ===
                    "login_required" ||
                !this.session.isAuthenticated()
            ) {

                // No valid Shoonya session and we are in a non-interactive
                // host (Render). Do NOT block startup or fake a feed. Mark
                // LOGIN_REQUIRED so the HTTP API stays healthy and the
                // dashboard shows the "Login to Shoonya" action. A fresh
                // /api/shoonya/login re-triggers this sequence.
                this.initialized =
                    true;

                console.log(
                    "[shoonya] login required — live feed paused until manual authentication"
                );

                this.emit(
                    "update",
                    this.display.getState()
                );

                return this.display.getState();

            }


            console.log("");
            console.log(
                "Starting live market feed..."
            );


            await this.startLiveMarket();


            console.log("[shoonya] live feed active");
            console.log(
                "[shoonya] subscriptions restored"
            );


            console.log("");

            console.log(
                "Executing initial Pine strategy state..."
            );

            // Fresh-host bootstrap: ensure runtime candle file exists via
            // legitimate historical backfill before Pine execution.
            await this.ensureStrategyCandles().catch(
                () => false
            );

            try {
                this.runStrategy();
            } catch (error) {
                const msg =
                    String(
                        error?.message ||
                        error ||
                        ""
                    );
                if (
                    msg.includes(
                        "Candles file not found"
                    ) ||
                    msg.includes(
                        "zero candles"
                    )
                ) {
                    console.log(
                        "[coordinator] strategy skipped — no candles yet, live aggregator will build history"
                    );
                    // Safe no-data state — keep API alive, future ticks will populate
                    this.strategyState = null;
                    try {
                        this.display.setStrategyState({
                            signal: "NONE",
                            status: "no-data",
                            entryPrice: null,
                            trailSL: null,
                            candleCount: 0,
                        });
                    } catch {}
                } else {
                    throw error;
                }
            }


            this.initialized =
                true;


            console.log("");

            console.log(
                "===================================="
            );

            console.log(
                "       BULLIONAI LIVE READY"
            );

            console.log(
                "===================================="
            );

            console.log(
                "Timeframe:",
                this.timeframe
            );

            console.log(
                "Strategy:",
                this.strategyState?.signal
            );

            console.log(
                "Status:",
                this.strategyState?.status
            );

            console.log(
                "Entry:",
                this.strategyState?.entryPrice
            );

            console.log(
                "Trail SL:",
                this.strategyState?.trailSL
            );

            console.log(
                "===================================="
            );


            return this.display.getState();

        } finally {

            this.initializing =
                false;

        }

    }


    // =========================================================
    // REFRESH STRATEGY
    // =========================================================

    refreshStrategy() {

        if (
            !this.initialized
        ) {

            throw new Error(
                "Coordinator must be initialized first."
            );

        }


        return this.runStrategy();
    }


    // =========================================================
    // GET DISPLAY STATE
    // =========================================================

    getState() {

        return this.display.getState();
    }


    // Session lifecycle snapshot for the dashboard (no secrets).
    getSessionStatus() {

        const market =
            this.display?.getState?.()?.market ||
            null;

        const session =
            this.session?.getState?.() ||
            null;

        const feed =
            this.liveMarket?.feed?.getState?.() ||
            null;

        const authenticated = Boolean(
            session?.authenticated &&
            !session?.expired
        );

        const feedConnected = Boolean(
            market?.connected ||
            feed?.connected
        );

        // Feed lifecycle: derive connecting / reconnecting / stale.
        // marketTickTime = Shoonya's feed timestamp (display only).
        const marketTickTime =
            market?.tickTime ?? null;

        // receivedAt = BullionAI server receipt time of the last price update.
        const receivedAt =
            market?.receivedAt ?? null;

        // Stale is computed ONLY from the SERVER receipt time of the last
        // valid tick (lastValidTickAt) — never from Shoonya's market
        // timestamp, which can lag the wall clock.
        const staleThresholdMs =
            Number(
                process.env.BULLIONAI_FEED_STALE_MS ||
                90_000
            );
        const now = Date.now();
        const stale =
            !!(
                this.feedStarted &&
                authenticated &&
                this.lastValidTickAt &&
                now - this.lastValidTickAt >
                    staleThresholdMs
            );

        let feedState;
        if (!authenticated) {
            feedState = "disconnected";
        } else if (feedConnected) {
            feedState = "connected";
        } else if (this.feedReconnecting) {
            feedState = "reconnecting";
        } else if (this.feedConnecting) {
            feedState = "connecting";
        } else if (stale) {
            feedState = "stale";
        } else {
            feedState = "connecting";
        }

        let status;
        if (!authenticated) {
            status = "login_required"; // LOGIN_REQUIRED
        } else if (stale) {
            status = "stale"; // FEED_STALE
        } else if (feedConnected) {
            status = "connected"; // FEED_CONNECTED
        } else if (this.feedReconnecting) {
            status = "reconnecting"; // RECONNECTING
        } else {
            status = "connecting"; // FEED_CONNECTING
        }

        return {
            api: "ready",
            authenticated,
            feedConnected,
            status,
            feedState,
            shoonya: authenticated
                ? "authenticated"
                : "login_required",
            feed: feedConnected
                ? "connected"
                : this.feedReconnecting
                    ? "reconnecting"
                    : this.feedConnecting
                        ? "connecting"
                        : stale
                            ? "stale"
                            : "disconnected",
            loginRequired:
                Boolean(this.loginRequired),
            uid: authenticated ? session.uid : null,
            actid: authenticated ? session.actid : null,
            authenticatedAt: session?.authenticatedAt ?? null,
            expiresAt: session?.expiresAt ?? null,
            expired: Boolean(session?.expired),
            // Server receipt time of the last valid tick (watchdog-relevant).
            lastTickAt:
                receivedAt ?? null,
            // Shoonya's market feed timestamp of the last tick (display only).
            marketTickTime:
                marketTickTime,
            // BullionAI server receipt time of the last price update.
            receivedAt:
                receivedAt,
            feedStarted:
                Boolean(this.feedStarted),
            feedReconnecting:
                Boolean(this.feedReconnecting),
            watchdog: {
                staleMs: staleThresholdMs,
                stale,
            },
            feedDetails: feed
                ? {
                      connected: feed.connected,
                      subscribed: feed.subscribed,
                      authFailed: feed.authFailed,
                      reconnectAttempt: feed.reconnectAttempt,
                  }
                : null,
            session,
        };
    }


    // =========================================================
    // START
    // =========================================================

    async start() {

        if (
            this.running
        ) {

            return this.getState();

        }


        await this.initialize();


        this.running =
            true;


        return this.getState();
    }


    // =========================================================
    // STOP
    // =========================================================

    async stop() {

        if (
            this.liveMarket
        ) {

            await this.liveMarket.stop();

        }


        this.running =
            false;

        this.initialized =
            false;


        console.log("");

        console.log(
            "BullionAI live coordinator stopped."
        );
    }
}


module.exports = {
    BullionAILiveCoordinator,
};