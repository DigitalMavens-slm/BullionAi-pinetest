import { useEffect, useMemo, useState } from "react";
import {
  fetchPerfSummary,
  fetchPerfDaily,
  fetchPerfScripts,
  fetchPerfTrades,
  fetchPerfTrade,
  fetchStrategySignals,
  type PerfSummary,
  type PerfDailyRow,
  type PerfScriptRow,
  type PerfTrade,
  type StrategySignalRow,
} from "../lib/bullionai-api";

// Premium helpers
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
  return d.toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true });
};
const shortDate = (ts: number | null | undefined) => {
  if (!ts) return "—";
  return new Date(ts).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
};

function tradeStatusLabel(t: PerfTrade): string {
  if (t.status === "CLOSED") {
    if (t.result) return t.result;
    if (t.target2Status === "ACHIEVED") return "TGT2 HIT";
    if (t.target1Status === "ACHIEVED") return "MODIFIED SL HIT";
    return "CLOSED";
  }
  if (t.target1Status === "ACHIEVED") return t.target2Status === "ACHIEVED" ? "TGT2 HIT" : "WAITING TGT2";
  return "OPEN";
}

export function PerformancePage({ compact = false }: { compact?: boolean }) {
  const [summary, setSummary] = useState<PerfSummary | null>(null);
  const [daily, setDaily] = useState<PerfDailyRow[]>([]);
  const [scripts, setScripts] = useState<PerfScriptRow[]>([]);
  const [trades, setTrades] = useState<{ trades: PerfTrade[]; total: number }>({ trades: [], total: 0 });
  const [signals, setSignals] = useState<StrategySignalRow[]>([]);
  const [detail, setDetail] = useState<PerfTrade | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"trades" | "signals">("trades");
  const [filterSym, setFilterSym] = useState("");
  const timeframe = "15m";

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [s, d, sc, tr, sig] = await Promise.all([
        fetchPerfSummary(timeframe),
        fetchPerfDaily(timeframe),
        fetchPerfScripts(timeframe),
        fetchPerfTrades({ timeframe, limit: 50 }),
        fetchStrategySignals({ timeframe, limit: 100 }),
      ]);
      setSummary(s);
      setDaily(d);
      setScripts(sc);
      setTrades(tr);
      setSignals(sig);
    } catch (e: any) {
      setError(e.message || "Performance unavailable");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function openDetail(uid: string) {
    try {
      const t = await fetchPerfTrade(uid);
      if (t) setDetail(t);
    } catch {}
  }

  const kpis = useMemo(() => {
    if (!summary) return [];
    return [
      { label: "Total Trades", value: NUM(summary.totalTrades), sub: `${summary.openTrades} open`, icon: "◈" },
      { label: "Win Rate", value: PCT(summary.winRate), sub: `${summary.winningTrades}W / ${summary.losingTrades}L`, icon: "◎" },
      { label: "Net P&L", value: INR(summary.netPL), sub: "closed trades", icon: "⬢", accent: summary.netPL >= 0 },
      { label: "TGT1 Profit", value: INR(summary.tgt1Profit), sub: "secured", icon: "⬣", accent: true },
      { label: "Open P&L", value: INR(summary.openPL), sub: `${summary.openTrades} running`, icon: "⬔", accent: (summary.openPL ?? 0) >= 0 },
      { label: "Max Points", value: NUM(summary.openMaxPoints), sub: "open best", icon: "⬥" },
    ];
  }, [summary]);

  const hasData = summary && summary.totalTrades > 0;
  const maxDailyPL = Math.max(...daily.map((d) => Math.abs(d.netPL)), 1);

  return (
    <div className={compact ? "mx-auto w-full max-w-[1600px] px-4 py-4" : "mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:py-14"}>
      {/* Premium header */}
      <div className="relative overflow-hidden rounded-[28px] border border-slate-200 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 sm:p-8">
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-amber-400/10 blur-3xl" />
        <div className="absolute -left-20 -bottom-20 h-64 w-64 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white/80 backdrop-blur">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" /> Live • MCX • 15m
            </div>
            <h1 className="mt-3 font-display text-3xl font-black tracking-tight text-white sm:text-4xl">Performance</h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-300">
              Professional trading analytics — every real BUY/SELL stored in the database, TGT1 secured before final P&L.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <div className="rounded-2xl bg-white/10 px-4 py-3 text-center backdrop-blur">
              <div className="text-[10px] font-bold uppercase tracking-wider text-white/60">Timeframe</div>
              <div className="font-mono text-sm font-black text-white">15m</div>
            </div>
            <button onClick={load} className="rounded-2xl bg-amber-400 px-5 py-3 text-sm font-black text-slate-900 transition hover:bg-amber-300">
              Refresh
            </button>
          </div>
        </div>
      </div>

      {loading && (
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-slate-100" />
          ))}
        </div>
      )}

      {!loading && error && (
        <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center text-sm font-medium text-amber-800">{error}</div>
      )}

      {!loading && !error && !hasData && (
        <div className="mt-6 rounded-[24px] border border-slate-200 bg-white p-10 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 text-white">◈</div>
          <h2 className="mt-4 text-lg font-black text-slate-900">No trades yet</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-500">
            Every real BUY/SELL will appear here. The database is the source of truth — even signals while you were offline are stored.
          </p>
        </div>
      )}

      {!loading && !error && hasData && (
        <div className="mt-6 space-y-6">
          {/* KPI grid — premium */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {kpis.map((k) => (
              <div key={k.label} className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-slate-300 hover:shadow-lg">
                <div className="absolute -right-6 -top-6 h-16 w-16 rounded-full bg-slate-50 group-hover:bg-amber-50/50 transition" />
                <div className="relative">
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-900 text-[11px] font-black text-white">{k.icon}</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{k.label}</span>
                  </div>
                  <div className={`mt-3 font-mono text-xl font-black tabular-nums ${k.accent === false ? "text-rose-600" : k.accent ? "text-emerald-600" : "text-slate-900"}`}>{k.value}</div>
                  <div className="text-[10px] font-medium text-slate-400">{k.sub}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Daily chart — premium bars */}
          {daily.length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-black tracking-tight text-slate-900">Daily P&L</h2>
                <span className="text-[11px] font-medium text-slate-400">Last {Math.min(daily.length, 10)} days</span>
              </div>
              <div className="mt-4 flex items-end gap-1.5 overflow-x-auto pb-2">
                {daily.slice(0, 10).reverse().map((d) => (
                  <div key={d.date} className="flex flex-1 flex-col items-center gap-1.5">
                    <div className="flex w-full justify-center" style={{ height: 64 }}>
                      <div
                        className={`w-full max-w-[42px] rounded-t-lg transition ${d.netPL >= 0 ? "bg-emerald-500" : "bg-rose-500"}`}
                        style={{ height: `${Math.max(6, (Math.abs(d.netPL) / maxDailyPL) * 64)}px`, alignSelf: "flex-end" }}
                        title={`${d.date}: ${INR(d.netPL)}`}
                      />
                    </div>
                    <span className="text-[9px] font-bold text-slate-400">{d.date.slice(5)}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {daily.slice(0, 4).map((d) => (
                  <div key={d.date + "sum"} className="rounded-xl bg-slate-50 p-3">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{d.date}</div>
                    <div className={`font-mono text-sm font-black ${d.netPL >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{INR(d.netPL)}</div>
                    <div className="text-[11px] text-slate-500">{d.trades} trades · {d.wins}W</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Scripts — premium */}
          {scripts.length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
              <h2 className="text-sm font-black tracking-tight text-slate-900">Per Script</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {scripts.map((s) => (
                  <div key={s.symbol} className="rounded-2xl border border-slate-100 bg-gradient-to-br from-white to-slate-50 p-4">
                    <div className="flex items-center justify-between">
                      <span className="rounded-lg bg-slate-900 px-2.5 py-1 font-mono text-xs font-black text-white">{s.symbol}</span>
                      <span className={`text-xs font-black ${s.netPL >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{INR(s.netPL)}</span>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-xl bg-white p-2 border border-slate-100">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Trades</div>
                        <div className="font-mono text-sm font-black text-slate-900">{s.trades}</div>
                      </div>
                      <div className="rounded-xl bg-white p-2 border border-slate-100">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Win%</div>
                        <div className="font-mono text-sm font-black text-slate-900">{PCT(s.winRate)}</div>
                      </div>
                      <div className="rounded-xl bg-white p-2 border border-slate-100">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">TGT1</div>
                        <div className="font-mono text-sm font-black text-emerald-600">{INR(s.tgt1Profit)}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tabs: Trades vs Signals */}
          <div className="rounded-2xl border border-slate-200 bg-white p-2">
            <div className="flex gap-2">
              {[
                { id: "trades", label: `Trades · ${trades.total}` },
                { id: "signals", label: `Every BUY/SELL · ${signals.length}` },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id as any)}
                  className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-black transition ${tab === t.id ? "bg-slate-900 text-white shadow" : "bg-slate-50 text-slate-500 hover:bg-slate-100"}`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Trade book OR Signals */}
          {tab === "trades" ? (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <div className="flex items-center justify-between border-b border-slate-100 p-4">
                <h2 className="text-sm font-black tracking-tight text-slate-900">Trade Book — ONE row = ONE lifecycle</h2>
                <input value={filterSym} onChange={(e) => setFilterSym(e.target.value.toUpperCase())} placeholder="Filter GOLD" className="rounded-full border border-slate-200 px-3 py-1.5 text-xs outline-none focus:border-slate-900" />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-400">
                    <tr>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Script</th>
                      <th className="px-4 py-3">Side</th>
                      <th className="px-4 py-3 text-right">Entry</th>
                      <th className="px-4 py-3 text-right">TGT1</th>
                      <th className="px-4 py-3 text-right">Active SL</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">P&L</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {trades.trades
                      .filter((t) => !filterSym || t.symbol.includes(filterSym))
                      .map((t) => (
                        <tr key={t.tradeUid} onClick={() => openDetail(t.tradeUid)} className="cursor-pointer hover:bg-slate-50">
                          <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">{shortDate(t.entryTime)}</td>
                          <td className="px-4 py-3 font-mono text-xs font-black text-slate-900">{t.symbol}</td>
                          <td className="px-4 py-3">
                            <span className={`rounded-full px-2 py-1 text-[10px] font-black ${t.signal === "BUY" ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200" : "bg-rose-50 text-rose-700 ring-1 ring-rose-200"}`}>{t.signal}</span>
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-xs font-bold text-slate-900">{NUM(t.entryPrice)}</td>
                          <td className="px-4 py-3 text-right font-mono text-xs text-slate-600">{NUM(t.target1)} {t.target1Status === "ACHIEVED" ? "✓" : ""}</td>
                          <td className="px-4 py-3 text-right font-mono text-xs text-amber-700">{NUM(t.activeSL)}</td>
                          <td className="px-4 py-3 text-[11px] font-medium text-slate-600">{tradeStatusLabel(t)}</td>
                          <td className={`px-4 py-3 text-right font-mono text-xs font-black ${((t.resultPoints ?? 0) >= 0 ? "text-emerald-600" : "text-rose-600")}`}>{INR(t.resultPoints ?? t.currentPL)}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <div className="border-b border-slate-100 p-4">
                <h2 className="text-sm font-black tracking-tight text-slate-900">Every BUY/SELL Call — complete audit trail</h2>
                <p className="text-xs text-slate-500">Each signal is a DB row, even when no trade opened. No frontend trigger required.</p>
              </div>
              <div className="divide-y divide-slate-100">
                {signals.map((s) => (
                  <div key={s.signalUid} className="flex items-center justify-between p-4 hover:bg-slate-50">
                    <div className="flex items-center gap-3">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-black ${s.signal === "BUY" ? "bg-emerald-500 text-white" : "bg-rose-500 text-white"}`}>{s.signal}</span>
                      <span className="font-mono text-sm font-black text-slate-900">{s.symbol}</span>
                      <span className="text-xs text-slate-400">{shortDate(s.time)} · {fmtTime(s.time)}</span>
                    </div>
                    <span className="font-mono text-sm font-bold text-slate-700">₹{NUM(s.price)}</span>
                  </div>
                ))}
                {signals.length === 0 && <div className="p-8 text-center text-sm text-slate-400">No signals yet — will appear as strategy generates them.</div>}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Trade detail — premium drawer */}
      {detail && (
        <div className="fixed inset-0 z-[140] flex items-end justify-center sm:items-center">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setDetail(null)} />
          <div className="relative z-10 m-3 w-full max-w-lg rounded-[24px] bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className={`rounded-xl px-3 py-1.5 text-xs font-black ${detail.signal === "BUY" ? "bg-emerald-500 text-white" : "bg-rose-500 text-white"}`}>{detail.signal}</span>
                <div>
                  <div className="text-base font-black text-slate-900">{detail.symbol} · {detail.exchange} · {detail.timeframe}</div>
                  <div className="text-xs text-slate-400">{fmtTime(detail.entryTime)}</div>
                </div>
              </div>
              <button onClick={() => setDetail(null)} className="rounded-full bg-slate-100 p-2 text-slate-500 hover:bg-slate-200">✕</button>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-3">
              {[
                { l: "Entry", v: NUM(detail.entryPrice) },
                { l: "Initial SL", v: NUM(detail.initialSL) },
                { l: "TGT1", v: NUM(detail.target1) },
                { l: "TGT1 Status", v: detail.target1Status || "—" },
                { l: "TGT1 Profit", v: INR(detail.target1Profit) },
                { l: "Modified SL", v: detail.target1Status === "ACHIEVED" ? NUM(detail.activeSL) : "—" },
                { l: "TGT2", v: NUM(detail.target2) },
                { l: "TGT2 Status", v: detail.target2Status || "—" },
                { l: "TGT2 Profit", v: INR(detail.target2Profit) },
                { l: "Exit", v: detail.exitPrice ? NUM(detail.exitPrice) : "—" },
                { l: "Status", v: tradeStatusLabel(detail) },
                { l: "Final P&L", v: INR(detail.resultPoints) },
              ].map((r) => (
                <div key={r.l} className="rounded-xl bg-slate-50 p-3">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{r.l}</div>
                  <div className="font-mono text-sm font-black text-slate-900">{r.v}</div>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-xl bg-amber-50 p-3 text-xs leading-relaxed text-amber-800">
              One trade = one DB row. TGT1, modified SL, TGT2 all update the same lifecycle.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
