require("dotenv").config();

const {
    MarketDataService,
} = require("./src/market/market-data-service");

const {
    ShoonyaSessionManager,
} = require("./src/auth/shoonya-session-manager");


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
        "     RAW SHOONYA WEBSOCKET TEST"
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


    await session.authenticateFromConsole();


    console.log("");
    console.log(
        "Connecting WebSocket..."
    );


    const client =
        market.client;


    if (!client) {
        throw new Error(
            "Shoonya client is not available."
        );
    }


    client.on_open = function () {

        console.log("");
        console.log(
            "RAW WS OPEN"
        );

        console.log(
            "Subscribing:",
            `${exchange}|${token}`
        );


        client.subscribe(
            `${exchange}|${token}`
        );


        console.log(
            "Subscription sent."
        );
    };


    client.on_message = function (
        message
    ) {

        console.log("");
        console.log(
            "===================================="
        );

        console.log(
            "RAW WS MESSAGE"
        );

        console.log(
            "===================================="
        );

        console.log(
            message
        );

        console.log(
            "===================================="
        );
    };


    client.on_error = function (
        error
    ) {

        console.error("");
        console.error(
            "RAW WS ERROR"
        );

        console.error(
            error
        );
    };


    client.on_close = function () {

        console.log("");
        console.log(
            "RAW WS CLOSED"
        );
    };


    if (
        typeof client.startWebsocket ===
        "function"
    ) {

        client.startWebsocket();

    } else if (
        typeof client.start_websocket ===
        "function"
    ) {

        client.start_websocket();

    } else {

        throw new Error(
            "Shoonya WebSocket start method not found."
        );
    }


    console.log("");
    console.log(
        "Waiting for RAW WebSocket messages..."
    );

    console.log(
        "Leave this running for 30-60 seconds."
    );

    console.log(
        "Press CTRL+C to stop."
    );
}


main().catch(
    error => {

        console.error("");
        console.error(
            "RAW WS TEST FAILED"
        );

        console.error(
            error
        );

        process.exitCode = 1;
    }
);