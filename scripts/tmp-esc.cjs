const fs = require("fs");
const path = require("path");
const p = path.resolve(__dirname, "..", "src", "market", "symbol-master.js");
let s = fs.readFileSync(p, "utf8");

/* fix over-escaped newline regexes inside getNameMap */
const badSplit = "raw\r\n                .split(/\\\\r?\\\\n/)".replace("raw\r\n                ", "");
let fixed = 0;
s = s.split(".split(/\\\\r?\\\\n/)").join(".split(/\\r?\\n/)");
// also fix any leftover doubled escapes in the name-map section
s = s.replace(/\.split\(\/\\\\r\?\\\\n\/\)/g, ".split(/\\r?\\n/)");
fixed = (s.match(/\.split\(\/\\r\?\\n\/\)/g) || []).length;

fs.writeFileSync(p, s);
console.log("newline splits normalized:", fixed);

delete require.cache[p];
const m = require(p);
(async () => {
  const rows = await m.searchSymbols({
    query: "RELIANCE INDUSTRIES",
    exchange: "NSE",
    limit: 3,
  });
  console.log("name search:", rows.map(x => x.tsym + " :: " + (x.name || "")).join(" ;; ") || "none");
})();
