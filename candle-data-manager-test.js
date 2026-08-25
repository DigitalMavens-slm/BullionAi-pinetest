const {
    CandleDataManager,
} = require(
    "./src/market/candle-data-manager"
);

const manager =
    new CandleDataManager({
        dataDirectory:
            "./data",

        exchange:
            "MCX",

        token:
            "483079",
    });

console.log("");
console.log(
    "===================================="
);

console.log(
    "       CANDLE DATA MANAGER"
);

console.log(
    "===================================="
);

const timeframes = [
    "5m",
    "15m",
    "30m",
    "60m",
    "120m",
    "240m",
];

for (
    const timeframe
    of timeframes
) {
    console.log("");

    console.log(
        timeframe,
        "→",
        manager.getFileName(
            timeframe
        )
    );

    console.log(
        "Path:",
        manager.getFilePath(
            timeframe
        )
    );
}

console.log("");

console.log(
    "60m dataset info:"
);

console.log(
    manager.getInfo(
        "60m"
    )
);

console.log("");

console.log(
    "15m dataset info:"
);

console.log(
    manager.getInfo(
        "15m"
    )
);

console.log("");

console.log(
    "Available datasets:"
);

console.log(
    manager.listDatasets()
);

console.log(
    "===================================="
);