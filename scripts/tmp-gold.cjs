const path = require("path");
const sm = require(path.resolve(__dirname, "..", "src", "market", "symbol-master.js"));
(async () => {
  const reg = await sm.getRegistry("MCX");
  console.log("registry size:", reg.length);
  const gold = reg.filter(r => r.symbol === "GOLD");
  console.log("root GOLD entries:", gold.length);
  gold.slice(0, 6).forEach(r =>
    console.log("  ", r.tradingSymbol, "| type:", r.instrumentType, "| expiry:", r.expiryText || r.expiry)
  );
  // raw parse check for GOLD05OCT26
  const raw = await sm.getExchangeRows ? null : null;
})();
