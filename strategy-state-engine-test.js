const {
    StrategyStateEngine,
} = require(
    "./src/strategy/strategy-state-engine"
);

const engine =
    new StrategyStateEngine({
        tickSize: 1,
    });

console.log("");
console.log(
    "===================================="
);
console.log(
    "       STRATEGY STATE TEST"
);
console.log(
    "===================================="
);


// ============================================================
// SIMULATE PINE RESULT
// ============================================================

engine.loadStrategyState({
    signal: "BUY",
    status: "OPEN",

    entryPrice: 159288,

    trailSL: 161528,

    extremeLabel: "Highest",
    extremePrice: 162680,

    currentPL: 3152,
    bestPL: 3392,

    realizedPL: null,

    entryTime: 1787234400000,
    exitTime: null,
});


// ============================================================
// LIVE PRICE SIMULATION
// ============================================================

const prices = [
    162400,
    162450,
    162600,
    162680,
    162700,
    162650,
    162550,
    161600,
    161528,
    161500,
];


for (
    const price of prices
) {

    const state =
        engine.updatePrice(
            price
        );

    console.log("");

    console.log(
        "Price:",
        price
    );

    console.log(
        "Status:",
        state.status
    );

    console.log(
        "Highest:",
        state.extremePrice
    );

    console.log(
        "Trail SL:",
        state.trailSL
    );

    console.log(
        "Current P/L:",
        state.currentPL
    );

    console.log(
        "Realized P/L:",
        state.realizedPL
    );

    if (
        state.status ===
        "CLOSED"
    ) {

        console.log(
            ">>> SIMULATED EXIT <<<"
        );

        break;
    }
}


console.log("");

console.log(
    "===================================="
);

console.log(
    "FINAL STATE"
);

console.log(
    "===================================="
);

console.log(
    JSON.stringify(
        engine.getState(),
        null,
        2
    )
);

console.log(
    "===================================="
);