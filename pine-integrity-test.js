const {
    PineIntegrity,
} = require(
    "./src/security/pine-integrity"
);


try {

    const integrity =
        new PineIntegrity({
            strategyFile:
                "BullionAI.pine",

            hashFile:
                "data/bullionai-pine-integrity.json",
        });


    console.log("");
    console.log(
        "===================================="
    );

    console.log(
        "       BULLIONAI PINE INTEGRITY"
    );

    console.log(
        "====================================");


    // =========================================================
    // CREATE BASELINE IF MISSING
    // =========================================================

    const existing =
        integrity.loadBaseline();


    if (!existing) {

        console.log("");
        console.log(
            "No baseline found."
        );

        console.log(
            "Creating initial Pine strategy fingerprint..."
        );

        const baseline =
            integrity.createBaseline();

        console.log("");
        console.log(
            "Baseline created."
        );

        console.log(
            "SHA256:",
            baseline.hash
        );

    }


    // =========================================================
    // VERIFY
    // =========================================================

    const result =
        integrity.requireValid();


    console.log("");
    console.log(
        "Strategy:",
        result.strategyFile
    );

    console.log(
        "Algorithm:",
        result.algorithm
    );

    console.log(
        "SHA256:",
        result.currentHash
    );

    console.log("");
    console.log(
        "===================================="
    );

    console.log(
        "PINE STRATEGY VERIFIED"
    );

    console.log(
        "BullionAI.pine is unchanged."
    );

    console.log(
        "===================================="
    );


} catch (error) {

    console.log("");
    console.log(
        "===================================="
    );

    console.log(
        "PINE INTEGRITY FAILED"
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

    process.exitCode =
        1;
}