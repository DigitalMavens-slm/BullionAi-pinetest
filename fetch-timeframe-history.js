require("dotenv").config();

const {
    MarketDataService,
} = require("./src/market/market-data-service");

const {
    ShoonyaSessionManager,
} = require("./src/auth/shoonya-session-manager");

const {
    CandleDataManager,
} = require("./src/market/candle-data-manager");

const {
    getTimeframe,
} = require("./src/config/timeframe-config");

async function main() {
    try {
        const requestedTimeframe =
            process.argv[2] || "15m";

        const timeframe =
            getTimeframe(
                requestedTimeframe
            );

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

        const exchange =
            process.env.SHOONYA_EXCHANGE ||
            "MCX";

        const token =
            process.env.SHOONYA_TOKEN ||
            "483079";

        // =====================================================
        // DATA MANAGER
        // =====================================================

        const dataManager =
            new CandleDataManager({
                dataDirectory:
                    "./data",

                exchange,

                token,
            });

        // =====================================================
        // MARKET SERVICE
        // =====================================================

        const market =
            new MarketDataService({
                clientId,

                secretCode,

                exchange,

                token,

                interval:
                    timeframe.interval,

                baseUrl:
                    process.env.SHOONYA_BASE_URL ||
                    "https://api.shoonya.com",
            });

        // =====================================================
        // SESSION MANAGER
        // =====================================================

        const session =
            new ShoonyaSessionManager(
                market
            );

        // =====================================================
        // HEADER
        // =====================================================

        console.log("");

        console.log(
            "===================================="
        );

        console.log(
            "       TIMEFRAME HISTORY FETCH"
        );

        console.log(
            "===================================="
        );

        console.log(
            "Timeframe:",
            timeframe.key
        );

        console.log(
            "Label:",
            timeframe.label
        );

        console.log(
            "Shoonya interval:",
            timeframe.interval
        );

        console.log(
            "Exchange:",
            exchange
        );

        console.log(
            "Token:",
            token
        );

        console.log(
            "Dataset:",
            dataManager.getFileName(
                timeframe.key
            )
        );

        console.log(
            "===================================="
        );

        // =====================================================
        // AUTHENTICATION
        // =====================================================

        console.log("");

        await session
            .authenticateFromConsole();

        // =====================================================
        // EXISTING DATA
        // =====================================================

        const existing =
            dataManager.load(
                timeframe.key
            );

        console.log("");

        console.log(
            "Existing dataset:",
            existing.length,
            "candles"
        );

        if (existing.length) {
            console.log(
                "Latest existing candle:",
                new Date(
                    existing[
                        existing.length - 1
                    ].time
                ).toLocaleString(
                    "en-IN",
                    {
                        timeZone:
                            "Asia/Kolkata",
                    }
                )
            );
        }

        // =====================================================
        // FETCH HISTORY
        // =====================================================

        console.log("");

        console.log(
            "Requesting Shoonya historical candles..."
        );

        const result =
            await market.updateCandles(
                existing,
                {
                    lookbackSeconds:
                        timeframe.key === "1D"
                            ? 7 * 24 * 60 * 60
                            : 30 * 24 * 60 * 60,

                    overlapSeconds:
                        timeframe.seconds,
                }
            );

        const candles =
            result.candles || [];

        // =====================================================
        // SAVE DATASET
        // =====================================================

        const filePath =
            dataManager.save(
                timeframe.key,
                candles
            );

        // =====================================================
        // RESULT
        // =====================================================

        console.log("");

        console.log(
            "===================================="
        );

        console.log(
            "       HISTORY FETCH COMPLETE"
        );

        console.log(
            "===================================="
        );

        console.log(
            "Timeframe:",
            timeframe.key
        );

        console.log(
            "Shoonya candles fetched:",
            result.fetched
        );

        console.log(
            "Previous candles:",
            result.previousCount
        );

        console.log(
            "Final candles:",
            candles.length
        );

        console.log(
            "Net new candles:",
            result.added
        );

        console.log(
            "File:",
            filePath
        );

        if (candles.length) {
            console.log(
                "First candle:",
                new Date(
                    candles[0].time
                ).toLocaleString(
                    "en-IN",
                    {
                        timeZone:
                            "Asia/Kolkata",
                    }
                )
            );

            console.log(
                "Latest candle:",
                new Date(
                    candles[
                        candles.length - 1
                    ].time
                ).toLocaleString(
                    "en-IN",
                    {
                        timeZone:
                            "Asia/Kolkata",
                    }
                )
            );
        }

        console.log(
            "===================================="
        );

    } catch (error) {
        console.log("");

        console.log(
            "===================================="
        );

        console.log(
            "       HISTORY FETCH FAILED"
        );

        console.log(
            "===================================="
        );

        console.error(
            error.message
        );

        console.log(
            "===================================="
        );

        process.exitCode = 1;
    }
}

main();