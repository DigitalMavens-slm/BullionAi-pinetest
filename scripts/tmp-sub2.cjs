const fs = require("fs");
const p = "src/market/live-market-state.js";
let s = fs.readFileSync(p, "utf8");
const NL = "\r\n";

const oldBlock = [
  "    subscribeTokens(tokens) {",
  "",
  "        for (const t of tokens) {",
  "",
  "            const tok = String(t);",
  "",
  "            if (!this.priceStates.has(tok)) {",
  "                this.priceStates.set(",
  "                    tok,",
  "                    new LivePriceState({",
  "                        exchange: this.exchange,",
  "                        token: tok,",
  "                    })",
  "                );",
  "            }",
  "        }",
].join(NL);

const newBlock = [
  "    subscribeTokens(pairs) {",
  "",
  "        const subs = [];",
  "",
  "        pairs.forEach(({ exch, token }) => {",
  "",
  "            const EX = String(exch || this.exchange).toUpperCase();",
  "",
  "            if (!this.priceStates.has(token)) {",
  "                this.priceStates.set(",
  "                    token,",
  "                    new LivePriceState({",
  "                        exchange: EX,",
  "                        token,",
  "                    })",
  "                );",
  "            }",
  "",
  "            subs.push(EX + \"|\" + token);",
  "        });",
].join(NL);

if (!s.includes(oldBlock)) { console.log("MISS block"); process.exit(1); }
s = s.replace(oldBlock, newBlock);

// touchline call uses subs
s = s.replace(
  /this\.feed\.subscribeTouchline\(\s*\r?\n\s*tokens\.map\(t => `\$\{this\.exchange\}\|\$\{t\}`\)\s*,?\s*\r?\n?\s*\);/,
  "this.feed.subscribeTouchline(subs);"
);

fs.writeFileSync(p, s);
require("./" + p);
console.log("live-market-state multi-exchange subscribe OK");
