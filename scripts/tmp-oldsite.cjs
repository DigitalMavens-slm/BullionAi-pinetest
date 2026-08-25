const fs = require("fs");
const p = "src/server/bullionai-api.js";
let s = fs.readFileSync(p, "utf8");

const i = s.indexOf("Backfilling");
if (i < 0) { console.log("no site"); process.exit(0); }

// search backwards 1500 chars for the updateCandles options object
const segStart = Math.max(0, i - 1500);
let seg = s.slice(segStart, i);

// replace ONLY in this segment: bare `exchange,` option
const before = seg;
seg = seg.replace(/exchange,\r?\n(\s+)token:/g, (m, ws) => `exchange: inst.exchange || "MCX",\n${ws}token:`);

if (seg !== before) {
  s = s.slice(0, segStart) + seg + s.slice(i);
  fs.writeFileSync(p, s);
  console.log("old backfill site now uses inst.exchange");
  require("./" + p);
  console.log("loads OK");
} else {
  console.log("no bare exchange found; dumping options obj:");
  const oi = seg.indexOf("{", seg.indexOf("updateCandles"));
  console.log(JSON.stringify(seg.slice(oi, oi + 260)));
}
