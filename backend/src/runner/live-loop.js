require("dotenv").config();

const {
    LiveStrategyRunner,
} = require("./live-strategy-runner");

const {
    formatISTDateTime,
} = require("../utils/ist-time");


class LiveLoop {

    constructor({
        timeframe = "60m",
        pollSeconds = 60,
        maxRetries = 3,
        retryDelaySeconds = 30,
    } = {}) {

        this.timeframe =
            timeframe;

        this.pollSeconds =
            Math.max(
                10,
                Number(
                    pollSeconds
                ) || 60
            );

        this.maxRetries =
            Math.max(
                1,
                Number(
                    maxRetries
                ) || 3
            );

        this.retryDelaySeconds =
            Math.max(
                5,
                Number(
                    retryDelaySeconds
                ) || 30
            );

        this.running =
            false;

        // =====================================================
        // ONE LONG-LIVED RUNNER
        // =====================================================

        this.runner =
            new LiveStrategyRunner({
                timeframe:
                    this.timeframe,
            });
    }


    // =========================================================
    // SLEEP
    // =========================================================

    sleep(ms) {

        return new Promise(
            resolve =>
                setTimeout(
                    resolve,
                    ms
                )
        );

    }


    // =========================================================
    // RETRYABLE ERROR
    // =========================================================

    isRetryableError(error) {

        const message =
            String(
                error?.message ||
                error ||
                ""
            ).toLowerCase();

        return (

            message.includes(
                "502"
            ) ||

            message.includes(
                "503"
            ) ||

            message.includes(
                "504"
            ) ||

            message.includes(
                "gateway"
            ) ||

            message.includes(
                "timeout"
            ) ||

            message.includes(
                "timed out"
            ) ||

            message.includes(
                "econnreset"
            ) ||

            message.includes(
                "socket hang up"
            )

        );

    }


    // =========================================================
    // ONE CYCLE
    // =========================================================

    async runCycle() {

        console.log("");

        console.log(
            "------------------------------------"
        );

        console.log(
            "LIVE CYCLE:",
            formatISTDateTime(
                Date.now()
            )
        );

        console.log(
            "Timeframe:",
            this.timeframe
        );

        console.log(
            "------------------------------------"
        );


        for (
            let attempt = 1;
            attempt <=
            this.maxRetries;
            attempt++
        ) {

            try {

                const result =
                    await this.runner.run();

                console.log("");

                console.log(
                    "Cycle completed successfully."
                );

                return result;

            } catch (error) {

                console.log("");

                console.error(
                    `Cycle attempt ${attempt}/${this.maxRetries} failed:`,
                    error.message
                );


                // ------------------------------------------------
                // SESSION EXPIRED
                // ------------------------------------------------

                const sessionExpired =
                    String(
                        error?.message ||
                        ""
                    )
                    .toLowerCase()
                    .includes(
                        "session"
                    ) &&
                    String(
                        error?.message ||
                        ""
                    )
                    .toLowerCase()
                    .includes(
                        "expired"
                    );


                if (
                    sessionExpired
                ) {

                    console.log("");

                    console.log(
                        "Shoonya session expired."
                    );

                    console.log(
                        "The next cycle will attempt re-authentication."
                    );

                    return null;
                }


                // ------------------------------------------------
                // NON-RETRYABLE ERROR
                // ------------------------------------------------

                if (
                    !this.isRetryableError(
                        error
                    )
                ) {

                    throw error;

                }


                // ------------------------------------------------
                // RETRIES EXHAUSTED
                // ------------------------------------------------

                if (
                    attempt >=
                    this.maxRetries
                ) {

                    console.log("");

                    console.log(
                        "Maximum retry attempts reached."
                    );

                    console.log(
                        "Will wait for the next scheduled cycle."
                    );

                    return null;

                }


                const delay =
                    this.retryDelaySeconds *
                    attempt;


                console.log(
                    `Retrying in ${delay} seconds...`
                );


                await this.sleep(
                    delay * 1000
                );

            }

        }

        return null;
    }


    // =========================================================
    // START
    // =========================================================

    async start() {

        if (
            this.running
        ) {

            throw new Error(
                "Live loop is already running."
            );

        }


        this.running =
            true;


        console.log("");

        console.log(
            "===================================="
        );

        console.log(
            "       BULLIONAI LIVE LOOP"
        );

        console.log(
            "===================================="
        );

        console.log(
            "Timeframe:",
            this.timeframe
        );

        console.log(
            "Poll interval:",
            this.pollSeconds,
            "seconds"
        );

        console.log(
            "Max retries:",
            this.maxRetries
        );

        console.log(
            "Retry delay:",
            this.retryDelaySeconds,
            "seconds"
        );

        console.log(
            "===================================="
        );


        try {

            // =================================================
            // INITIALIZE ONCE
            // =================================================

            await this.runner.initialize();


            // =================================================
            // FIRST CYCLE
            // =================================================

            await this.runCycle();


            // =================================================
            // CONTINUOUS LOOP
            // =================================================

            while (
                this.running
            ) {

                console.log("");

                console.log(
                    `Waiting ${this.pollSeconds} seconds...`
                );


                await this.sleep(
                    this.pollSeconds * 1000
                );


                if (
                    !this.running
                ) {

                    break;

                }


                await this.runCycle();

            }

        } finally {

            this.running =
                false;

        }

    }


    // =========================================================
    // STOP
    // =========================================================

    stop() {

        console.log("");

        console.log(
            "Stopping BullionAI live loop..."
        );

        this.running =
            false;

    }

}


// =============================================================
// MAIN
// =============================================================

async function main() {

    const timeframe =
        process.argv[2] ||
        "60m";


    const pollSeconds =
        Number(
            process.env.BULLIONAI_POLL_SECONDS
        ) || 60;


    const maxRetries =
        Number(
            process.env.BULLIONAI_MAX_RETRIES
        ) || 3;


    const retryDelaySeconds =
        Number(
            process.env.BULLIONAI_RETRY_DELAY_SECONDS
        ) || 30;


    const loop =
        new LiveLoop({

            timeframe,

            pollSeconds,

            maxRetries,

            retryDelaySeconds,

        });


    const shutdown =
        () => {

            loop.stop();

        };


    process.on(
        "SIGINT",
        shutdown
    );


    process.on(
        "SIGTERM",
        shutdown
    );


    try {

        await loop.start();

    } catch (error) {

        console.log("");

        console.log(
            "===================================="
        );

        console.log(
            "       LIVE LOOP FAILED"
        );

        console.log(
            "===================================="
        );

        console.error(
            error.message ||
            error
        );

        console.log(
            "===================================="
        );

        process.exitCode = 1;

    }

}


main();
