const fs = require("fs");
const path = require("path");
const p = path.resolve(__dirname, "..", "src", "App.tsx");
const s = fs.readFileSync(p, "utf8");
console.log(s.slice(-340));
