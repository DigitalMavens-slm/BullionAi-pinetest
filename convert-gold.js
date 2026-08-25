const fs = require("fs");

const source = JSON.parse(
  fs.readFileSync("gold-candles.json", "utf8")
);

const candles = source.map(c => ({
  open: c.open,
  high: c.high,
  low: c.low,
  close: c.close,
  volume: c.volume,
  time: c.time * 1000
}));

fs.writeFileSync(
  "candles.json",
  JSON.stringify(candles, null, 2),
  "utf8"
);

console.log("====================================");
console.log("   GOLD DATA → PINETS FORMAT");
console.log("====================================");
console.log("Candles converted:", candles.length);
console.log("Output: candles.json");
console.log("Time converted: seconds → milliseconds");
console.log("====================================");