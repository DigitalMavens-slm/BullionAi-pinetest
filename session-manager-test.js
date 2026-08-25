require("dotenv").config();

const {
    MarketDataService,
} = require("./src/market/market-data-service");

const {
    ShoonyaSessionManager,
} = require("./src/auth/shoonya-session-manager");

async function main() {
    try {
        const clientId =
            process.env.SHOONYA_CLIENT_ID ||
            process.env.SHOONYA_USER_ID ||
            process.env.CLIENT_ID;

        const secretCode =
            process.env.SHOONYA_SECRET_CODE ||
            process.env.SHOONYA_SECRET ||
            process.env.SECRET_CODE;

        const market =
            new MarketDataService({
                clientId,
                secretCode,

                exchange:
                    process.env.SHOONYA_EXCHANGE ||
                    "MCX",

                token:
                    process.env.SHOONYA_TOKEN ||
                    "483079",

                interval:
                    process.env.SHOONYA_INTERVAL ||
                    "60",

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
            "       SHOONYA SESSION TEST"
        );

        console.log(
            "===================================="
        );

        await session.authenticateFromConsole();

        console.log("");
        console.log(
            "SESSION STATE:"
        );

        console.log(
            JSON.stringify(
                session.getState(),
                null,
                2
            )
        );

        console.log("");
        console.log(
            "Authenticated:",
            session.isAuthenticated()
        );

        console.log(
            "===================================="
        );

    } catch (error) {
        console.log("");
        console.log(
            "SESSION TEST FAILED:"
        );

        console.error(
            error.message
        );

        process.exitCode = 1;
    }
}

main();