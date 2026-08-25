const {
    getTimeframe,
    getAllTimeframes,
    normalizeTimeframe,
} = require("./src/config/timeframe-config");

console.log("");
console.log(
    "===================================="
);
console.log(
    "       TIMEFRAME CONFIG TEST"
);
console.log(
    "===================================="
);

console.log("");
console.log(
    "60m:",
    getTimeframe("60m")
);

console.log("");
console.log(
    "15m:",
    getTimeframe("15m")
);

console.log("");
console.log(
    "30m:",
    getTimeframe("30m")
);

console.log("");
console.log(
    "All timeframes:"
);

console.log(
    getAllTimeframes()
);

console.log("");
console.log(
    "Normalized:",
    normalizeTimeframe(" 15M ")
);

console.log(
    "===================================="
);