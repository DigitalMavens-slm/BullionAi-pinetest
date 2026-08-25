const fs = require("fs");
const path = require("path");
const p = path.resolve(__dirname, "..", "frontend", "src", "components", "SymbolSearch.tsx");
let s = fs.readFileSync(p, "utf8");
s = s.replace(/  const timerRef =\s*\r?\n?\s*useRef<number \| null>\(null\);\r?\n/, "");
s = s.replace(/  const seqRef = useRef\(0\);\r?\n/, "");
fs.writeFileSync(p, s);
console.log("cleaned");
