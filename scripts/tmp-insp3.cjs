const fs = require("fs");
const path = require("path");
const p = path.resolve(__dirname, "..", "src", "market", "symbol-master.js");
let s = fs.readFileSync(p, "utf8");

console.log("nameMap decl idx:", s.indexOf("const nameMap ="));
console.log("parseFile(E) idx:", s.indexOf("parseFile(E)"));
console.log("name field idx:", s.indexOf("name:\n                r.name"));

// print getRegistry job region
const i = s.indexOf("async function getRegistry");
if (i >= 0) console.log(s.slice(i, i + 700));
