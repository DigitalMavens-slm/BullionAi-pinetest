/*
 * backfill-missing-mcx.js
 *
 * Fetches history for MCX current-contract symbols that have no
 * cached dataset, using the running server's empty-dataset backfill
 * path (which uses the working live TPSeries session).
 */

const BASE = "http://127.0.0.1:8787";
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const TARGETS = [
  ["571300","LEAD30SEP26"],["571303","ZINC30SEP26"],["487669","KAPAS30NOV26"],
  ["571294","COTTON30NOV26"],["571296","ALUMINI30SEP26"],["568840","GOLDTEN30SEP26"],
  ["483080","SILVERM30NOV26"],["571404","CARDAMOM30SEP26"],["571299","LEADMINI30SEP26"],
  ["571302","ZINCMINI30SEP26"],["571297","ALUMINIUM30SEP26"],["574846","COTTONOIL30SEP26"],
  ["568839","GOLDPETAL30SEP26"],["568845","MENTHAOIL30SEP26"],["574824","SILVER10030SEP26"],
  ["562058","SILVERMIC30NOV26"],["568838","GOLDGUINEA30SEP26"],["576884","MCXBULLDEX25SEP26"],
  ["575678","MCXMETLDEX23SEP26"],["568246","NATGASMINI25SEP26"],["571301","STEELREBAR30SEP26"],
];

(async () => {
  console.log("[backfill] " + TARGETS.length + " missing MCX contracts\n");
  let ok = 0;
  for (const [token, tsym] of TARGETS) {
    const url = `${BASE}/api/candles?timeframe=15m&exchange=MCX&token=${token}&tsym=${encodeURIComponent(tsym)}`;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(90000) });
      const j = await res.json();
      const count = j.count || 0;
      const note = j.notice ? (" notice=" + String(j.notice).slice(0, 40)) : "";
      console.log(`  ${tsym.padEnd(22)} ${token} -> ${count} candles${note}`);
      if (count > 0) ok++;
    } catch (e) {
      console.log(`  ${tsym.padEnd(22)} ${token} -> ERR ${e.message}`);
    }
    await sleep(1500);
  }
  console.log(`\n[backfill] done: ${ok}/${TARGETS.length} have data now`);
})();
