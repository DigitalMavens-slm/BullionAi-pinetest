const path = require("path");
delete require.cache[path.resolve(__dirname, "..", "src", "market", "symbol-master.js")];
const sm = require(path.resolve(__dirname, "..", "src", "market", "symbol-master.js"));
(async () => {
  for (const [exch, q, root] of [["MCX","GOLD","GOLD"],["MCX","SILVER","SILVER"],["NSE","TCS","TCS"]]) {
    const reg = await sm.getRegistry(exch);
    const g = reg.filter(r => r.symbol === root);
    console.log(exch, q, "->", g.map(x => x.tradingSymbol + "(" + x.instrumentType + ")").join(", ") || "none");
  }
})();
