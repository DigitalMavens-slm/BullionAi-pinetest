const fs = require("fs");

/* ---------- A. delete icon visible on touch ---------- */
{
  const p = "frontend/src/App.tsx";
  let s = fs.readFileSync(p, "utf8");
  const oldCls =
    '"rounded-lg p-1.5 text-slate-300 opacity-0 transition group-hover:opacity-100 hover:bg-rose-50 hover:text-rose-500"';
  if (s.includes(oldCls)) {
    s = s.replace(
      oldCls,
      '"rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-500 sm:opacity-0 sm:group-hover:opacity-100"'
    );
    fs.writeFileSync(p, s);
    console.log("delete icon visibility fixed");
  } else console.log("MISS delete class");
}

/* ---------- B. "back to latest" button in chart ---------- */
{
  const p = "frontend/src/components/chart/BullionChart.tsx";
  let s = fs.readFileSync(p, "utf8");
  let n = 0;

  // import icon
  if (!s.includes("ChevronsRight")) {
    s = s.replace(
      /import \{\s*\r?\n\s*useEffect,\s*\r?\n\s*useRef,\s*\r?\n\s*useState,\s*\r?\n\s*\} from "react";/,
      m => m
    );
    // lucide import lives in App; here add to react? no — add lucide-react import line after existing imports
    s = s.replace(
      /} from "lightweight-charts";/,
      `} from "lightweight-charts";\n\nimport { ChevronsRight } from "lucide-react";`
    );
    n++;
  }

  // state + count ref + subscription (insert before RENDER comment)
  if (!s.includes("showJumpLatest")) {
    s = s.replace(
      /(\s*\/\/ =========================================================\s*\r?\n\s*\/\/ RENDER)/,
      `
  /* Jump-to-latest visibility */

  const [showJumpLatest, setShowJumpLatest] =
    useState(false);

  const dataCountRef =
    useRef(0);

  useEffect(() => {
    const chart =
      chartRef.current;
    if (!chart) return;

    const ts = chart.timeScale();

    function handler(
      range:
        | {
            from: number;
            to: number;
          }
        | null
    ) {
      const total =
        dataCountRef.current;
      if (!range || total === 0) {
        setShowJumpLatest(false);
        return;
      }
      setShowJumpLatest(
        range.to < total - 1
      );
    }

    ts.subscribeVisibleLogicalRangeChange(
      handler as any
    );

    return () =>
      ts.unsubscribeVisibleLogicalRangeChange(
        handler as any
      );
  }, []);
$1`
    );
    n++;
  }

  // record data length inside candles effect
  s = s.replace(
    /(series\.setData\(\s*\r?\n\s*formatted\s*\r?\n\s*\);)/,
    `$1\n\n    dataCountRef.current =\n      formatted.length;`
  );

  // button JSX inside wrapper (after watermark block)
  if (!s.includes("JUMP TO LATEST")) {
    s = s.replace(
      /(\{/\* CHART CANVAS \*/\}\))/,
      `$1\n\n      {/* JUMP TO LATEST */}\n\n      {showJumpLatest && (\n        <button\n          onClick={() =>\n            chartRef.current\n              ?.timeScale()\n              ?.scrollToRealTime()\n          }\n          className="absolute bottom-4 right-4 z-20 flex items-center gap-1 rounded-full border border-slate-200 bg-white/95 px-3 py-1.5 text-[11px] font-bold text-slate-700 shadow-md transition hover:border-amber-300 hover:text-amber-600"\n        >\n          Latest\n          <ChevronsRight className="h-3.5 w-3.5" />\n        </button>\n      )}`
    );
    n++;
  }

  fs.writeFileSync(p, s);
  console.log("chart patched:", n);
}
