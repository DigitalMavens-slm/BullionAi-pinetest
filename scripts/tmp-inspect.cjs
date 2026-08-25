const fs = require("fs");
const s = require("fs")
  .readFileSync("frontend/src/components/chart/BullionChart.tsx", "utf8");
const i = s.indexOf('} from "lightweight-charts";');
console.log("LWC:", JSON.stringify(s.slice(i, i + 90)));
const k = s.indexOf("// RENDER");
console.log("RENDER ctx:", JSON.stringify(s.slice(k - 160, k + 40)));
