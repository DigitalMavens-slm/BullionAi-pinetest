import type { RecentSignalTrade } from "../lib/bullionai-api";

/* =============================================================
   SIGNAL LIFECYCLE LABEL + DETAIL ROWS (DB authoritative)
   Spec 9: show all fields that exist; do NOT fabricate missing.
   Shared by the terminal drawer and the /signal/:uid full page.
   ============================================================= */

export function sigStatusLabel(sig: RecentSignalTrade): string {
  if (!sig) return "—";
  const s: any = sig;
  // CLOSED trades: prefer the result text (e.g. "TGT2 ACHIEVED +20 pts").
  if (s.status === "CLOSED") {
    if (s.result) return s.result;
    if (s.target2Status === "ACHIEVED") return "TGT2 HIT";
    return "CLOSED";
  }
  // OPEN trade lifecycle.
  if (s.target1Status === "ACHIEVED") {
    if (s.target2Status === "ACHIEVED") return "TGT2 HIT";
    return "WAITING FOR TGT2";
  }
  if (s.target2Status === "ACHIEVED") return "TGT2 HIT";
  return "OPEN";
}

export function SignalDetailRows({
  signal,
  fmt,
  fmtSigned,
  formatISTShortDateTime,
}: {
  signal: RecentSignalTrade;
  fmt: (v: number | null | undefined) => string;
  fmtSigned: (v: number | null) => string;
  formatISTShortDateTime: (ts: number) => string;
}) {
  const s: any = signal;
  const entrySL = s.entrySL ?? s.initialSL ?? null;
  const rows: Array<{ label: string; value?: string | null }> = [
    { label: "Script", value: s.symbol ?? null },
    { label: "Exchange", value: s.exchange ?? null },
    { label: "Timeframe", value: s.timeframe ?? null },
    { label: "Signal", value: s.signal ?? null },
    { label: "Signal Generated Time", value: s.entryTime ? formatISTShortDateTime(s.entryTime) : null },
    { label: "Entry Price", value: s.entryPrice != null ? fmt(s.entryPrice) : null },
    { label: "Entry Time", value: s.entryTime ? formatISTShortDateTime(s.entryTime) : null },
    { label: "Initial SL", value: entrySL != null ? fmt(entrySL) : null },
    { label: "Target 1", value: s.target1 != null ? fmt(s.target1) : null },
    { label: "TGT1 Status", value: s.target1Status ?? null },
    { label: "TGT1 Hit Time", value: s.target1HitTime ? formatISTShortDateTime(s.target1HitTime) : null },
    { label: "TGT1 Profit", value: s.target1Profit != null ? fmtSigned(s.target1Profit) : null },
    { label: "Modified SL", value: s.activeSL != null && s.target1Status === "ACHIEVED" ? fmt(s.activeSL) : null },
    { label: "Target 2", value: s.target2 != null ? fmt(s.target2) : null },
    { label: "TGT2 Status", value: s.target2Status ?? null },
    { label: "TGT2 Hit Time", value: s.target2HitTime ? formatISTShortDateTime(s.target2HitTime) : null },
    { label: "TGT2 Profit", value: s.target2Profit != null ? fmtSigned(s.target2Profit) : null },
    { label: "Exit Price", value: s.exitPrice != null ? fmt(s.exitPrice) : null },
    { label: "Exit Time", value: s.exitTime ? formatISTShortDateTime(s.exitTime) : null },
    { label: "Exit Reason", value: s.exitReason ?? null },
    { label: "Final Status", value: sigStatusLabel(signal as any) },
    { label: "Final Result", value: s.result ?? null },
    { label: "Current P&L", value: s.currentPL != null ? fmtSigned(s.currentPL) : null },
    { label: "Final P&L", value: s.status === "CLOSED" ? (s.resultPoints != null ? fmtSigned(s.resultPoints) : (s.currentPL != null ? fmtSigned(s.currentPL) : null)) : null },
    { label: "Max Points", value: s.maxPoints != null ? fmt(s.maxPoints) : null },
  ];
  // Only render fields that actually have a value (no fabricated zeros).
  const present = rows.filter((r) => r.value != null && r.value !== "");

  return (
    <div className="mt-4 divide-y divide-slate-100">
      {present.map((r) => (
        <div key={r.label} className="flex items-center justify-between py-1.5">
          <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
            {r.label}
          </span>
          <span className="font-mono text-[12px] font-bold tabular-nums text-slate-800">
            {r.value}
          </span>
        </div>
      ))}
      {present.length === 0 && (
        <div className="py-4 text-center text-[11px] text-slate-400">
          No additional details available.
        </div>
      )}
    </div>
  );
}
