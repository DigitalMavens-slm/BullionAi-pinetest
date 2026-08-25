require("dotenv").config();

const fs = require("fs");
const path = require("path");

const {
    getTimeframe,
} = require("./src/config/timeframe-config");

const {
    CandleDataManager,
} = require("./src/market/candle-data-manager");

const {
    StrategyEngine,
} = require("./src/strategy/strategy-engine");

function run() {
    const requestedTimeframe =
        process.argv[2] || "15m";

    const timeframe =
        getTimeframe(
            requestedTimeframe
        );

    const manager =
        new CandleDataManager({
            dataDirectory: "./data",
            exchange: "MCX",
            token: "483079",
        });

    const candles =
        manager.load(
            timeframe.key
        );

    if (!candles.length) {
        throw new Error(
            `No candles found for ${timeframe.key}.`
        );
    }

    const sourceFile =
        manager.getFilePath(
            timeframe.key
        );

    const temporaryFile =
        path.join(
            process.cwd(),
            `strategy-${timeframe.key}.json`
        );

    fs.writeFileSync(
        temporaryFile,
        JSON.stringify(
            candles,
            null,
            2
        ),
        "utf8"
    );

    console.log("");

    console.log(
        "===================================="
    );

    console.log(
        "       TIMEFRAME STRATEGY TEST"
    );

    console.log(
        "===================================="
    );

    console.log(
        "Timeframe:",
        timeframe.key
    );

    console.log(
        "Label:",
        timeframe.label
    );

    console.log(
        "Candles:",
        candles.length
    );

    console.log(
        "Source:",
        sourceFile
    );

    console.log(
        "===================================="
    );

    console.log("");

    const strategy =
        new StrategyEngine({
            strategyFile:
                "BullionAI.pine",

            candlesFile:
                temporaryFile,

            resultsFile:
                `results-${timeframe.key}.json`,
        });

    const result =
        strategy.run();

    console.log("");

    console.log(
        "===================================="
    );

    console.log(
        "       STRATEGY RESULT"
    );

    console.log(
        "===================================="
    );

    console.log(
        JSON.stringify(
            result.state,
            null,
            2
        )
    );

    console.log(
        "===================================="
    );

    // Keep the generated test dataset.
    // It makes the test reproducible.
}

try {
    run();
} catch (error) {
    console.log("");

    console.log(
        "TIMEFRAME STRATEGY TEST FAILED:"
    );

    console.error(
        error.message
    );

    process.exitCode = 1;
}