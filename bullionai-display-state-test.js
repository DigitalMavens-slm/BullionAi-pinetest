const {
    BullionAIDisplayState,
} = require(
    "./src/state/bullionai-display-state"
);


const display =
    new BullionAIDisplayState({
        timeframe: "60m",
    });


// =============================================================
// DISPLAY UPDATE EVENT
// =============================================================

display.on(
    "update",
    state => {

        console.log("");
        console.log(
            "DISPLAY STATE UPDATED"
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
            "Live Connected:",
            state.market.connected
        );
    }
);


// =============================================================
// HEADER
// =============================================================

console.log("");
console.log(
    "===================================="
);

console.log(
    "       BULLIONAI DISPLAY STATE"
);

console.log(
    "===================================="
);


// =============================================================
// SIMULATED PINE STATE
// =============================================================

display.setStrategyState({

    signal:
        "BUY",

    status:
        "OPEN",

    entryPrice:
        159288,

    trailSL:
        161528,

    extremeLabel:
        "Highest",

    extremePrice:
        162680,

    currentPL:
        3152,

    bestPL:
        3392,

    realizedPL:
        null,

    entryTime:
        1787234400000,

    exitTime:
        null,

    currentCandle: {

        time:
            1787331600000,

        open:
            162591,

        high:
            162680,

        low:
            162120,

        close:
            162440,

        volume:
            12458,
    },

    candleCount:
        72,

    lastCandleTime:
        1787331600000,
});


// =============================================================
// SIMULATED LIVE MARKET STATE
// =============================================================

display.setMarketState({

    connected:
        true,

    price: {

        price:
            162550,

        previousPrice:
            162470,

        change:
            80,

        changePercent:
            0.0492,

        tickCount:
            6,

        tickTime:
            Date.now(),

        receivedAt:
            Date.now(),
    },

    lastTick: {

        price:
            162550,
    },
});


// =============================================================
// FINAL STATE
// =============================================================

console.log("");

console.log(
    "===================================="
);

console.log(
    "FINAL DISPLAY STATE"
);

console.log(
    "===================================="
);

console.log(
    JSON.stringify(
        display.getState(),
        null,
        2
    )
);

console.log(
    "===================================="
);