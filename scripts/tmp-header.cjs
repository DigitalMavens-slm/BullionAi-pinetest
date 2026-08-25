const fs = require("fs");
const p = "frontend/src/App.tsx";
let s = fs.readFileSync(p, "utf8");

// Add header row after CardTitle, before p-1 div
const watchlistHeaderOld = `            <div className="p-1">`;

const watchlistHeaderNew = `            <div className="flex items-center gap-2 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-wider text-slate-400">
              <span className="flex-1">Symbol</span>
              <span className="w-[56px] text-right">LTP</span>
              <span className="w-[56px] text-right">Chg</span>
              <span className="w-[56px] text-right">Chg%</span>
              <span className="hidden w-7 shrink-0 sm:block" aria-hidden />
            </div>

            <div className="p-1">`;

if (s.includes(watchlistHeaderOld) && !s.includes('>Symbol</span>')) {
  s = s.replace(watchlistHeaderOld, watchlistHeaderNew);
  console.log("header added");
}

// Gold rows: split the combined price+change flex into two separate columns
// Find the gold price block that currently is flex w-[76px] with price and change
const goldOld = `                    <span className="flex w-[76px] items-center justify-end gap-1 tabular-nums">
                      <span
                        className={[
                          "font-mono text-[12px] font-semibold",

                          up ? UP : DOWN,
                        ].join(" ")}
                      >
                        {fmt(row.price)}
                      </span>
                      <span
                        className={[
                          "font-mono text-[9px] font-medium",

                          up ? UP : DOWN,
                        ].join(" ")}
                      >
                        {row.change != null
                          ? (row.change >= 0 ? "+" : "") + fmt(row.change)
                          : "—"}
                      </span>
                    </span>

                    <span
                      className={[
                        "w-[56px] text-right font-mono text-[10px] font-medium tabular-nums",

                        up ? UP : DOWN,
                      ].join(" ")}
                    >

                      {row.changePct !=
                      null

                        ? (up ? "+" : "") +

                          row.changePct.toFixed(
                            2
                          ) +

                          "%"

                        : "—"}

                    </span>`;

const goldNew = `                    <span
                      className={[
                        "w-[56px] text-right font-mono text-[12px] font-semibold tabular-nums",

                        up ? UP : DOWN,
                      ].join(" ")}
                    >
                      {fmt(row.price)}
                    </span>

                    <span
                      className={[
                        "w-[56px] text-right font-mono text-[10px] font-medium tabular-nums",

                        up ? UP : DOWN,
                      ].join(" ")}
                    >
                      {row.change != null
                        ? (row.change >= 0 ? "+" : "") + fmt(row.change)
                        : "—"}
                    </span>

                    <span
                      className={[
                        "w-[56px] text-right font-mono text-[10px] font-medium tabular-nums",

                        up ? UP : DOWN,
                      ].join(" ")}
                    >

                      {row.changePct !=
                      null

                        ? (up ? "+" : "") +

                          row.changePct.toFixed(
                            2
                          ) +

                          "%"

                        : "—"}

                    </span>`;

if (s.includes('fmt(row.price)')) {
  // Only replace the first occurrence (gold)
  let idx = s.indexOf('                    <span className="flex w-[76px] items-center justify-end gap-1 tabular-nums">');
  if (idx !== -1) {
    const endIdx = s.indexOf('                    </span>\n\n                    <span\n                      className={[\n                        "w-[56px] text-right font-mono text-[10px] font-medium tabular-nums",', idx);
    // Find the full block end
    const blockEnd = s.indexOf('                    </span>\n\n                    <span className="hidden w-7', idx);
    if (blockEnd === -1) {
      // Fallback: replace via simple string
      s = s.replace(goldOld, goldNew);
      console.log("gold replaced via fallback");
    }
  }
  // More robust: replace all flex w-[76px] occurrences with split columns
  const goldCountBefore = (s.match(/flex w-\[76px\] items-center/g) || []).length;
  console.log("gold flex count before:", goldCountBefore);
  // If still 2, need to fix gold
  if (goldCountBefore === 2) {
    // Both gold and custom still have old structure, replace both
    s = s.split('className="flex w-[76px] items-center justify-end gap-1 tabular-nums"').join('className="flex w-[56px] items-center justify-end gap-1 tabular-nums"');
    // But we need to split into two w-[56px] columns - the above is partial, better to just rebuild both sections
    console.log("attempted bulk fix");
  }
}

fs.writeFileSync(p, s);
