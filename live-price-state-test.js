const {
    LivePriceState,
} = require(
    "./src/market/live-price-state"
);


const livePrice =
    new LivePriceState({
        exchange: "MCX",
        token: "483079",
    });


livePrice.on(
    "update",
    state => {

        console.log("");

        console.log(
            "LIVE PRICE UPDATE"
        );

        console.log(
            "Price:",
            state.price
        );

        console.log(
            "Previous:",
            state.previousPrice
        );

        console.log(
            "Change:",
            state.change
        );

        console.log(
            "Change %:",
            state.changePercent
        );

        console.log(
            "Ticks:",
            state.tickCount
        );

    }
);


console.log("");
console.log(
    "===================================="
);
console.log(
    "       LIVE PRICE STATE TEST"
);
console.log(
    "====================================");


livePrice.setConnected(
    true
);


const prices = [
    162400,
    162410,
    162450,
    162500,
    162470,
    162550,
];


for (
    const price of prices
) {

    livePrice.updateTick({
        price,
        time: Date.now(),
    });

}


console.log("");

console.log(
    "FINAL STATE:"
);

console.log(
    JSON.stringify(
        livePrice.getState(),
        null,
        2
    )
);

console.log("");

console.log(
    "Fresh:",
    livePrice.isFresh()
);

console.log(
    "===================================="
);