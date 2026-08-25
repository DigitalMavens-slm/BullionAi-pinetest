const {
    StrategyEngine,
} = require(
    "./src/strategy/strategy-engine"
);

try {

    const engine =
        new StrategyEngine();

    const result =
        engine.run();

    console.log("");
    console.log(
        "===================================="
    );

    console.log(
        "       BULLIONAI STRATEGY"
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

} catch (error) {

    console.error("");
    console.error(
        "STRATEGY ENGINE FAILED:"
    );

    console.error(
        error.message || error
    );

    process.exitCode = 1;
}