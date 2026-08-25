const fs = require("fs");
const p = "src/market/live-market-state.js";
let s = fs.readFileSync(p, "utf8");

if (!s.includes("unsubscribeTokens(pairs) {")) {
  // insert AFTER subscribeTokens method's closing emitUpdate + brace
  const anchor = "        this.emitUpdate();\n    }";
  const i = s.lastIndexOf(anchor);
  if (i < 0) { console.log("MISS anchor"); process.exit(1); }
  const insAt = i + anchor.length;
  const method = [
    "",
    "",
    "    unsubscribeTokens(pairs) {",
    "",
    "        const subs = [];",
    "",
    "        pairs.forEach(({ exch, token }) => {",
    "",
    '            const EX = String(exch || this.exchange).toUpperCase();',
    "",
    '            subs.push(EX + "|" + token);',
    "",
    "            /* keep price state; stop is feed-level only */",
    "        });",
    "",
    "        try {",
    "            this.feed.unsubscribeTouchline(subs);",
    "        } catch (error) {",
    "            console.error(",
    '                "Runtime unsubscribe failed:",',
    "                error?.message || error",
    "            );",
    "        }",
  ].join("\r\n");
  s = s.slice(0, insAt) + method + s.slice(insAt);
  fs.writeFileSync(p, s);
  console.log("method appended after subscribeTokens");
}

delete require.cache[p];
require(p);
console.log("LMS loads OK");
