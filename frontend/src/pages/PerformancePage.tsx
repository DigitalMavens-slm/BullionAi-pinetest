import { useEffect, useMemo, useState } from "react";
import {
  fetchPerfSummary,
  fetchPerfDaily,
  fetchPerfScripts,
  fetchPerfTrades,
  fetchPerfTrade,
  type PerfSummary,
  type PerfDailyRow,
  type PerfScriptRow,
  type PerfTrade,
} from "../lib/bullionai-api";

const INR = (v: number | null | undefined) => {
  if (v == null || !Number.isFinite(v)) return "—";
  const n = Math.abs(v);
  const s = "₹" + n.toLocaleString("en-IN", { maximumFractionDigits: 0 });
  return (v >= 0 ? "+" : "-") + s;
};

const NUM = (v: number | null | undefined) => (v == null || !Number.isFinite(v) ? "—" : v.toLocaleString("en-IN"));

const PCT = (v: number | null | undefined) => (v == null || !Number.isFinite(v) ? "—" : (Number(v) || 0).toFixed(1) + "%");

const fmtTime = (ts: number | null | undefined) => {
  if (!ts) return "—";
  const d = new Date(ts);
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
};

function statusLabel(t: PerfTrade): string {
  if (t.status === "CLOSED") {
    if (t.result) return t.result;
    if (t.target2Status === "ACHIEVED") return "TGT2 HIT";
    if (t.target1Status === "ACHIEVED") return "MODIFIED SL HIT";
    return "CLOSED";
  }
  if (t.target1Status === "ACHIEVED") {
    if (t.target2Status === "ACHIEVED") return "TGT2 HIT";
    return "WAITING FOR TGT2";
  }
  if (t.target2Status === "ACHIEVED") return "TGT2 HIT";
  return "OPEN";
}

export function PerformancePage({ compact = false }: { compact?: boolean }) {
  const [summary, setSummary] = useState<PerfSummary | null>(null);
  const [daily, setDaily] = useState<PerfDailyRow[]>([]);
  const [scripts, setScripts] = useState<PerfScriptRow[]>([]);
  const [trades, setTrades] = useState<{ trades: PerfTrade[]; total: number }>({ trades: [], total: 0 });
  const [detail, setDetail] = useState<PerfTrade | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showMore, setShowMore] = useState(false);

  const timeframe = "15m";

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [s, d, sc, tr] = await Promise.all([
        fetchPerfSummary(timeframe),
        fetchPerfDaily(timeframe),
        fetchPerfScripts(timeframe),
        fetchPerfTrades({ timeframe, limit: showMore ? 60 : 12 }),
      ]);
      setSummary(s);
      setDaily(d);
      setScripts(sc);
      setTrades(tr);
    } catch (e: any) {
      setError(e.message || "Performance data unavailable.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showMore]);

  async function openDetail(uid: string) {
    try {
      const t = await fetchPerfTrade(uid);
      if (t) setDetail(t);
    } catch {}
  }

  const hasData = useMemo(() => {
    const s = summary;
    if (!s) return false;
    return s.totalTrades > 0;
  }, [summary]);

  const kpis = [
    { label: "Total Trades", value: NUM(summary?.totalTrades) },
    { label: "Open", value: NUM(summary?.openTrades) },
    { label: "Closed", value: NUM(summary?.closedTrades) },
    { label: "Wins", value: NUM(summary?.winningTrades) },
    { label: "Losses", value: NUM(summary?.losingTrades) },
    { label: "Win Rate", value: PCT(summary?.winRate) },
    { label: "TGT1 Profit", value: INR(summary?.tgt1Profit) },
    { label: "Net P&L", value: INR(summary?.netPL) },
  ];

  return (
    <section className={compact ? "mx-auto w-full max-w-[1600px] px-4 py-4" : "mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-20"}>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-black tracking-tight text-slate-900">
          BullionAI Performance
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Real strategy performance · MCX · 15m
        </p>
      </div>

      {loading && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-400">
          Loading performance…
        </div>
      )}

      {!loading && error && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-6 text-center text-sm text-amber-700">
          {error}
        </div>
      )}

      {!loading && !error && !hasData && (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-2xl">📈</div>
          <h2 className="text-base font-bold text-slate-800">No performance data yet.</h2>
          <p className="mt-1 text-sm text-slate-500">
            Performance will appear here as BullionAI generates live strategy trades.
          </p>
        </div>
      )}

      {!loading && !error && hasData && (
        <div className="space-y-6">
          {/* KPI CARDS */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {kpis.map((k) => (
              <div key={k.label} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{k.label}</div>
                <div className="mt-1 font-mono text-xl font-black tabular-nums text-slate-900">{k.value}</div>
              </div>
            ))}
          </div>

          {/* DAILY */}
          {daily.length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <h2 className="mb-3 text-sm font-black text-slate-800">Daily Performance</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-[10px] uppercase tracking-wider text-slate-400">
                      <th className="py-2 pr-3">Date</th>
                      <th className="py-2 pr-3 text-right">Trades</th>
                      <th className="py-2 pr-3 text-right">TGT1 Profit</th>
                      <th className="py-2 text-right">Final P&L</th>
                    </tr>
                  </thead>
                  <tbody>
                    {daily.slice(0, 10).map((d) => (
                      <tr key={d.date} className="border-b border-slate-100">
                        <td className="py-2 pr-3 font-medium text-slate-700">{d.date}</td>
                        <td className="py-2 pr-3 text-right font-mono text-slate-700">{NUM(d.trades)}</td>
                        <td className="py-2 pr-3 text-right font-mono text-emerald-600">{INR(d.tgt1Profit)}</td>
                        <td className={"py-2 text-right font-mono " + (d.netPL >= 0 ? "text-emerald-600" : "text-rose-600")}>{INR(d.netPL)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* SCRIPTS */}
          {scripts.length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <h2 className="mb-3 text-sm font-black text-slate-800">Script Performance</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {scripts.map((s) => (
                  <div key={s.symbol} className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
                    <div className="text-sm font-black text-slate-800">{s.symbol}</div>
                    <div className="mt-2 grid grid-cols-2 gap-y-1 text-[11px]">
                      <span className="text-slate-400">Trades</span><span className="text-right font-mono text-slate-700">{NUM(s.trades)}</span>
                      <span className="text-slate-400">Win Rate</span><span className="text-right font-mono text-slate-700">{PCT(s.winRate)}</span>
                      <span className="text-slate-400">Net P&L</span><span className={"text-right font-mono " + (s.netPL >= 0 ? "text-emerald-600" : "text-rose-600")}>{INR(s.netPL)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TRADE BOOK */}
          {trades.trades.length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-black text-slate-800">Trade Book</h2>
                <button
                  onClick={() => setShowMore((v) => !v)}
                  className="rounded-lg border border-slate-200 px-3 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
                >
                  {showMore ? "Show less" : "View more"}
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-[10px] uppercase tracking-wider text-slate-400">
                      <th className="py-2 pr-3">Date</th>
                      <th className="py-2 pr-3">Script</th>
                      <th className="py-2 pr-3">Dir</th>
                      <th className="py-2 pr-3 text-right">Entry</th>
                      <th className="py-2 pr-3 text-right">TGT1</th>
                      <th className="py-2 pr-3 text-right">TGT2</th>
                      <th className="py-2 pr-3">Status</th>
                      <th className="py-2 text-right">Final P&L</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trades.trades.map((t) => (
                      <tr
                        key={t.tradeUid}
                        onClick={() => openDetail(t.tradeUid)}
                        className="cursor-pointer border-b border-slate-100 transition hover:bg-slate-50"
                      >
                        <td className="py-2 pr-3 whitespace-nowrap text-[11px] text-slate-500">
                          {t.entryTime ? new Date(t.entryTime).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) : "—"}
                        </td>
                        <td className="py-2 pr-3 font-medium text-slate-700">{t.symbol}</td>
                        <td className="py-2 pr-3">
                          <span className={"rounded-md px-1.5 py-0.5 text-[10px] font-black " + (t.signal === "BUY" ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600")}>
                            {t.signal}
                          </span>
                        </td>
                        <td className="py-2 pr-3 text-right font-mono text-slate-700">{NUM(t.entryPrice)}</td>
                        <td className="py-2 pr-3 text-right font-mono text-slate-700">{NUM(t.target1)}</td>
                        <td className="py-2 pr-3 text-right font-mono text-slate-700">{NUM(t.target2)}</td>
                        <td className="py-2 pr-3 text-[11px] text-slate-500">{statusLabel(t)}</td>
                        <td className={"py-2 text-right font-mono " + ((t.resultPoints ?? 0) >= 0 ? "text-emerald-600" : "text-rose-600")}>
                          {INR(t.resultPoints)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TRADE DETAIL DRAWER */}
      {detail && (
        <div className="fixed inset-0 z-[140] flex items-end justify-center sm:items-center">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setDetail(null)} />
          <div className="relative z-10 m-3 w-full max-w-md rounded-3xl bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={"flex h-6 w-[48px] items-center justify-center rounded-md text-[10px] font-black " + (detail.signal === "BUY" ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600")}>
                  {detail.signal}
                </span>
                <div>
                  <div className="text-sm font-black text-slate-900">{detail.symbol} · {detail.exchange}</div>
                  <div className="text-[10px] text-slate-400">{fmtTime(detail.entryTime)}</div>
                </div>
              </div>
              <button onClick={() => setDetail(null)} className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100">✕</button>
            </div>

            <div className="mt-4 divide-y divide-slate-100">
              {[
                { l: "Entry", v: NUM(detail.entryPrice) },
                { l: "Initial SL", v: NUM(detail.initialSL) },
                { l: "TGT1", v: NUM(detail.target1) },
                { l: "TGT1 Status", v: detail.target1Status || "—" },
                { l: "TGT1 Profit", v: INR(detail.target1Profit) },
                { l: "Modified SL", v: detail.target1Status === "ACHIEVED" ? NUM(detail.activeSL) : null },
                { l: "TGT2", v: NUM(detail.target2) },
                { l: "TGT2 Status", v: detail.target2Status || "—" },
                { l: "Final Status", v: statusLabel(detail) },
                { l: "Final P&L", v: INR(detail.resultPoints) },
                { l: "Exit Time", v: detail.exitTime ? fmtTime(detail.exitTime) : null },
              ].filter((r) => r.v != null).map((r) => (
                <div key={r.l} className="flex items-center justify-between py-1.5">
                  <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400">{r.l}</span>
                  <span className="font-mono text-[12px] font-bold tabular-nums text-slate-800">{r.v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
