const fs = require("fs");
const p = "src/market/live-market-state.js";
let s = fs.readFileSync(p, "utf8");

if (s.includes("unsubscribeTokens(pairs)")) { console.log("already present"); process.exit(0); }

const i = s.indexOf("subscribeTokens(pairs)");
const emitAt = s.indexOf("this.emitUpdate();", i);
const closeBrace = s.indexOf("}", emitAt) + 1;

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

s = s.slice(0, closeBrace) + method + s.slice(closeBrace);
fs.writeFileSync(p, s);

delete require.cache[p];
require(p);
console.log("LMS OK with unsubscribeTokens");
