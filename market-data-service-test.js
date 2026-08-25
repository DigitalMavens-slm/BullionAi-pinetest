require("dotenv").config();

const fs = require("fs");
const readline = require("readline");

const {
    MarketDataService,
} = require("./src/market/market-data-service");

// ============================================================
// CONFIG
// ============================================================

const DATA_FILE = "./candles.json";

const service = new MarketDataService({
    clientId:
        process.env.SHOONYA_CLIENT_ID,

    secretCode:
        process.env.SHOONYA_SECRET_CODE,

    exchange:
        process.env.SHOONYA_EXCHANGE || "MCX",

    token:
        process.env.SHOONYA_GOLD_TOKEN || "483079",

    interval:
        process.env.SHOONYA_INTERVAL || "60",
});

// ============================================================
// HELPERS
// ============================================================

function loadCandles() {
    if (!fs.existsSync(DATA_FILE)) {
        return [];
    }

    const data = JSON.parse(
        fs.readFileSync(DATA_FILE, "utf8")
    );

    if (!Array.isArray(data)) {
        throw new Error(
            "candles.json must contain an array."
        );
    }

    return data;
}

function saveCandles(candles) {
    fs.writeFileSync(
        DATA_FILE,
        JSON.stringify(
            candles,
            null,
            2
        ),
        "utf8"
    );
}

function formatTime(timestamp) {
    return new Date(
        timestamp
    ).toLocaleString(
        "en-IN",
        {
            timeZone:
                "Asia/Kolkata",
            hour12: false,
        }
    );
}

// ============================================================
// MAIN
// ============================================================

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

rl.question(
    "Paste fresh Shoonya redirect URL: ",
    async (redirectUrl) => {

        try {

            console.log("");
            console.log(
                "Loading existing candle data..."
            );

            const existingCandles =
                loadCandles();

            console.log(
                "Existing candles:",
                existingCandles.length
            );

            if (
                existingCandles.length > 0
            ) {
                const latest =
                    existingCandles[
                        existingCandles.length - 1
                    ];

                console.log(
                    "Latest stored candle:",
                    formatTime(
                        latest.time
                    )
                );
            }

            // =================================================
            // AUTHENTICATE
            // =================================================

            const url =
                new URL(
                    redirectUrl.trim()
                );

            const code =
                url.searchParams.get(
                    "code"
                );

            if (!code) {
                throw new Error(
                    "Authorization code not found in redirect URL."
                );
            }

            console.log(
                "Authorization code detected."
            );

            console.log(
                "Authenticating with Shoonya..."
            );

            const session =
                await service.authenticate(
                    code
                );

            console.log("");
            console.log(
                "Shoonya authentication successful."
            );

            console.log(
                "User:",
                session.uid
            );

            console.log(
                "Account:",
                session.actid
            );

            // =================================================
            // UPDATE DATA
            // =================================================

            console.log("");
            console.log(
                "Updating market data..."
            );

            const result =
                await service.updateCandles(
                    existingCandles
                );

            // =================================================
            // SAVE
            // =================================================

            saveCandles(
                result.candles
            );

            // =================================================
            // REPORT
            // =================================================

            console.log("");
            console.log(
                "===================================="
            );

            console.log(
                "       MARKET DATA SERVICE"
            );

            console.log(
                "===================================="
            );

            console.log(
                "Exchange:",
                process.env.SHOONYA_EXCHANGE ||
                "MCX"
            );

            console.log(
                "Token:",
                process.env.SHOONYA_GOLD_TOKEN ||
                "483079"
            );

            console.log(
                "Interval:",
                process.env.SHOONYA_INTERVAL ||
                "60",
                "minutes"
            );

            console.log(
                "Previous candles:",
                result.previousCount
            );

            console.log(
                "Shoonya candles:",
                result.fetched
            );

            console.log(
                "Updated candles:",
                result.updatedCount
            );

            console.log(
                "Net new candles:",
                result.added
            );

            if (
                result.candles.length > 0
            ) {
                console.log(
                    "First candle:",
                    formatTime(
                        result.candles[0].time
                    )
                );

                console.log(
                    "Latest candle:",
                    formatTime(
                        result.candles[
                            result.candles.length - 1
                        ].time
                    )
                );
            }

            console.log(
                "File:",
                DATA_FILE
            );

            console.log(
                "===================================="
            );

        } catch (error) {

            console.error("");
            console.error(
                "===================================="
            );

            console.error(
                "       MARKET DATA FAILED"
            );

            console.error(
                "===================================="
            );

            console.error(
                error.message ||
                error
            );

            console.error(
                "===================================="
            );

        } finally {

            rl.close();

        }
    }
);