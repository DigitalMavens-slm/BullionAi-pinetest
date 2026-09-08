import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Layout } from "../components/Layout";
import { SignalDetailRows, sigStatusLabel } from "../components/SignalDetailRows";
import {
  fetchSignalDetail,
  type EnrichedSignalRow,
} from "../lib/bullionai-api";
import { formatISTShortDateTime } from "../lib/ist-time";

function fmt(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  const decimals = Math.abs(v % 1) > 1e-9 ? 2 : 0;
  return v.toLocaleString("en-IN", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function fmtSigned(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  const decimals = Math.abs(v % 1) > 1e-9 ? 2 : 0;
  return (
    (v >= 0 ? "+" : "") +
    v.toLocaleString("en-IN", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })
  );
}

/* =============================================================
   SIGNAL DETAIL PAGE — /signal/:uid
   Complete signal component: DB row + linked trade (when the
   signal opened one) + live engine state for OPEN trades.
   ============================================================= */

export function SignalDetailPage() {
  const { uid } = useParams<{ uid: string }>();
  const [detail, setDetail] = useState<EnrichedSignalRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!uid) {
      setError("Missing signal id.");
      setLoading(false);
      return;
    }
    try {
      const d = await fetchSignalDetail(decodeURIComponent(uid));
      if (!d) {
        setError("Signal not found.");
      } else {
        setDetail(d);
        setError(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load signal.");
    } finally {
      setLoading(false);
    }
  }, [uid]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setDetail(null);
    load().catch(() => {});
    // Refresh live P&L for OPEN trades.
    const id = setInterval(() => {
      if (!cancelled) load().catch(() => {});
    }, 15000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  const t: any = detail?.trade ?? null;
  const live: any = detail?.live ?? null;
  // Merge trade over signal so shared rows show the fullest picture;
  // live engine values win while the trade is OPEN.
  const merged: any = detail
    ? {
        ...detail,
        entryPrice: live?.entryPrice ?? t?.entryPrice ?? detail.price ?? null,
        entryTime: t?.entryTime ?? detail.time ?? null,
        initialSL: t?.initialSL ?? null,
        activeSL: live?.activeSL ?? t?.activeSL ?? null,
        target1: live?.target1 ?? t?.target1 ?? null,
        target2: live?.target2 ?? t?.target2 ?? null,
        target1Status: live?.target1Status ?? t?.target1Status ?? null,
        target2Status: live?.target2Status ?? t?.target2Status ?? null,
        target1HitTime: t?.target1HitTime ?? null,
        target2HitTime: t?.target2HitTime ?? null,
        target1Profit: t?.target1Profit ?? null,
        target2Profit: t?.target2Profit ?? null,
        exitPrice: t?.exitPrice ?? null,
        exitTime: t?.exitTime ?? null,
        exitReason: t?.exitReason ?? null,
        status: t?.status ?? detail.tradeStatus ?? "SIGNAL_ONLY",
        result: t?.result ?? null,
        resultPoints: t?.resultPoints ?? null,
        currentPL: live?.currentPL ?? t?.currentPL ?? null,
        maxPoints: live?.maxPoints ?? t?.maxPoints ?? null,
      }
    : null;

  const isBuy = detail?.signal === "BUY";
  const pl = detail?.pl ?? null;
  const plUp = (pl ?? 0) >= 0;

  return (
    <Layout>
      <div className="mx-auto w-full max-w-2xl px-4 py-6">
        <Link
          to="/"
          className="mb-4 inline-flex items-center gap-1.5 text-[12px] font-bold text-slate-500 transition hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to terminal
        </Link>

        {loading && !detail && (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-[13px] text-slate-400">
            Loading signal…
          </div>
        )}

        {error && !detail && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-8 text-center">
            <div className="text-[13px] font-bold text-rose-600">{error}</div>
            <div className="mt-1 text-[11px] text-rose-400">
              Signals are recorded for MCX 15m going forward.
            </div>
          </div>
        )}

        {detail && merged && (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span
                  className={[
                    "flex h-8 w-[64px] items-center justify-center rounded-lg text-[12px] font-black tracking-wider",
                    isBuy
                      ? "bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200"
                      : "bg-rose-50 text-rose-600 ring-1 ring-rose-200",
                  ].join(" ")}
                >
                  {detail.signal}
                </span>
                <div>
                  <div className="text-[17px] font-black tracking-tight text-slate-900">
                    {detail.symbol}
                  </div>
                  <div className="text-[11px] font-medium text-slate-400">
                    {detail.exchange} · {detail.timeframe}
                    {detail.time
                      ? ` · ${formatISTShortDateTime(detail.time)}`
                      : ""}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                  {merged.status === "CLOSED"
                    ? "Final P&L"
                    : merged.status === "OPEN"
                      ? "Live P&L"
                      : "Status"}
                </div>
                <div
                  className={[
                    "font-mono text-[20px] font-black tabular-nums",
                    merged.status === "SIGNAL_ONLY"
                      ? "text-slate-500"
                      : plUp
                        ? "text-emerald-600"
                        : "text-rose-600",
                  ].join(" ")}
                >
                  {merged.status === "SIGNAL_ONLY"
                    ? sigStatusLabel(merged)
                    : fmtSigned(pl)}
                </div>
                {live?.ltp != null && merged.status === "OPEN" && (
                  <div className="font-mono text-[11px] tabular-nums text-slate-400">
                    LTP {fmt(live.ltp)}
                  </div>
                )}
              </div>
            </div>

            {!detail.trade && (
              <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-[11px] font-medium text-slate-500">
                Signal only — no trade opened from this signal (a position
                was already active).
              </div>
            )}

            <SignalDetailRows
              signal={merged}
              fmt={fmt}
              fmtSigned={fmtSigned}
              formatISTShortDateTime={formatISTShortDateTime}
            />
          </div>
        )}
      </div>
    </Layout>
  );
}
