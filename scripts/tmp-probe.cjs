const path = require("path");
(async () => {
  const tests = [
    ["NSE", "TCS-EQ"],           // known working
    ["BSE", "RELIANCE"],         // dual-listed
    ["NSE", "IDEA-EQ"],          // cheap stock
    ["MCX", "NATURALGAS"],
  ];

  for (const [exch, q] of tests) {
    const s = await fetch(
      `http://localhost:8787/api/instruments?exchange=${exch}&q=${encodeURIComponent(q)}&limit=3`
    ).then(r => r.json());

    const row = (s.instruments || [])[0];
    if (!row) {
      console.log(exch, q, "-> no registry match");
      continue;
    }

    const t0 = Date.now();
    const c = await fetch(
      `http://localhost:8787/api/candles?timeframe=15m&exchange=${row.exchange}&token=${row.token}&tsym=${encodeURIComponent(row.tradingSymbol)}`
    ).then(r => r.json());

    const arr = c.candles || [];
    console.log(
      `${row.exchange} ${row.tradingSymbol} (${row.token}) -> ${arr.length} candles | ${Date.now() - t0}ms`,
      arr.length ? "| last " + new Date(arr[arr.length - 1].time).toISOString() : "| EMPTY"
    );
  }
})();
