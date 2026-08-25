require("dotenv").config();

const {
    MarketDataService,
} = require(
    "./src/market/market-data-service"
);

const {
    ShoonyaSessionManager,
} = require(
    "./src/auth/shoonya-session-manager"
);

const {
    LiveMarketState,
} = require(
    "./src/market/live-market-state"
);


async function main() {

    let liveMarket = null;


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
            "       LIVE MARKET STATE TEST"
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
        // LIVE MARKET STATE
        // =====================================================

        liveMarket =
            new LiveMarketState({

                marketDataService:
                    market,

                exchange,

                token,

            });


        // =====================================================
        // UNIFIED UPDATE
        // =====================================================

        liveMarket.on(
            "update",
            state => {

                const price =
                    state.price;


                console.log("");

                console.log(
                    "------------------------------------"
                );

                console.log(
                    "LIVE MARKET STATE"
                );

                console.log(
                    "Connected:",
                    state.connected
                );

                console.log(
                    "Price:",
                    price.price
                );

                console.log(
                    "Previous:",
                    price.previousPrice
                );

                console.log(
                    "Change:",
                    price.change
                );

                console.log(
                    "Change %:",
                    price.changePercent
                );

                console.log(
                    "Ticks:",
                    price.tickCount
                );

                console.log(
                    "Fresh:",
                    liveMarket.isPriceFresh()
                );

                console.log(
                    "------------------------------------"
                );

            }
        );


        // =====================================================
        // PRICE EVENT
        // =====================================================

        liveMarket.on(
            "price",
            state => {

                console.log(
                    "PRICE EVENT:",
                    state.price
                );

            }
        );


        // =====================================================
        // CONNECTION
        // =====================================================

        liveMarket.on(
            "connected",
            () => {

                console.log("");

                console.log(
                    "LIVE MARKET CONNECTED"
                );

                console.log(
                    "Waiting for market ticks..."
                );

            }
        );


        // =====================================================
        // DISCONNECTION
        // =====================================================

        liveMarket.on(
            "disconnected",
            reason => {

                console.log("");

                console.log(
                    "LIVE MARKET DISCONNECTED"
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

        liveMarket.on(
            "error",
            error => {

                console.error("");

                console.error(
                    "LIVE MARKET ERROR:"
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

        await liveMarket.start();


        // Keep process alive.
        await new Promise(
            () => {}
        );


    } catch (error) {

        console.log("");

        console.log(
            "===================================="
        );

        console.log(
            "       LIVE MARKET TEST FAILED"
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
        "Stopping live market state..."
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