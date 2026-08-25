const {
    BullionAILiveCoordinator,
} = require(
    "./src/runner/bullionai-live-coordinator"
);


async function main() {

    const timeframe =
        process.argv[2] ||
        "60m";


    let coordinator = null;


    try {

        console.log("");

        console.log(
            "===================================="
        );

        console.log(
            "       BULLIONAI LIVE COORDINATOR"
        );

        console.log(
            "===================================="

        );

        console.log(
            "Timeframe:",
            timeframe
        );


        coordinator =
            new BullionAILiveCoordinator({
                timeframe,
            });


        // =====================================================
        // DISPLAY UPDATES
        // =====================================================

        coordinator.on(
            "update",
            state => {

                console.log("");

                console.log(
                    "------------------------------------"
                );

                console.log(
                    "DISPLAY UPDATE"
                );

                console.log(
                    "Timeframe:",
                    state.timeframe
                );

                console.log(
                    "Signal:",
                    state.strategy.signal
                );

                console.log(
                    "Status:",
                    state.strategy.status
                );

                console.log(
                    "Entry:",
                    state.strategy.entryPrice
                );

                console.log(
                    "Trail SL:",
                    state.strategy.trailSL
                );

                console.log(
                    "Live Price:",
                    state.market.price
                );

                console.log(
                    "Market Connected:",
                    state.market.connected
                );

                console.log(
                    "Ticks:",
                    state.market.tickCount
                );

                console.log(
                    "------------------------------------"
                );

            }
        );


        // =====================================================
        // MARKET CONNECTION
        // =====================================================

        coordinator.on(
            "market-connected",
            () => {

                console.log(
                    "EVENT: Market connected."
                );

            }
        );


        coordinator.on(
            "market-disconnected",
            reason => {

                console.log(
                    "EVENT: Market disconnected."
                );

                if (reason) {

                    console.log(
                        "Reason:",
                        reason
                    );

                }

            }
        );


        coordinator.on(
            "market-error",
            error => {

                console.error(
                    "EVENT: Market error:",
                    error?.message ||
                    error
                );

            }
        );


        // =====================================================
        // START
        // =====================================================

        await coordinator.start();


        console.log("");

        console.log(
            "===================================="
        );

        console.log(
            "       COORDINATOR READY"
        );

        console.log(
            "===================================="
        );

        console.log(
            JSON.stringify(
                coordinator.getState(),
                null,
                2
            )
        );

        console.log(
            "===================================="
        );


        console.log("");

        console.log(
            "Waiting for live ticks..."
        );

        console.log(
            "Press CTRL+C to stop."
        );


        // Keep alive.
        await new Promise(
            () => {}
        );


    } catch (error) {

        console.log("");

        console.log(
            "===================================="
        );

        console.log(
            "       COORDINATOR FAILED"
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
        "Stopping BullionAI coordinator..."
    );


    if (
        global.__bullionaiCoordinator
    ) {

        try {

            await global
                .__bullionaiCoordinator
                .stop();

        } catch {
            // Ignore shutdown errors.
        }
    }


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