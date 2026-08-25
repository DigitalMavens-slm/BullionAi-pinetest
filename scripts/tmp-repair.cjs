const fs = require("fs");
const p = "src/server/bullionai-api.js";
let s = fs.readFileSync(p, "utf8");
const bad = "}\n\n=========================================================\n    // INSTRUMENT RESOLUTION";
const good = "}\n\n    // =========================================================\n    // INSTRUMENT RESOLUTION";
if (s.includes(bad)) { s = s.replace(bad, good); console.log("banner fixed"); }
const req = 'const {\n    CandleDataManager,\n} = require("../market/candle-data-manager");';
const parts = s.split(req);
if (parts.length > 2) {
  s = parts[0] + req + parts.slice(2).join(req);
  console.log("deduped require, had", parts.length - 1);
}
fs.writeFileSync(p, s);
require("./src/server/bullionai-api.js");
console.log("loads OK");
