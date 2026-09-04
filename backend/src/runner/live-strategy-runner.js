require("dotenv").config();

const path = require("path");

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
    getTimeframe,
} = require("../config/timeframe-config");

const {
    formatISTDateTime,
} = require("../utils/ist-time");

const {
    StrategyEngine,
} = require("../strategy/strategy-engine");


class LiveStrategyRunner {

    constructor({
        timeframe = "60m",
        instrument = "gold",
    } = {}) {

        this.projectRoot =
            process.cwd();

        // =====================================================
        // TIMEFRAME
        // =====================================================

        this.timeframe =
            getTimeframe(
                timeframe
            );

        // =====================================================
        // INSTRUMENT
        // =====================================================

        this.instrument =
            String(
                instrument
            )
                .trim()
                .toLowerCase() ===
            "silver"
                ? "silver"
                : "gold";

        // =====================================================
        // ENVIRONMENT
        // =====================================================

        const clientId =
            process.env.SHOONYA_CLIENT_ID ||
            process.env.SHOONYA_USER_ID ||
            process.env.CLIENT_ID;

        const secretCode =
            process.env.SHOONYA_SECRET_CODE ||
            process.env.SHOONYA_SECRET ||
            process.env.SECRET_CODE;

        if (!clientId) {
            throw new Error(
                "Missing Shoonya client ID."
            );
        }

        if (!secretCode) {
            throw new Error(
                "Missing Shoonya secret code."
            );
        }

        this.exchange =
            process.env.SHOONYA_EXCHANGE ||
            "MCX";

        this.token =

            this.instrument ===
            "silver"

                ? process.env
                      .SHOONYA_SILVER_TOKEN ||
                  "471725"

                : process.env
                      .SHOONYA_GOLD_TOKEN ||
                  process.env
                      .SHOONYA_TOKEN ||
            "483079";

        // =====================================================
        // DATA MANAGER
        // =====================================================

        this.dataManager =
            new CandleDataManager({
                dataDirectory:
                    "./data",

                exchange:
                    this.exchange,

                token:
                    this.token,
            });

        // =====================================================
        // MARKET DATA SERVICE
        // =====================================================

        this.market =
            new MarketDataService({

                clientId,

                secretCode,

                exchange:
                    this.exchange,

                token:
                    this.token,

                interval:
                    this.timeframe.interval,

                baseUrl:
                    process.env.SHOONYA_BASE_URL ||
                    "https://api.shoonya.com",
            });

        // =====================================================
        // SESSION MANAGER
        // =====================================================

        this.session =
            new ShoonyaSessionManager(
                this.market
            );

        // =====================================================
        // STRATEGY
        // =====================================================

        this.strategyFile =
            path.join(
                this.projectRoot,
                "BullionAI.pine"
            );

        // =====================================================
        // INITIALIZATION STATE
        // =====================================================

        this.initialized =
            false;
    }


    // =========================================================
    // INITIALIZE
    // =========================================================

    async initialize() {

        if (
            this.initialized
        ) {
            return;
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
            this.timeframe.key
        );

        console.log(
            "Interval:",
            this.timeframe.interval
        );

        console.log(
            "Exchange:",
            this.exchange
        );

        console.log(
            "Token:",
            this.token
        );

        console.log(
            "Dataset:",
            this.dataManager.getFileName(
                this.timeframe.key
            )
        );

        // -----------------------------------------------------
        // Authenticate exactly once.
        // -----------------------------------------------------

        if (
            !this.session.isAuthenticated()
        ) {

            await this.session
                .authenticateFromConsole();

        }

        console.log("");

        console.log(
            "Session ready:",
            this.session.isAuthenticated()
        );

        this.initialized =
            true;

        console.log(
            "Live runner initialized."
        );

        console.log(
            "===================================="
        );
    }


    // =========================================================
    // LOAD CANDLES
    // =========================================================

    loadCandles() {

        return this.dataManager.load(
            this.timeframe.key
        );

    }


    // =========================================================
    // CHECK SESSION
    // =========================================================

    async ensureSession() {

        if (
            this.session.isAuthenticated()
        ) {

            return true;

        }

        console.log("");

        console.log(
            "Shoonya session is not available."
        );

        console.log(
            "Re-authentication required."
        );

        await this.session
            .authenticateFromConsole();

        return this.session
            .isAuthenticated();
    }


    // =========================================================
    // RUN ONE MARKET CYCLE
    // =========================================================

    async run() {

        await this.initialize();

        console.log("");

        console.log(
            "===================================="
        );

        console.log(
            "       BULLIONAI LIVE CYCLE"
        );

        console.log(
            "===================================="
        );

        console.log(
            "Timeframe:",
            this.timeframe.key
        );

        // =====================================================
        // 1. ENSURE SESSION
        // =====================================================

        await this.ensureSession();

        // =====================================================
        // 2. LOAD EXISTING DATA
        // =====================================================

        const before =
            this.loadCandles();

        console.log("");

        console.log(
            "Existing candles:",
            before.length
        );

        if (
            before.length > 0
        ) {

            const latest =
                before[
                    before.length - 1
                ];

            console.log(
                "Latest candle:",
                formatISTDateTime(
                    latest.time
                )
            );

        }

        // =====================================================
        // 3. UPDATE MARKET DATA
        // =====================================================

        console.log("");

        console.log(
            "Updating",
            this.timeframe.key,
            "market data..."
        );

        const result =
            await this.market.updateCandles(
                before,
                {
                    interval:
                        this.timeframe.interval,

                    overlapSeconds:
                        this.timeframe.seconds,

                    lookbackSeconds:
                        30 * 24 * 60 * 60,
                }
            );

        const updated =
            result.candles || [];

        // =====================================================
        // 4. SAVE DATASET
        // =====================================================

        const filePath =
            this.dataManager.save(
                this.timeframe.key,
                updated
            );

        const added =
            result.added ??
            Math.max(
                0,
                updated.length -
                before.length
            );

        console.log("");

        console.log(
            "===================================="
        );

        console.log(
            "       MARKET DATA UPDATE"
        );

        console.log(
            "===================================="

        );

        console.log(
            "Timeframe:",
            this.timeframe.key
        );

        console.log(
            "Previous candles:",
            before.length
        );

        console.log(
            "Shoonya candles fetched:",
            result.fetched
        );

        console.log(
            "Final candles:",
            updated.length
        );

        console.log(
            "Net new candles:",
            added
        );

        console.log(
            "File:",
            filePath
        );

        console.log(
            "===================================="
        );

        // =====================================================
        // 5. NO NEW CANDLE
        // =====================================================

        if (
            added === 0
        ) {

            console.log("");

            console.log(
                "No new candle detected."
            );

            console.log(
                "Strategy execution skipped."
            );

            return {

                timeframe:
                    this.timeframe.key,

                newCandle:
                    false,

                candles:
                    updated,

                strategy:
                    null,
            };

        }

        // =====================================================
        // 6. NEW CANDLE
        // =====================================================

        console.log("");

        console.log(
            "New candle detected."
        );

        console.log(
            "Running BullionAI strategy..."
        );

        // =====================================================
        // 7. RUN PINE
        // =====================================================

        const strategy =
            new StrategyEngine({

                strategyFile:
                    "BullionAI.pine",

                candlesFile:
                    path.relative(
                        this.projectRoot,
                        filePath
                    ),

                resultsFile:
                    `results-${this.timeframe.key}.json`,
            });

        const output =
            strategy.run();

        const state =
            output.state;

        // =====================================================
        // 8. DISPLAY STRATEGY STATE
        // =====================================================

        console.log("");

        console.log(
            "===================================="
        );

        console.log(
            "       CURRENT STRATEGY STATE"
        );

        console.log(
            "===================================="
        );

        console.log(
            "Timeframe:",
            this.timeframe.key
        );

        console.log(
            "Signal:",
            state.signal
        );

        console.log(
            "Status:",
            state.status
        );

        console.log(
            "Entry:",
            state.entryPrice
        );

        console.log(
            "Trail SL:",
            state.trailSL
        );

        console.log(
            "Extreme:",
            state.extremePrice
        );

        console.log(
            "Current P/L:",
            state.currentPL
        );

        console.log(
            "Best P/L:",
            state.bestPL
        );

        console.log(
            "Realized P/L:",
            state.realizedPL
        );

        console.log(
            "Current Price:",
            state.currentCandle?.close
        );

        console.log(
            "Candles:",
            state.candleCount
        );

        console.log(
            "===================================="
        );

        return {

            timeframe:
                this.timeframe.key,

            newCandle:
                true,

            candles:
                updated,

            strategy:
                state,
        };
    }
}


// =============================================================
// EXPORT
// =============================================================

module.exports = {
    LiveStrategyRunner,
};


// =============================================================
// CLI ENTRY
// =============================================================

async function main() {

    try {

        const requestedTimeframe =
            process.argv[2] ||
            "60m";

        const requestedInstrument =
            process.argv[3] ||
            "gold";

        const runner =
            new LiveStrategyRunner({
                timeframe:
                    requestedTimeframe,

                instrument:
                    requestedInstrument,
            });

        await runner.run();

    } catch (error) {

        console.log("");

        console.log(
            "===================================="
        );

        console.log(
            "       LIVE RUNNER FAILED"
        );

        console.log(
            "===================================="
        );

        console.error(
            error.message ||
            error
        );

        console.log(
            "===================================="
        );

        process.exitCode = 1;
    }
}


if (
    require.main === module
) {

    main();

}
