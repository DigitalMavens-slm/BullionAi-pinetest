require("dotenv").config();

const {
    MarketDataService,
} = require("./src/market/market-data-service");

const {
    ShoonyaSessionManager,
} = require("./src/auth/shoonya-session-manager");

const {
    ShoonyaLiveFeed,
} = require("./src/market/shoonya-live-feed");


async function main() {

    let feed = null;

    try {

        const clientId =
            process.env.SHOONYA_CLIENT_ID ||
            process.env.SHOONYA_USER_ID ||
            process.env.CLIENT_ID;

        const secretCode =
            process.env.SHOONYA_SECRET_CODE ||
            process.env.SHOONYA_SECRET ||
            process.env.SECRET_CODE;


        const exchange =
            process.env.SHOONYA_EXCHANGE ||
            "MCX";

        const token =
            process.env.SHOONYA_TOKEN ||
            "483079";


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
                    process.env.SHOONYA_INTERVAL ||
                    "60",

                baseUrl:
                    process.env.SHOONYA_BASE_URL ||
                    "https://api.shoonya.com",

            });


        // =====================================================
        // SESSION
        // =====================================================

        const session =
            new ShoonyaSessionManager(
                market
            );


        console.log("");

        console.log(
            "===================================="
        );

        console.log(
            "       SHOONYA LIVE FEED TEST"
        );

        console.log(
            "===================================="
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
            "Subscription:",
            `${exchange}|${token}`
        );

        console.log(
            "===================================="
        );


        // =====================================================
        // AUTHENTICATE
        // =====================================================

        await session.authenticateFromConsole();


        console.log("");

        console.log(
            "Session ready:",
            session.isAuthenticated()
        );


        // =====================================================
        // LIVE FEED
        // =====================================================

        feed =
            new ShoonyaLiveFeed({

                marketDataService:
                    market,

                exchange,

                token,

                reconnect:
                    true,

                reconnectDelay:
                    3000,

            });


        // =====================================================
        // CONNECTED
        // =====================================================

        feed.on(
            "connected",
            () => {

                console.log("");

                console.log(
                    "===================================="
                );

                console.log(
                    "       LIVE FEED CONNECTED"
                );

                console.log(
                    "===================================="
                );

                console.log(
                    "Waiting for live ticks..."
                );

                console.log(
                    "Press CTRL+C to stop."
                );

            }
        );


        // =====================================================
        // PRICE
        // =====================================================

        feed.on(
            "price",
            tick => {

                const time =
                    new Date(
                        tick.time
                    ).toLocaleString(
                        "en-IN",
                        {
                            timeZone:
                                "Asia/Kolkata",
                        }
                    );


                console.log("");

                console.log(
                    "------------------------------------"
                );

                console.log(
                    "LIVE TICK"
                );

                console.log(
                    "Time:",
                    time
                );

                console.log(
                    "Exchange:",
                    tick.exchange
                );

                console.log(
                    "Token:",
                    tick.token
                );

                console.log(
                    "Price:",
                    tick.price
                );

                console.log(
                    "------------------------------------"
                );

            }
        );


        // =====================================================
        // DISCONNECTED
        // =====================================================

        feed.on(
            "disconnected",
            reason => {

                console.log("");

                console.log(
                    "LIVE FEED DISCONNECTED"
                );

                if (reason) {

                    console.log(
                        "Reason:",
                        reason
                    );

                }

            }
        );


        // =====================================================
        // ERROR
        // =====================================================

        feed.on(
            "error",
            error => {

                console.error("");

                console.error(
                    "LIVE FEED ERROR:"
                );

                console.error(
                    error?.message ||
                    error
                );

            }
        );


        // =====================================================
        // START
        // =====================================================

        await feed.connect();


        // Keep process alive.
        await new Promise(
            () => {}
        );


    } catch (
        error
    ) {

        console.log("");

        console.log(
            "===================================="
        );

        console.log(
            "       LIVE FEED TEST FAILED"
        );

        console.log(
            "===================================="
        );

        console.error(
            error?.message ||
            error
        );

        console.log(
            "===================================="
        );

        process.exitCode =
            1;

    }

}


// =============================================================
// SHUTDOWN
// =============================================================

async function shutdown() {

    console.log("");

    console.log(
        "Stopping live feed..."
    );

    process.exit(
        0
    );

}


process.on(
    "SIGINT",
    shutdown
);

process.on(
    "SIGTERM",
    shutdown
);


main();