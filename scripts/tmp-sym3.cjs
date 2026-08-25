const fs = require("fs");
const p = "src/server/bullionai-api.js";
let s = fs.readFileSync(p, "utf8");
const NL = "\r\n";
const q = (t) => '"' + t + '"';

const oldC = [
  "                const requestedInstrument =",
  "                    url.searchParams.get(",
  '                        "instrument"',
  "                    ) ||",
  '                    "gold";',
  "",
  "                const result =",
  "                    await this.runStrategyFor(",
  "                        requestedInstrument,",
  "                        requestedTimeframe",
  "                    );",
].join(NL);

const newC = [
  "                const requestedInstrument =",
  "                    url.searchParams.get(",
  '                        "instrument"',
  "                    ) ||",
  '                    "gold";',
  "",
  "                const _ex =",
  '                    url.searchParams.get("exchange");',
  "",
  "                const _tk =",
  '                    url.searchParams.get("token");',
  "",
  "                const _ts =",
  '                    url.searchParams.get("tsym");',
  "",
  "                const instOverride = _ex && _tk ? {",
  "                    key: _ts || (_ex + \"_\" + _tk),",
  "                    token: String(_tk),",
  "                    symbol: _ts || String(_tk),",
  "                    name: _ts || String(_tk),",
  "                    exchange: _ex.toUpperCase(),",
  "                } : undefined;",
  "",
  "                const result =",
  "                    await this.runStrategyFor(",
  "                        requestedInstrument,",
  "                        requestedTimeframe,",
  "                        instOverride",
  "                    );",
].join(NL);

if (s.includes(oldC)) {
  s = s.replace(oldC, newC);
  console.log("strategy params done");
} else {
  console.log("MISS strategy params");
}

fs.writeFileSync(p, s);
require("./" + p);
console.log("loads OK");
