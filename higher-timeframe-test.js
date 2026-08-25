require("dotenv").config();

const {
    MarketDataService,
} = require("./src/market/market-data-service");

const {
    ShoonyaSessionManager,
} = require("./src/auth/shoonya-session-manager");


async function testTimeframe(
    market,
    timeframe,
    interval
) {
    console.log("");
    console.log(
        "------------------------------------"
    );

    console.log(
        `TESTING ${timeframe}`
    );

    console.log(
        "Interval:",
        interval
    );

    console.log(
        "------------------------------------"
    );


    try {
        const now =
            Math.floor(
                Date.now() / 1000
            );

        const start =
            now -
            (
                timeframe === "1D"
                    ? 7
                    : timeframe === "1W"
                        ? 60
                        : 365
            ) *
                24 *
                60 *
                60;


        const result =
            await market.getHistoricalCandles(
                start,
                now,
                interval
            );


        console.log(
            `${timeframe} SUCCESS`
        );

        console.log(
            "Candles:",
            result.length
        );


        if (result.length) {

            console.log(
                "First:",
                result[0]
            );

            console.log(
                "Last:",
                result[
                    result.length - 1
                ]
            );

        }

    } catch (error) {

        console.log(
            `${timeframe} FAILED`
        );

        console.log(
            error.message
        );

    }
}


async function main() {

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


    const market =
        new MarketDataService({
            clientId,
            secretCode,
            exchange,
            token,
            interval: "60",
            baseUrl:
                process.env.SHOONYA_BASE_URL ||
                "https://api.shoonya.com",
        });


    const session =
        new ShoonyaSessionManager(
            market
        );


    console.log("");
    console.log(
        "===================================="
    );

    console.log(
        "   HIGHER TIMEFRAME SHOONYA TEST"
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


    await session.authenticateFromConsole();


    await testTimeframe(
        market,
        "1D",
        "D"
    );


    await testTimeframe(
        market,
        "1W",
        "W"
    );


    await testTimeframe(
        market,
        "1M",
        "M"
    );


    console.log("");
    console.log(
        "===================================="
    );

    console.log(
        "HIGHER TIMEFRAME TEST COMPLETE"
    );

    console.log(
        "===================================="
    );
}


main().catch(
    error => {

        console.error("");
        console.error(
            "TEST FAILED:"
        );

        console.error(
            error.message
        );

        process.exitCode = 1;

    }
);