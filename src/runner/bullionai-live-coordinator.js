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

        this.strategy =
            new StrategyEngine({
                strategyFile:
                    "BullionAI.pine",

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
         *    survives restarts.
         *
         * 1. Drop file  data/shoonya-auth.txt
         *
         * 2. Interactive console prompt
         *
         * 3. Non-interactive → keep polling
         *    the drop file until it appears.
         */

        if (

            !this.session
                .isAuthenticated()

        ) {

            let restored =
                false;

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

                console.log(
                    "Session restored from data/shoonya-session.json"
                );

            }

        }


        const dropFile =
            "data/shoonya-auth.txt";


        let viaFile =
            false;


        try {

            viaFile =
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


        const isAuthenticated =

            this.session
                .isAuthenticated();


        if (isAuthenticated) {

            /*
             * Already logged in — either
             * restored from disk or via
             * drop file. Skip login flow.
             */

        } else {

            const isInteractive =

                Boolean(
                    process.stdin &&
                    process.stdin.isTTY
                );

            if (isInteractive) {

                await this.session
                    .authenticateFromConsole();

            } else {

                console.log(
                    "Non-interactive session detected."
                );

                console.log(
                    "Waiting for auth drop file:",
                    dropFile
                );

                while (
                    !this.session
                        .isAuthenticated()
                ) {

                    let consumed =
                        false;

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

        }


        console.log("");

        console.log(
            "Session ready:",
            this.session.isAuthenticated()
        );
    }


    // =========================================================
    // START LIVE MARKET
    // =========================================================

    async startLiveMarket() {

        /*
         * Subscribe to BOTH instruments
         * over a single WebSocket:
         *
         * gold   -> SHOONYA_GOLD_TOKEN
         * silver -> SHOONYA_SILVER_TOKEN
         */

        const goldToken =
            process.env
                .SHOONYA_GOLD_TOKEN ||
            this.token;

        const silverToken =
            process.env
                .SHOONYA_SILVER_TOKEN;

        const tokens = [

            String(
                goldToken
            ),

        ];


        if (
            silverToken &&
            String(silverToken) !==
                String(goldToken)
        ) {

            tokens.push(
                String(
                    silverToken
                )
            );

        }


        this.liveMarket =
            new LiveMarketState({

                marketDataService:
                    this.market,

                exchange:
                    this.exchange,

                token:
                    this.token,

                tokens,
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

        if (
            this.initialized
        ) {

            return this.display.getState();

        }


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