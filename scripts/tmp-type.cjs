const fs = require("fs");
const path = require("path");
const p = path.resolve(__dirname, "..", "..", "frontend", "src", "lib", "bullionai-api.ts");
let s = fs.readFileSync(p, "utf8");
if (!s.includes("notice?: string")) {
  s = s.replace(
    /export type CandleResponse = \{\s*\r?\n\s*instrument: Instrument;/,
    "export type CandleResponse = {\n  notice?: string | null;\n  instrument: Instrument;"
  );
  fs.writeFileSync(p, s);
}
console.log("type ok:", s.includes("notice?: string"));
