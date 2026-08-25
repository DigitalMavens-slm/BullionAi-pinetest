require("dotenv").config();

const fs = require("fs");
const { ShoonyaClient } = require("shoonya-api-js");
const readline = require("readline");

// ============================================================
// CONFIG
// ============================================================

const CLIENT_ID = process.env.SHOONYA_CLIENT_ID;
const SECRET_CODE = process.env.SHOONYA_SECRET_CODE;

const EXCHANGE = process.env.SHOONYA_EXCHANGE || "MCX";
const TOKEN = process.env.SHOONYA_GOLD_TOKEN || "483079";

const INTERVAL = "60";

const DATA_FILE = "candles.json";

// Fetch a small overlap before the last candle.
// This protects us from corrections/updates to the latest candle.
const OVERLAP_SECONDS = 2 * 60 * 60;

// ============================================================
// VALIDATION
// ============================================================

if (!CLIENT_ID || !SECRET_CODE) {
    console.error("");
    console.error("Missing Shoonya credentials.");
    console.error("Check your .env file.");
    process.exit(1);
}

// ============================================================
// SHOONYA CLIENT
// ============================================================

const client = new ShoonyaClient({
    baseUrl: "https://api.shoonya.com",
});

// ============================================================
// HELPERS
// ============================================================

function loadExistingCandles() {
    if (!fs.existsSync(DATA_FILE)) {
        console.log("No existing candles.json found.");
        return [];
    }

    try {
        const data = JSON.parse(
            fs.readFileSync(DATA_FILE, "utf8")
        );

        if (!Array.isArray(data)) {
            throw new Error("candles.json is not an array.");
        }

        return data;
    } catch (error) {
        throw new Error(
            `Unable to read ${DATA_FILE}: ${error.message}`
        );
    }
}

function normalizeShoonyaCandle(candle) {
    // Shoonya provides ssboe as Unix seconds.
    // Fall back to parsing "time" if ssboe isn't present.

    let timestampSeconds;

    if (candle.ssboe !== undefined) {
        timestampSeconds = Number(candle.ssboe);
    } else if (candle.time) {
        // Expected format:
        // DD-MM-YYYY HH:mm:ss

        const parts = String(candle.time).split(" ");

        if (parts.length >= 2) {
            const dateParts = parts[0].split("-");
            const timeParts = parts[1].split(":");

            if (
                dateParts.length === 3 &&
                timeParts.length >= 2
            ) {
                const day = Number(dateParts[0]);
                const month = Number(dateParts[1]) - 1;
                const year = Number(dateParts[2]);

                const hour = Number(timeParts[0]);
                const minute = Number(timeParts[1]);
                const second = Number(timeParts[2] || 0);

                const dt = new Date(
                    year,
                    month,
                    day,
                    hour,
                    minute,
                    second
                );

                timestampSeconds = Math.floor(
                    dt.getTime() / 1000
                );
            }
        }
    }

    if (!Number.isFinite(timestampSeconds)) {
        return null;
    }

    return {
        open: Number(candle.into),
        high: Number(candle.inth),
        low: Number(candle.intl),
        close: Number(candle.intc),

        volume: Number(
            candle.v ??
            candle.intv ??
            0
        ),

        openInterest: Number(
            candle.oi ?? 0
        ),

        // candles.json uses milliseconds
        time: timestampSeconds * 1000,
    };
}

function isValidCandle(candle) {
    return (
        Number.isFinite(candle.time) &&
        Number.isFinite(candle.open) &&
        Number.isFinite(candle.high) &&
        Number.isFinite(candle.low) &&
        Number.isFinite(candle.close) &&
        Number.isFinite(candle.volume) &&
        Number.isFinite(candle.openInterest)
    );
}

function formatTime(timestamp) {
    return new Date(timestamp).toLocaleString(
        "en-IN",
        {
            timeZone: "Asia/Kolkata",
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

            // =================================================
            // 1. LOAD EXISTING DATA
            // =================================================

            const existingCandles =
                loadExistingCandles();

            console.log("");
            console.log(
                "Existing candles:",
                existingCandles.length
            );

            let latestTime = 0;

            if (existingCandles.length > 0) {

                latestTime = Math.max(
                    ...existingCandles.map(
                        c => Number(c.time) || 0
                    )
                );

                console.log(
                    "Latest stored candle:",
                    formatTime(latestTime)
                );
            }

            // =================================================
            // 2. READ OAUTH CODE
            // =================================================

            const url = new URL(
                redirectUrl.trim()
            );

            const code =
                url.searchParams.get("code");

            if (!code) {
                throw new Error(
                    "Authorization code not found in redirect URL."
                );
            }

            console.log(
                "Authorization code detected."
            );

            // =================================================
            // 3. CHECKSUM
            // =================================================

            const checksum =
                ShoonyaClient.generateChecksum(
                    CLIENT_ID,
                    SECRET_CODE,
                    code
                );

            console.log(
                "Checksum generated."
            );

            // =================================================
            // 4. AUTHENTICATE
            // =================================================

            console.log(
                "Requesting Shoonya access token..."
            );

            const session =
                await client.generateAccessToken({
                    code,
                    checksum,
                });

            const uid =
                session.USERID ||
                session.uid;

            console.log("");
            console.log(
                "Shoonya authentication successful."
            );
            console.log("User:", uid);
            console.log(
                "Account:",
                session.actid || uid
            );

            // =================================================
            // 5. CALCULATE UPDATE WINDOW
            // =================================================

            const nowSeconds =
                Math.floor(
                    Date.now() / 1000
                );

            let startSeconds;

            if (latestTime > 0) {

                // Convert milliseconds → seconds
                const latestSeconds =
                    Math.floor(
                        latestTime / 1000
                    );

                // Fetch a small overlap.
                startSeconds =
                    latestSeconds -
                    OVERLAP_SECONDS;

            } else {

                // No existing data.
                // Fetch previous 7 days.
                startSeconds =
                    nowSeconds -
                    7 * 24 * 60 * 60;
            }

            console.log("");
            console.log(
                "Requesting candle update..."
            );

            console.log(
                "From:",
                new Date(
                    startSeconds * 1000
                ).toLocaleString(
                    "en-IN",
                    {
                        timeZone:
                            "Asia/Kolkata",
                        hour12: false,
                    }
                )
            );

            console.log(
                "To:",
                new Date(
                    nowSeconds * 1000
                ).toLocaleString(
                    "en-IN",
                    {
                        timeZone:
                            "Asia/Kolkata",
                        hour12: false,
                    }
                )
            );

            console.log(
                "Exchange:",
                EXCHANGE
            );

            console.log(
                "Token:",
                TOKEN
            );

            console.log(
                "Interval:",
                INTERVAL,
                "minutes"
            );

            // =================================================
            // 6. SHOONYA TP SERIES
            // =================================================

            const payload = {
                uid: uid,
                exch: EXCHANGE,
                token: TOKEN,
                st: String(startSeconds),
                et: String(nowSeconds),
                intrv: INTERVAL,
            };

            const response =
                await client._post(
                    "/NorenWClientAPI/TPSeries",
                    payload
                );

            if (!Array.isArray(response)) {

                console.log("");
                console.log(
                    "Unexpected Shoonya response:"
                );

                console.log(
                    JSON.stringify(
                        response,
                        null,
                        2
                    )
                );

                throw new Error(
                    "TPSeries did not return an array."
                );
            }

            console.log("");
            console.log(
                "Shoonya candles returned:",
                response.length
            );

            // =================================================
            // 7. NORMALIZE
            // =================================================

            const newCandles =
                response
                    .filter(
                        candle =>
                            candle.stat === "Ok"
                    )
                    .map(
                        normalizeShoonyaCandle
                    )
                    .filter(
                        candle =>
                            candle &&
                            isValidCandle(candle)
                    );

            console.log(
                "Valid candles:",
                newCandles.length
            );

            // =================================================
            // 8. MERGE
            // =================================================

            const combined = [
                ...existingCandles,
                ...newCandles,
            ];

            // =================================================
            // 9. DEDUPLICATE BY TIMESTAMP
            // =================================================

            const candleMap =
                new Map();

            for (const candle of combined) {

                // If the same timestamp appears
                // more than once, the newer API
                // response overwrites the old one.

                candleMap.set(
                    Number(candle.time),
                    candle
                );
            }

            // =================================================
            // 10. SORT
            // =================================================

            const updatedCandles =
                Array.from(
                    candleMap.values()
                ).sort(
                    (a, b) =>
                        a.time - b.time
                );

            // =================================================
            // 11. SAVE
            // =================================================

            fs.writeFileSync(
                DATA_FILE,
                JSON.stringify(
                    updatedCandles,
                    null,
                    2
                ),
                "utf8"
            );

            // =================================================
            // 12. REPORT
            // =================================================

            const added =
                Math.max(
                    0,
                    updatedCandles.length -
                    existingCandles.length
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
                "Old candles:",
                existingCandles.length
            );

            console.log(
                "Shoonya candles:",
                newCandles.length
            );

            console.log(
                "Updated candles:",
                updatedCandles.length
            );

            console.log(
                "Net new candles:",
                added
            );

            if (updatedCandles.length > 0) {

                console.log(
                    "First candle:",
                    formatTime(
                        updatedCandles[0].time
                    )
                );

                console.log(
                    "Latest candle:",
                    formatTime(
                        updatedCandles[
                            updatedCandles.length - 1
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

            if (added === 0) {

                console.log(
                    "No new candles available."
                );

                console.log(
                    "This is normal when the market is closed."
                );
            }

        } catch (error) {

            console.error("");
            console.error(
                "===================================="
            );
            console.error(
                "       DATA UPDATE FAILED"
            );
            console.error(
                "===================================="
            );

            console.error(
                error.message || error
            );

            console.error(
                "===================================="
            );

        } finally {

            rl.close();

        }
    }
);