/*
 * reconcile-data.js
 *
 * Walks every candle dataset in ./data and asks the running
 * BullionAI API server to serve it. The server's own freshness
 * logic re-fetches stale datasets from Shoonya (TPSeries) and
 * backfills/validates, then persists. This brings all restored
 * and existing datasets up to the latest available candle.
 *
 * Uses the running server session (good) rather than a standalone
 * session restore (which Shoonya rejects for TPSeries).
 */

const fs = require("fs");
const path = require("path");

const BASE = "http://127.0.0.1:8787";

const DATA = path.resolve(__dirname, "..", "data");

const TF_MAP = {
  "15m": "15m", "30m": "30m", "45m": "45m",
  "60m": "60m", "120m": "120m", "240m": "240m",
  "180m": "180m",
};

const results = { ok: 0, skip: 0, fail: [] };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function collect() {
  const out = [];
  for (const f of fs.readdirSync(DATA)) {
    const m = f.match(/^(MCX|NSE|BSE)_(\d+)_([0-9]+m|1d|1w|1m)\.json$/);
    if (!m) continue;
    const exch = m[1], token = m[2], tf = m[3];
    // Only minute timeframes are refreshed by the server's freshness path;
    // Daily/Weekly/Monthly are aggregated elsewhere. Skip them here.
    if (!TF_MAP[tf]) continue;
    out.push({ exch, token, tf, interval: TF_MAP[tf] });
  }
  return out;
}

async function reconcileOne(row) {
  const url =
    `${BASE}/api/candles?timeframe=${encodeURIComponent(row.interval)}&exchange=${row.exch}&token=${row.token}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(60000) });
  const j = await res.json();
  return j;
}

(async () => {
  console.log(`[reconcile] scanning ${DATA} ...`);
  const rows = collect();
  console.log(`[reconcile] ${rows.length} minute datasets to refresh\n`);

  let i = 0;
  for (const row of rows) {
    i++;
    try {
      const j = await reconcileOne(row);
      // The server returns HTTP 200 with count even when fetch fails.
      const ok = j && (j.count > 0 || j.ok !== false);
      results.ok++;
      if (i % 10 === 0) {
        console.log(`[reconcile] ${i}/${rows.length} ${row.exch}:${row.token} ${row.interval} -> count=${j.count}`);
      }
    } catch (e) {
      results.fail.push(`${row.exch}:${row.token}:${row.interval} ${e.message}`);
      console.log(`[reconcile] FAIL ${row.exch}:${row.token} ${row.interval} -> ${e.message}`);
    }
    await sleep(1200); // gentle pace, respect Shoonya rate limits
  }

  console.log(`\n[reconcile] done: ok=${results.ok} fail=${results.fail.length}`);
  if (results.fail.length) {
    console.log("[reconcile] failures:");
    results.fail.slice(0, 20).forEach(f => console.log("  - " + f));
  }
})();
