const {
    BullionAILiveCoordinator,
} = require(
    "./src/runner/bullionai-live-coordinator"
);

const {
    BullionAILiveDisplayController,
} = require(
    "./src/state/bullionai-live-display-controller"
);


async function main() {

    const timeframe =
        process.argv[2] ||
        "60m";


    let controller = null;


    try {

        console.log("");

        console.log(
            "===================================="
        );

        console.log(
            "   BULLIONAI LIVE DISPLAY TEST"
        );

        console.log(
            "===================================="
        );

        console.log(
            "Timeframe:",
            timeframe
        );


        // =====================================================
        // COORDINATOR
        // =====================================================

        const coordinator =
            new BullionAILiveCoordinator({
                timeframe,
            });


        // =====================================================
        // DISPLAY CONTROLLER
        // =====================================================

        controller =
            new BullionAILiveDisplayController({
                coordinator,
            });


        global.__bullionaiDisplayController =
            controller;


        // =====================================================
        // LIVE DISPLAY UPDATE
        // =====================================================

        controller.on(
            "update",
            state => {

                console.log("");

                console.log(
                    "------------------------------------"
                );

                console.log(
                    "LIVE DISPLAY UPDATE"
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
                    "Pine Trail SL:",
                    state.strategy.trailSL
                );

                console.log(
                    "Live Price:",
                    state.market.price
                );

                console.log(
                    "Ticks:",
                    state.market.tickCount
                );

                console.log(
                    "Connected:",
                    state.market.connected
                );

                console.log(
                    "------------------------------------"
                );

            }
        );


        // =====================================================
        // MARKET CONNECTED
        // =====================================================

        controller.on(
            "market-connected",
            () => {

                console.log("");

                console.log(
                    "LIVE MARKET CONNECTED"
                );

                console.log(
                    "Waiting for ticks..."
                );

            }
        );


        // =====================================================
        // MARKET DISCONNECTED
        // =====================================================

        controller.on(
            "market-disconnected",
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
        // MARKET ERROR
        // =====================================================

        controller.on(
            "market-error",
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

        await controller.start();


        // =====================================================
        // INITIAL STATE
        // =====================================================

        console.log("");

        console.log(
            "===================================="
        );

        console.log(
            "       INITIAL DISPLAY STATE"
        );

        console.log(
            "===================================="
        );

        console.log(
            JSON.stringify(
                controller.getState(),
                null,
                2
            )
        );

        console.log(
            "===================================="
        );


        console.log("");

        console.log(
            "Pine Signal:",
            controller.getPineSignal()
        );

        console.log(
            "Pine Trail SL:",
            controller.getPineTrailSL()
        );

        console.log(
            "Live Price:",
            controller.getLivePrice()
        );

        console.log(
            "Market Connected:",
            controller.isMarketConnected()
        );

        console.log(
            "Tick Count:",
            controller.getTickCount()
        );


        console.log("");

        console.log(
            "Waiting for live ticks..."
        );

        console.log(
            "Press CTRL+C to stop."
        );


        await new Promise(
            () => {}
        );

    } catch (error) {

        console.log("");

        console.log(
            "===================================="
        );

        console.log(
            "       DISPLAY TEST FAILED"
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
        "Stopping BullionAI display controller..."
    );


    if (
        global.__bullionaiDisplayController
    ) {

        try {

            await global
                .__bullionaiDisplayController
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