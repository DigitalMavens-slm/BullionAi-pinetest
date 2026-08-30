require("dotenv").config();

const EventEmitter = require("events");

const {
    MarketDataService,
} = require("../market/market-data-service");

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

            throw new Error(
                "Shoonya client ID is missing."
            );

        }


        if (
            !this.secretCode
        ) {

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

        await this.ensureFreshSession();

        console.log("");

        console.log(
            "Session ready:",
            this.session.isAuthenticated()
        );
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

                    this.session
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

        while (
            !this.session
                .isAuthenticated()
        ) {

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


        if (
            !this.initialized
        ) {

            /*
             * Boot-time login: complete the normal
             * startup sequence that was left
             * pending.
             */

            this.running =
                true;

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

            }
        );


        // -----------------------------------------------------
        // CONNECTION
        // -----------------------------------------------------

        this.liveMarket.on(
            "connected",
            () => {

                console.log("");

                console.log(
                    "Live market WebSocket connected."
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

                console.log("");

                console.log(
                    "Live market WebSocket disconnected."
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

            await this.authenticate();


            console.log("");

            console.log(
                "Starting live market feed..."
            );


            await this.startLiveMarket();


            console.log("");

            console.log(
                "Executing initial Pine strategy state..."
            );


            this.runStrategy();


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