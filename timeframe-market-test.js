require("dotenv").config();

const {
    MarketDataService,
} = require("./src/market/market-data-service");

const {
    CandleDataManager,
} = require("./src/market/candle-data-manager");

const {
    getTimeframe,
} = require("./src/config/timeframe-config");

async function main() {
    try {
        const requestedTimeframe =
            process.argv[2] || "60m";

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
        // OUTPUT
        // =====================================================

        console.log("");

        console.log(
            "===================================="
        );

        console.log(
            "       TIMEFRAME MARKET TEST"
        );

        console.log(
            "===================================="
        );

        console.log(
            "Requested:",
            requestedTimeframe
        );

        console.log(
            "Normalized:",
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
            "Dataset:",
            dataManager.getFileName(
                timeframe.key
            )
        );

        console.log(
            "Dataset path:",
            dataManager.getFilePath(
                timeframe.key
            )
        );

        const existing =
            dataManager.load(
                timeframe.key
            );

        console.log(
            "Existing candles:",
            existing.length
        );

        if (existing.length) {
            console.log(
                "First candle:",
                new Date(
                    existing[0].time
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

        console.log("");

        console.log(
            "Market service configured."
        );

        console.log(
            "Exchange:",
            market.exchange
        );

        console.log(
            "Token:",
            market.token
        );

        console.log(
            "Interval:",
            market.interval
        );

        console.log(
            "===================================="
        );

    } catch (error) {
        console.log("");

        console.log(
            "TIMEFRAME MARKET TEST FAILED:"
        );

        console.error(
            error.message
        );

        process.exitCode = 1;
    }
}

main();