import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  BarChart3,
  CandlestickChart,
  ChevronDown,
  Circle,
  Clock,
  List,
  Activity,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";

import {
  BullionChart,
} from "./components/chart/BullionChart";
import { Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import { AuthScreen } from "./components/AuthScreen";
import { InstrumentPicker, type SelectedSymbol } from "./components/SymbolSearch";
import { TrialExpired, TrialBadge } from "./components/HomePage";
import { AdminDashboard } from "./components/AdminDashboard";
import { ContactPage } from "./pages/ContactPage";
import { AboutPage } from "./pages/AboutPage";
import { Layout } from "./components/Layout";
import { clearAuthSession, getAuthSession, type AuthUser } from "./lib/auth";

import { MarketingHomePage } from "./pages/MarketingHomePage";
import { FeaturesPage } from "./pages/FeaturesPage";
import { PricingPage } from "./pages/PricingPage";
import { HowItWorksPage } from "./pages/HowItWorksPage";
import { BlogPage, BlogArticleRoute } from "./pages/BlogPage";
import { FAQPage } from "./pages/FAQPage";
import { PaymentPage } from "./pages/PaymentPage";
import { LegalPage, TERMS_DOC, PRIVACY_DOC, RISK_DOC, REFUND_DOC } from "./pages/LegalPage";
import { PerformancePage } from "./pages/PerformancePage";
import { SignalDetailPage } from "./pages/SignalDetailPage";

import "./App.css";

import {
  createStateStream,
  createEventStream,
  subscribeSymbol,
  fetchCandles,
  fetchStrategy,
  fetchStrategyFresh,
  getCurrentContract,
  getApiSessionStatus,
  type ApiSessionStatus,
  type BullionState,
  type Candle,
  type DayStats,
  type StrategyState,
  type RecentSignalTrade,
  fetchState,
  type SseStatus,
} from "./lib/bullionai-api";

import {
  formatISTShortDateTime,
  formatISTTime,
  getISTDate,
} from "./lib/ist-time";

/* =============================================================
   CONSTANTS
   ============================================================= */

/*
 * No default scripts. Every script in the app is
 * user-added via the search box (SymbolSearch ->
 * /api/subscribe) and persisted locally.
 */

const TIMEFRAMES = [
  { label: "15m", value: "15m" },
  { label: "30m", value: "30m" },
  { label: "1H", value: "60m" },
  { label: "2H", value: "120m" },
  { label: "3H", value: "180m" },
  { label: "4H", value: "240m" },
  { label: "1D", value: "1D" },
  { label: "1W", value: "1W" },
  { label: "1M", value: "1M" },
];

const TF_SECONDS: Record<
  string,
  number
> = {
  "15m": 900,
  "30m": 1800,
  "45m": 2700,
  "60m": 3600,
  "120m": 7200,
  "180m": 10800,
  "240m": 14400,
  "1D": 86400,
  "1W": 604800,
  "1M": 2592000,
};

const UP = "text-[#089981]";

const DOWN = "text-[#f23645]";

/* =============================================================
   SMALL COMPONENTS
   ============================================================= */


function RangeBar({
  label,
  low,
  high,
  value,
}: {
  label: string;
  low: number;
  high: number;
  value: number;
}) {

  const span = high - low;

  const pct =

    span > 0

      ? Math.min(
          100,
          Math.max(
            0,
            ((value - low) /
              span) *
              100
          )
        )

      : 0;


  const fmt = (v: number) =>
    Number.isFinite(v)

      ? v.toLocaleString("en-IN", {
          maximumFractionDigits:
            0,
        })

      : "—";


  return (
    <div className="pb-2">

      <div className="flex items-center justify-between text-[11px] font-medium text-slate-500">

        <span className="tabular-nums">
          {fmt(low)}
        </span>


        <span className="px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">

          {label}

        </span>


        <span className="tabular-nums">
          {fmt(high)}
        </span>

      </div>


      <div className="relative mt-1.5 h-1.5 rounded-full bg-slate-200">

        <div

          className="absolute inset-y-0 left-0 rounded-full bg-teal-500"

          style={{
            width: `${pct}%`,
          }}

        />


        <div

          className="absolute -bottom-[5px] h-0 w-0 border-x-[5px] border-t-[6px] border-x-transparent border-t-teal-600"

          style={{

            left: `calc(${pct}% - 5px)`,

          }}

        />

      </div>

    </div>
  );
}




function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {

  return (
    <div

      className={[
        "premium-card rounded-2xl",

        className,
      ].join(" ")}
    >

      {children}

    </div>
  );
}


function CardTitle({
  children,
  right,
}: {
  children: React.ReactNode;
  right?: React.ReactNode;
}) {

  return (
    <div className="flex items-center justify-between border-b border-slate-100 px-3.5 py-2">

      <span className="font-display text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">

        {children}

      </span>


      {right}

    </div>
  );
}


/* Shared signal lifecycle rows (drawer + /signal/:uid page). */
import { SignalDetailRows } from "./components/SignalDetailRows";


/* =============================================================
   SHOONYA STATUS PILL — LIVE / RECONNECTING / FEED STALE / LOGIN REQUIRED
   ============================================================= */
function ShoonyaStatusPill({
  status,
  sseStatus,
  lastSyncAt,
}: {
  status: ApiSessionStatus | null;
  sseStatus?: SseStatus | null;
  lastSyncAt?: number | null;
}) {
  // Priority: backend auth/feed health > live SSE reconnect state.
  const backendSt =
    status?.status ||
    status?.feedState ||
    "login_required";

  let st: string = backendSt;
  if (backendSt === "connected") {
    // SSE is primary: if the SSE link is down, surface RECONNECTING.
    if (sseStatus === "reconnecting") st = "reconnecting";
    else if (sseStatus === "disconnected") st = "reconnecting";
    else st = "connected";
  }

  const cfg =
    st === "connected"
      ? {
          label: "Live",
          dot: "fill-emerald-500 text-emerald-500",
          text: "text-emerald-600",
        }
      : st === "reconnecting"
        ? {
            label: "Reconnecting",
            dot: "fill-amber-500 text-amber-500",
            text: "text-amber-600",
          }
        : st === "stale"
          ? {
              label: "Feed Stale",
              dot: "fill-amber-500 text-amber-500",
              text: "text-amber-600",
            }
          : st === "connecting"
            ? {
                label: "Connecting",
                dot: "fill-sky-500 text-sky-500",
                text: "text-sky-600",
              }
            : st === "disconnected"
              ? {
                  label: "Feed Down",
                  dot: "fill-amber-500 text-amber-500",
                  text: "text-amber-600",
                }
              : {
                  label: "Login Required",
                  dot: "fill-rose-500 text-rose-500",
                  text: "text-rose-600",
                };

  const pill = (
    <span className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold">
      <Circle className={["h-2 w-2", cfg.dot].join(" ")} />
      <span className={cfg.text}>{cfg.label}</span>
    </span>
  );

  // Show uid + last valid-update time when available (no secrets). This is a
  // subtle "last update" timestamp, NOT a refresh indicator.
  const meta =
    status?.uid || lastSyncAt
      ? {
          uid: status?.uid ?? null,
          lastSyncAt: lastSyncAt ?? null,
        }
      : null;

  if (!meta) return pill;

  return (
    <span className="flex items-center gap-2">
      {pill}
      <span className="hidden items-center gap-1.5 text-[10px] font-medium text-slate-400 lg:flex">
        {meta.uid && <span className="font-mono">{meta.uid}</span>}
        {meta.lastSyncAt && (
          <span className="font-mono">
            {new Date(meta.lastSyncAt).toLocaleTimeString("en-IN", {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })}
          </span>
        )}
      </span>
    </span>
  );
}


/* =============================================================
   APP
   ============================================================= */

function App() {

  /* -------------------------
     STATE
     ------------------------- */

  const [
    selectedTimeframe,
    setSelectedTimeframe,
  ] = useState("15m");

  const [
    candles,
    setCandles,
  ] = useState<Candle[]>([]);

  const [
    dayStats,
    setDayStats,
  ] = useState<DayStats | null>(
    null
  );

  const [
    loadingCandles,
    setLoadingCandles,
  ] = useState(true);

  const [
    candleError,
    setCandleError,
  ] = useState<string | null>(
    null
  );

  // Backend Shoonya session lifecycle (Connected / Disconnected /
  // Login Required). Polled so the dashboard reflects the live state.
  const [apiStatus, setApiStatus] =
    useState<ApiSessionStatus | null>(null);

  // SSE connection status for the dashboard pill (LIVE / RECONNECTING).
  // This is purely a connection-health signal; it never clears UI state.
  const [sseStatus, setSseStatus] =
    useState<SseStatus>("connecting");

  // Selected recent signal for the detail drawer (DB authoritative, null = closed).
  // Spec 8: clicking fetches tradeUid from DB and auto-opens drawer.
  const [selectedRecentSignal, setSelectedRecentSignal] =
    useState<{ group: { exchange: string; symbol: string; token: string; timeframe: string }; signal: RecentSignalTrade } | null>(null);

  // Refs to the live SSE sources so tab-visibility recovery can call
  // reconnect() without creating a duplicate connection.
  const sseStateRef =
    useRef<{ status: () => SseStatus; reconnect: () => void; close: () => void } | null>(null);
  const sseEventsRef =
    useRef<{ status: () => SseStatus; reconnect: () => void; close: () => void } | null>(null);

  const [
    viewStrategy,
    setViewStrategy,
  ] = useState<StrategyState | null>(
    null
  );

  const [
    strategyLoading,
    setStrategyLoading,
  ] = useState(false);
  const [
    strategyError,
    setStrategyError,
  ] = useState<string | null>(
    null
  );

  const [
    state,
    setState,
  ] = useState<BullionState | null>(
    null
  );
  const [
    nowMs,
    setNowMs,
  ] = useState(Date.now());

  const [authUser, setAuthUser] =
    useState<AuthUser | null>(getAuthSession());

/* Custom MCX/NSE/BSE symbol override */

  

  const [selectedSymbol, setSelectedSymbol] =
    useState<SelectedSymbol | null>(null);

  // Mobile tabs — each component (Watchlist / Chart / Signals) in its own
  // labeled tab. Desktop ignores this and shows the full 3-column terminal.
  const [mobileTab, setMobileTab] =
    useState<"chart" | "watchlist" | "signals">("watchlist");

  // Premium mobile symbol picker (bottom sheet).
  const [mobileSymbolOpen, setMobileSymbolOpen] =
    useState(false);

  const latestSelRef =
    useRef<{
      tf: string;
      inst: string;
      sym: string;
      selected: SelectedSymbol | null;
    }>({ tf: "", inst: "", sym: "", selected: null });

  /* User-added scripts (persisted locally) */

  const [customSyms, setCustomSyms] =
    useState<SelectedSymbol[]>(() => {
      try {
        return JSON.parse(
          localStorage.getItem("bullionai_custom_symbols") ||
            "[]"
        );
      } catch {
        return [];
      }
    });

  // Segment-based display filtering — user segments from registration.
  // MCX/NSE/BSE/SPOT are always supported exchanges; merge with the user's
  // segments so scripts always add to the watchlist.
  const allowedSegments = useMemo(
    () =>
      new Set(
        [
          "MCX",
          "NSE",
          "BSE",
          "SPOT",
          ...(
            authUser?.segments || []
          ),
        ]
          .map(s =>
            String(s)
              .trim()
              .toUpperCase()
          )
          .filter(Boolean)
      ),
    [authUser]
  );

  const filteredCustomSyms = useMemo(
    () =>
      customSyms.filter(sym =>
        allowedSegments.has(
          String(sym.exch || "")
            .trim()
            .toUpperCase()
        )
      ),
    [customSyms, allowedSegments]
  );

  useEffect(() => {
    localStorage.setItem(
      "bullionai_custom_symbols",
      JSON.stringify(customSyms)
    );
  }, [customSyms]);

  /* Stream live prices for every added script (filtered by user segments) */

  useEffect(() => {
    filteredCustomSyms.forEach(sym => {
      subscribeSymbol(sym);
    });
  }, [filteredCustomSyms]);

  useEffect(() => {
    if (!selectedSymbol) return;
    const seg = String(
      selectedSymbol.exch || ""
    )
      .trim()
      .toUpperCase();
    if (!allowedSegments.has(seg)) {
      setSelectedSymbol(null);
      return;
    }
    subscribeSymbol(selectedSymbol);
  }, [selectedSymbol, allowedSegments]);

  // Auto-load the first watchlist script (or a default) so the chart always
  // shows candles and a signal without requiring a manual selection.
  useEffect(() => {
    if (selectedSymbol) return;
    const first = filteredCustomSyms[0];
    if (first) {
      setSelectedSymbol(first);
      return;
    }
    // No watchlist yet -> default to the CURRENT MCX GOLD contract so the
    // chart isn't empty. Resolve it from the registry (auto-selected), not
    // a hardcoded expiry.
    getCurrentContract("gold").then(ct => {
      if (ct?.ok && ct?.token) {
        const sym: SelectedSymbol = {
          exch: ct.exchange || "MCX",
          token: ct.token,
          tsym: ct.symbol || "GOLD",
          label: ct.symbol || "GOLD",
        };
        setSelectedSymbol(sym);
        subscribeSymbol(sym);
      }
    }).catch(() => {
      const defaultSym: SelectedSymbol = {
        exch: "MCX",
        token: "483079",
        tsym: "GOLD",
        label: "GOLD",
      };
      setSelectedSymbol(defaultSym);
      subscribeSymbol(defaultSym);
    });
  }, [selectedSymbol, filteredCustomSyms]);

  const [customLastCloses, setCustomLastCloses] = useState<
    Record<string, number>
  >({});

  const [customPrevCloses, setCustomPrevCloses] = useState<
    Record<string, number | null>
  >({});

  useEffect(() => {
    filteredCustomSyms.forEach(async sym => {
      const key = `${sym.exch}:${sym.token}`;
      if (customLastCloses[key] != null) return;
      try {
        const res = await fetchCandles("15m", "gold", sym);
        const last = res.candles?.[res.candles.length - 1];
        if (last?.close != null) {
          setCustomLastCloses(prev => ({ ...prev, [key]: last.close }));
        }
        const prevClose = res.dayStats?.prevClose ?? null;
        if (prevClose != null) {
          setCustomPrevCloses(prev => ({ ...prev, [key]: prevClose }));
        }
      } catch {}
    });
  }, [filteredCustomSyms]);

  // Keep ref in sync synchronously (before effects run)
  latestSelRef.current = {
    tf: selectedTimeframe,
    inst: selectedSymbol ? `${selectedSymbol.exch}` : "",
    sym: selectedSymbol ? `${selectedSymbol.exch}:${selectedSymbol.token}` : "",
    selected: selectedSymbol,
  };

  function makeLoadGuard() {
    const snap = `${latestSelRef.current.tf}|${latestSelRef.current.inst}|${latestSelRef.current.sym}`;
    return () =>
      `${latestSelRef.current.tf}|${latestSelRef.current.inst}|${latestSelRef.current.sym}` ===
      snap;
  }

  function addCustomSym(sym: SelectedSymbol) {
    const seg = String(sym.exch || "")
      .trim()
      .toUpperCase();
    if (!allowedSegments.has(seg)) {
      setCandleError(
        `This script is ${seg} but your account allows only ${[...allowedSegments].join(", ")}.`
      );
      return;
    }
    setCandleError(null);
    setCustomSyms(prev =>
      prev.some(
        x => x.exch === sym.exch && x.token === sym.token
      )
        ? prev
        : [...prev, sym]
    );

  }

  function removeCustomSym(sym: SelectedSymbol) {
    setCustomSyms(prev =>
      prev.filter(
        x =>
          !(
            x.exch === sym.exch &&
            x.token === sym.token
          )
      )
    );
    setSelectedSymbol(cur =>
      cur &&
      cur.exch === sym.exch &&
      cur.token === sym.token
        ? null
        : cur
    );
  }



  const [showAdmin, setShowAdmin] = useState(
    () =>
      new URLSearchParams(
        window.location.search
      ).get("admin") === "1" ||
      window.location.hash === "#admin"
  );

  /* -------------------------
     DATA EFFECTS
     ------------------------- */

  // Candles + day stats (45s poll) — only for a selected script

  useEffect(() => {

    let cancelled = false;

    /* No script selected -> no default data */

    if (!selectedSymbol) {

      setLoadingCandles(false);

      setCandleError(null);

      setCandles([]);

      setDayStats(null);

      return;

    }


    async function load(
      initial: boolean
    ) {

      const isCurrent = makeLoadGuard();

      if (initial) {

        setLoadingCandles(
          true
        );

        setCandleError(null);

      }


      try {

        const result =
          await
          fetchCandles(
            selectedTimeframe,
            undefined,
            selectedSymbol
          );

        if (cancelled || !isCurrent()) return;

        if ((result.candles || []).length === 0) {
          setCandleError(
            result.notice ||
              "No historical data available for this script yet."
          );
          setDayStats(null);
          return;
        }

        setCandleError(null);

        setCandles(
          result.candles
        );

        setDayStats(
          result.dayStats ?? null
        );

        if (initial) {

          setCandleError(null);

        }

      } catch (error) {

        if (cancelled || !isCurrent()) return;


        if (initial) {

          setCandleError(

            error instanceof Error

              ? error.message

              : "Failed to load candles."

          );

          setCandles([]);

          setDayStats(null);

        }

      } finally {

        if (!cancelled && initial) {

          setLoadingCandles(false);

        }

      }

    }


    load(true);


    // Faster polling while a fresh script has no candles yet, so a live
    // candle appears as soon as the next market tick lands (then settle).
    const poll = setInterval(

      () => load(false),

      candles.length === 0 ? 8_000 : 45_000

    );


    return () => {

      cancelled = true;

      clearInterval(poll);

    };

  }, [
    selectedTimeframe,
    selectedSymbol,
  ]);


  // Pine strategy per view (30s poll — backend caches)

  useEffect(() => {

    let cancelled = false;

    /* No script selected -> no default strategy */

    if (!selectedSymbol) {

      setViewStrategy(null);

      setStrategyLoading(false);

      setStrategyError(null);

      return;

    }


    async function load(
      initial: boolean
    ) {

      const isCurrent = makeLoadGuard();

      if (initial) {

        setViewStrategy(null);

        setStrategyLoading(true);

        setStrategyError(null);

      }


      try {

        const result =
          await
          fetchStrategy(
            selectedTimeframe,
            undefined,
            selectedSymbol
          );

        if (cancelled || !isCurrent()) return;


        if (
          result.ok &&
          result.strategy
        ) {

          setViewStrategy(
            result.strategy
          );

          if (!initial) {

            setStrategyError(null);

          }

        } else if (initial) {

          setViewStrategy(null);

          setStrategyError(

            result.error ??
              "Strategy unavailable."

          );

        }

      } catch (error) {

        if (cancelled || !isCurrent()) return;


        if (initial) {

          setStrategyError(

            error instanceof Error

              ? error.message

              : "Strategy request failed."

          );

        }

      } finally {

        if (!cancelled && initial) {

          setStrategyLoading(false);

        }

      }

    }


    load(true);


    const poll = setInterval(

      () => load(false),

      30_000

    );


    return () => {

      cancelled = true;

      clearInterval(poll);

    };

  }, [
    selectedTimeframe,
    selectedSymbol,
  ]);


  // SSE stream (live ticks + state)

  useEffect(() => {

    const source = createStateStream(
      s => setState(s),
      undefined,
      (st) => setSseStatus(st)
    );

    sseStateRef.current = source;

    return () => {

      source.close();
      if (sseStateRef.current === source) sseStateRef.current = null;

    };

  }, []);


  // Poll the backend Shoonya session lifecycle so the dashboard reflects
  // Connected / Disconnected / Login Required (also updates when the
  // process restarts with a restored session).
  useEffect(() => {

    let cancelled = false;

    async function poll() {
      const s = await getApiSessionStatus();
      if (!cancelled) setApiStatus(s);
    }

    poll();
    const id = setInterval(poll, 15_000);

    return () => {
      cancelled = true;
      clearInterval(id);
    };

  }, []);


  // Incremental event stream (phase 2): update live prices + candle from
  // backend events without waiting for the next full state broadcast.
  useEffect(() => {

    const source = createEventStream(
      (ev) => {
        if (ev.type === "tick") {
          const tickAny = ev as any;
          const hasPrice = ev.price != null;
          const hasQuote =
            tickAny.bestBid != null ||
            tickAny.bestAsk != null;
          if (!hasPrice && !hasQuote) return;
          setState(prev => {
            if (!prev?.livePrices) return prev;
            const token = String(ev.token || "");
            const live = prev.livePrices as Record<string, any>;
            const existing = live[token] || {};
            return {
              ...prev,
              livePrices: {
                ...live,
                [token]: {
                  ...existing,
                  price: hasPrice ? ev.price : (existing?.price ?? null),
                  tickTime: ev.timestamp || Date.now(),
                  receivedAt: Date.now(),
                  exchange: ev.exchange ?? existing?.exchange,
                  token,
                  bestBid: tickAny.bestBid ?? existing?.bestBid ?? null,
                  bestAsk: tickAny.bestAsk ?? existing?.bestAsk ?? null,
                  high: tickAny.high ?? existing?.high ?? null,
                  low: tickAny.low ?? existing?.low ?? null,
                },
              },
            };
          });
        }

        // Immediate TGT/SL hit — refresh strategy for the affected symbol instantly on tick, not at next 30s poll (bypass 8s cache)
        if (["target1", "target2", "trade_close", "trade_open", "sl_update"].includes(ev.type)) {
          const cur = latestSelRef.current;
          if (cur && String(ev.token) === String(cur.sym.split(":")[1] || "") && String(ev.exchange || "").toUpperCase() === String(cur.inst || "").toUpperCase() && String(ev.timeframe || "") === String(cur.tf || "")) {
            const sym = cur.selected;
            if (sym) {
              fetchStrategyFresh(cur.tf, undefined, sym).then((res) => {
                if (res.ok && res.strategy) setViewStrategy(res.strategy);
              }).catch(() => {});
            }
          }
        }

        // Contract rollover: swap the selected symbol to the new token so
        // the chart, candles and signal engine refresh automatically.
        if (ev.type === "contract_change" && ev.nextToken) {
          setSelectedSymbol(prev => {
            if (!prev) return prev;
            const prevExch = String(prev.exch || "").toUpperCase();
            const evExch = String(ev.exchange || "").toUpperCase();
            if (evExch && prevExch && evExch !== prevExch) return prev;
            const prevRoot = String(prev.tsym || prev.label || "").toUpperCase();
            const nextRoot = String(ev.nextSymbol || "").toUpperCase();
            const sameRoot =
              prevRoot.startsWith(nextRoot) ||
              nextRoot.startsWith(prevRoot) ||
              (prevRoot && nextRoot && prevRoot.slice(0, 3) === nextRoot.slice(0, 3));
            if (prevRoot && nextRoot && !sameRoot) return prev;
            const nextToken = String(ev.nextToken);
            const nextSym = ev.nextSymbol ? String(ev.nextSymbol) : prev.tsym;
            return { ...prev, token: nextToken, tsym: nextSym, label: nextSym };
          });
        }
      },
      {
        types: ["tick", "candle_close", "candle_update", "strategy", "contract_change", "connection_status", "trade_open", "target1", "target2", "sl_update", "trade_close"],
        onSnapshot: (snap) => {
          if (snap?.state) setState(snap.state);
        },
        onStatus: (st) => setSseStatus(st),
      }
    );

    sseEventsRef.current = source;

    return () => {

      source.close();
      if (sseEventsRef.current === source) sseEventsRef.current = null;

    };

  }, []);


  // =========================================================
  // SILENT BACKGROUND SYNCHRONIZATION (safety net)
  //
  // SSE is the PRIMARY real-time mechanism. This background fetch is only a
  // low-frequency safety net (~60s) that silently refreshes the lightweight
  // /api/state so the dashboard never drifts. It NEVER reloads the page,
  // NEVER clears UI state, and NEVER replaces valid values with loading
  // placeholders. If it fails, existing state is kept intact.
  // =========================================================

  const lastValidStateAt = useRef<number | null>(null);
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);

  // Mark "last update" whenever a fresh SSE state arrives.
  useEffect(() => {
    if (state?.updatedAt || state?.market?.receivedAt) {
      const ts = Number(state?.market?.receivedAt || state?.updatedAt || Date.now());
      if (ts > 0) {
        lastValidStateAt.current = ts;
        setLastSyncAt(ts);
      }
    }
  }, [state]);

  // Silent background state sync. Only fetches /api/state (lightweight) and
  // merges it via setState — never clears candles/strategy/selection.
  useEffect(() => {
    let cancelled = false;

    async function sync() {
      // Pause while the tab is hidden to reduce backend load.
      if (document.visibilityState === "hidden") return;
      try {
        const st = await fetchState();
        if (cancelled || !st) return;
        // Merge: keep any state we already hold and overlay the freshly
        // fetched envelope (livePrices, market, marketStatus, strategy).
        // Never clears candles/strategy/selection/watchlist/chart state.
        setState(prev => (prev ? { ...prev, ...st } : st));
        const ts = Number(st?.market?.receivedAt || st?.updatedAt || Date.now());
        if (ts > 0) {
          lastValidStateAt.current = ts;
          setLastSyncAt(ts);
        }
      } catch {
        // Never fatal: keep existing valid state, retry next interval.
      }
    }

    sync();
    const id = setInterval(sync, 60_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);


  // =========================================================
  // TAB VISIBILITY RECOVERY
  //
  // When the user returns to a hidden tab, silently: (1) reconnect the SSE
  // source if it is not connected, (2) do ONE silent state sync. No reload,
  // no remount, no clearing of UI state.
  // =========================================================

  useEffect(() => {
    function onVisible() {
      if (document.visibilityState !== "visible") return;

      // Reconnect both SSE sources if disconnected (no duplicate — the
      // resilient wrapper's reconnect() teardown + reopen is single-shot).
      [sseStateRef.current, sseEventsRef.current].forEach((src) => {
        if (src && src.status() !== "connected") {
          try { src.reconnect(); } catch {}
        }
      });

      // One silent sync to catch up on anything missed while hidden.
      (async () => {
        try {
          const st = await fetchState();
          if (!st) return;
          setState(prev => (prev ? { ...prev, ...st } : st));
          const ts = Number(st?.market?.receivedAt || st?.updatedAt || Date.now());
          if (ts > 0) {
            lastValidStateAt.current = ts;
            setLastSyncAt(ts);
          }
        } catch {}
      })();
    }

    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);


  // Clock (1s)

  useEffect(() => {

    const id = setInterval(

      () => setNowMs(Date.now()),

      1000

    );

    return () => clearInterval(id);

  }, []);




  /* -------------------------
     DERIVED
     ------------------------- */

  const strategy = viewStrategy;

  const signal =
    strategy?.signal ?? null;

  const status =
    strategy?.status ?? null;

  const entryPrice =
    strategy?.entryPrice ?? null;

  const trailSL =
    strategy?.trailSL ?? null;

  const extremeLabel =
    strategy?.extremeLabel ?? "Highest";

  const extremePrice =
    strategy?.extremePrice ?? null;

  const isTradeOpen =
    status === "OPEN";

  const isContractBasedSelected =
    ["MCX", "SPOT"].includes(
      String(
        selectedSymbol?.exch || ""
      )
        .trim()
        .toUpperCase()
    );

  /* Which info-panel layout: backend reports it via strategy.panel.
     Fallback to the MCX/SPOT+15m rule when the panel field is absent. */
  const usesFixedTargets =
    (viewStrategy as any)?.panel === "fixed-target" ||
    ((viewStrategy as any)?.panel == null &&
      isContractBasedSelected &&
      selectedTimeframe === "15m");


  const liveTokenPrice =
    state && selectedSymbol
      ? ((state as any)?.livePrices?.[selectedSymbol.token]?.price ?? null)
      : null;

  const livePrice = selectedSymbol
    ? (liveTokenPrice ??
      customLastCloses[`${selectedSymbol.exch}:${selectedSymbol.token}`] ??
      null)
    : null;


  /* Current P/L — Pine formula on live tick */

  const currentPL =
    isTradeOpen &&
    entryPrice !== null &&
    livePrice !== null

      ? signal === "SELL"

          ? entryPrice - livePrice

          : livePrice - entryPrice

      : (strategy?.currentPL ?? null);


  /* Best P/L — market extreme (Pine maxHigh/maxLow) */
  // The backend already returns the Pine-computed best P/L. Use it as
  // authoritative. Only recompute from the live tick as a fallback for
  // the trailing strategy (where extremePrice is a real price). For the
  // fixed-target strategy, extremePrice is MAX POINTS (a points value),
  // so never treat it as a price.
  const bestPL =
    strategy?.bestPL != null &&
    strategy.bestPL !== 0
      ? strategy.bestPL
      : !usesFixedTargets && isTradeOpen && entryPrice !== null
        ? signal === "SELL"
          ? entryPrice -
            Math.min(
              strategy?.extremePrice ?? Infinity,
              livePrice ?? Infinity
            )
          : Math.max(
              strategy?.extremePrice ?? -Infinity,
              livePrice ?? -Infinity
            ) - entryPrice
        : (strategy?.bestPL ?? null);


  /* Timeline */

  const entryTimeLabel =

    strategy?.entryTime

      ? formatISTShortDateTime(
          strategy.entryTime
        )

      : null;


  const exitTimeLabel =

    strategy?.exitTime != null

      ? typeof strategy.exitTime ===
        "number"
        ? formatISTShortDateTime(
            strategy.exitTime
          )
        : String(strategy.exitTime)

      : null;


  /* Clock / countdown */

  const clockIST = formatISTTime(nowMs);

  const headerDate =
    new Date(nowMs).toLocaleDateString(
      "en-IN",
      {
        day: "2-digit",
        month: "short",
        timeZone: "Asia/Kolkata",
      }
    );


  const tfSec =

    TF_SECONDS[
      selectedTimeframe
    ] ?? 3600;


  const nextBarIn =

    tfSec -

    (Math.floor(nowMs / 1000) %

      tfSec);


  const barCountdown = `${String(
    Math.floor(nextBarIn / 60)
  ).padStart(2, "0")}:${String(
    nextBarIn % 60
  ).padStart(2, "0")}`;


  /* Market hours IST 09:00–23:30 Mon–Fri */

  const marketOpenIST = useMemo(
    () => {

      const ist = getISTDate(nowMs);

      const d = ist.getDay();

      const m =

        ist.getHours() * 60 +
        ist.getMinutes();

      return (

        d >= 1 &&
        d <= 5 &&
        m >= 540 &&
        m <= 1410

      );

    },

    [Math.floor(nowMs / 60_000)]
  );

  /* Exchange-aware market status for the selected segment (SSE-backed). */
  const selectedExchangeStatus = useMemo(() => {
    const exch = String(selectedSymbol?.exch || "").trim().toUpperCase() || "MCX";
    const ms = (state as any)?.marketStatus;
    const fallbackOpen = exch === "MCX" ? marketOpenIST : marketOpenIST;
    if (ms && ms[exch]) {
      const s = ms[exch];
      return {
        current: {
          exchange: exch,
          status: s.status || (s.open ? "OPEN" : "CLOSED"),
          label: s.label || s.status || "Closed",
          open: !!(s.open || s.status === "OPEN"),
        },
        all: ms,
      };
    }
    return {
      current: {
        exchange: exch,
        status: fallbackOpen ? "OPEN" : "CLOSED",
        label: fallbackOpen ? "Open" : "Closed",
        open: fallbackOpen,
      },
      all: ms || null,
    };
  }, [state, selectedSymbol, marketOpenIST]);


  /* Watchlist active row */

  /* Formatters — decimals only for scripts that trade with them */

  const currentTickSize =
    (selectedSymbol as any)?.tickSize ??
    null;

  const currentDecimals = (() => {
    if (currentTickSize != null) {
      const s = String(currentTickSize);
      const dot = s.indexOf(".");
      return dot >= 0 ? s.length - dot - 1 : 0;
    }
    return null;
  })();

  const fmt = (
    v: number | null | undefined
  ) => {
    if (
      v == null ||
      !Number.isFinite(v)
    ) {
      return "—";
    }

    let decimals = currentDecimals ?? (Math.abs(v % 1) > 1e-9 ? 2 : 0);

    return v.toLocaleString(
      "en-IN",
      {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }
    );
  };

  const fmtSigned = (
    v: number | null
  ) => {
    if (v == null) {
      return "—";
    }

    let decimals = currentDecimals ?? (Math.abs(v % 1) > 1e-9 ? 2 : 0);

    return (
      (v >= 0 ? "+" : "") +
      v.toLocaleString("en-IN", {
        minimumFractionDigits: decimals,

        maximumFractionDigits: decimals,
      })
    );
  };

  // --- Per-row decimal formatting (watchlist / ticker) -------------------
  // Each script formats with its OWN tickSize precision, so decimal scripts
  // always show decimals and whole scripts always show whole numbers —
  // independent of which script is currently selected.
  const decimalsFor = (tickSize: number | null | undefined, v: number) => {
    if (tickSize != null) {
      const s = String(tickSize);
      const dot = s.indexOf(".");
      return dot >= 0 ? s.length - dot - 1 : 0;
    }
    return Math.abs(v % 1) > 1e-9 ? 2 : 0;
  };

  const fmtRow = (
    v: number | null | undefined,
    tickSize: number | null | undefined
  ) => {
    if (v == null || !Number.isFinite(v)) {
      return "—";
    }
    const decimals = decimalsFor(tickSize, v);
    return v.toLocaleString("en-IN", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  };

  /* Price tick flash direction */

  const prevLiveRef =
    useRef<number | null>(null);

  const [
    priceFlash,
    setPriceFlash,
  ] = useState<
    "up" | "down" | null
  >(null);

  useEffect(() => {

    if (livePrice == null) {

      prevLiveRef.current = null;

      return;

    }

    const prev =
      prevLiveRef.current;

    prevLiveRef.current =
      livePrice;


    if (
      prev == null ||
      prev === livePrice
    ) {
      return;
    }

    setPriceFlash(
      livePrice > prev
        ? "up"
        : "down"
    );

    const t = setTimeout(
      () => setPriceFlash(null),
      660
    );

    return () =>
      clearTimeout(t);

  }, [livePrice]);

  const prevWatchlistRef =
    useRef<Map<string, number>>(new Map());
  const [watchlistFlash, setWatchlistFlash] =
    useState<Map<string, "up" | "down">>(
      new Map()
    );

  useEffect(() => {
    const livePrices = (state as any)
      ?.livePrices as
      | Record<string, { price?: number }>
      | null
      | undefined;
    if (!livePrices) return;
    const next = new Map<string, "up" | "down">();
    for (const sym of filteredCustomSyms) {
      const lp =
        livePrices[sym.token]?.price ?? null;
      if (lp == null) continue;
      const prev =
        prevWatchlistRef.current.get(
          sym.token
        );
      if (
        prev != null &&
        prev !== lp
      ) {
        next.set(
          sym.token,
          lp > prev ? "up" : "down"
        );
      }
      prevWatchlistRef.current.set(
        sym.token,
        lp
      );
    }
    if (next.size > 0) {
      setWatchlistFlash(next);
      const t = setTimeout(
        () => setWatchlistFlash(new Map()),
        660
      );
      return () => clearTimeout(t);
    }
  }, [state?.livePrices, filteredCustomSyms]);


  /* Live day-range endpoints — tick-accurate between polls */

  const liveHigh =

    dayStats && livePrice != null
      ? Math.max(dayStats.high, livePrice)
      : dayStats?.high ?? null;

  const liveLow =

    dayStats && livePrice != null
      ? Math.min(dayStats.low, livePrice)
      : dayStats?.low ?? null;

  /* Ticker rows fused with SSE live prices — filtered by user segments */

  const customTickerRows =
    useMemo(() => {
      return filteredCustomSyms.map(sym => {
        const lp =
          (state as any)?.livePrices?.[sym.token] ?? null;
        const price =
          lp?.price ??
          customLastCloses[`${sym.exch}:${sym.token}`] ??
          null;
        const prevClose =
          customPrevCloses[`${sym.exch}:${sym.token}`] ?? null;
        const change =
          price != null && prevClose != null
            ? price - prevClose
            : null;
        const changePct =
          change != null && prevClose
            ? (change / prevClose) * 100
            : null;
        return {
          instrument: `${sym.exch}:${sym.token}` as string,
          tvName: (sym.label ?? sym.tsym) as string,
          price,
          change,
          changePct,
          tickSize: (sym as any)?.tickSize ?? null,
        };
      });
    }, [filteredCustomSyms, state, customLastCloses, customPrevCloses]);

  const importantIndices = useMemo(
    () => [
      { tvName: "NIFTY", token: "26000", exchange: "NSE" },
      { tvName: "SENSEX", token: "1", exchange: "BSE" },
      { tvName: "BANKNIFTY", token: "26009", exchange: "NSE" },
      { tvName: "NIFTYIT", token: "26010", exchange: "NSE" },
    ],
    []
  );

  const importantIndicesLive = useMemo(() => {
    return importantIndices
      .map(idx => {
        const lp =
          (state as any)?.livePrices?.[idx.token] ?? null;
        if (!lp || lp.price == null) return null;
        return {
          instrument: idx.tvName,
          tvName: idx.tvName,
          price: lp.price,
          change: (lp as any).change ?? null,
          changePct: (lp as any).changePercent ?? null,
          tickSize: (idx as any)?.tickSize ?? null,
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);
  }, [state]);

  useEffect(() => {
    importantIndices.forEach(idx => {
      subscribeSymbol({
        exch: idx.exchange,
        token: idx.token,
        tsym: idx.tvName,
      });
    });
  }, []);

  
  const navigate = useNavigate();
  const location = useLocation();

  // keep ?admin=1 support
  useEffect(() => {
    const p = new URLSearchParams(location.search);
    if (p.get("admin") === "1" || location.hash === "#admin") setShowAdmin(true);
  }, [location.search, location.hash]);

  /* ================= ADMIN VIEW (full-page) ================= */
  if (showAdmin) {
    return (
      <AdminDashboard
        onExit={() => {
          setShowAdmin(false);
          navigate("/");
        }}
      />
    );
  }

  // Auto-redirect authenticated users away from auth pages
  useEffect(() => {
    if (authUser && (location.pathname === "/login" || location.pathname === "/register")) {
      navigate("/dashboard", { replace: true });
    }
  }, [authUser, location.pathname]);

  /* -------------------------
     RENDER — Multi-page via React Router
     ------------------------- */

  return (
    <Routes>
      {/* ===== MARKETING SITE (public, SEO) ===== */}
      <Route
        path="/"
        element={
          <Layout>
            <MarketingHomePage />
          </Layout>
        }
      />
      <Route
        path="/features"
        element={
          <Layout>
            <FeaturesPage />
          </Layout>
        }
      />
      <Route
        path="/pricing"
        element={
          <Layout>
            <PricingPage />
          </Layout>
        }
      />
      <Route
        path="/how-it-works"
        element={
          <Layout>
            <HowItWorksPage />
          </Layout>
        }
      />
      <Route
        path="/subscribe"
        element={<PaymentPage />}
      />
      <Route
        path="/payment"
        element={<PaymentPage />}
      />
      <Route
        path="/blog"
        element={
          <Layout>
            <BlogPage />
          </Layout>
        }
      />
      <Route
        path="/blog/:slug"
        element={
          <Layout>
            <BlogArticleRoute />
          </Layout>
        }
      />
      <Route
        path="/faq"
        element={
          <Layout>
            <FAQPage />
          </Layout>
        }
      />
      <Route
        path="/about"
        element={
          <Layout>
            <AboutPage />
          </Layout>
        }
      />
      <Route
        path="/contact"
        element={
          <Layout>
            <ContactPage />
          </Layout>
        }
      />
      <Route
        path="/terms"
        element={
          <Layout>
            <LegalPage doc={TERMS_DOC} />
          </Layout>
        }
      />
      <Route
        path="/privacy"
        element={
          <Layout>
            <LegalPage doc={PRIVACY_DOC} />
          </Layout>
        }
      />
      <Route
        path="/risk-disclosure"
        element={
          <Layout>
            <LegalPage doc={RISK_DOC} />
          </Layout>
        }
      />
      <Route
        path="/refund-policy"
        element={
          <Layout>
            <LegalPage doc={REFUND_DOC} />
          </Layout>
        }
      />
      {/* ===== DASHBOARD APP (auth-protected) ===== */}
      <Route
        path="/login"
        element={
          authUser ? (
            <Navigate to="/dashboard" replace />
          ) : (
            <AuthScreen
              key="login"
              initialMode="login"
              onAuthed={u => {
                setAuthUser(u);
                navigate("/dashboard");
              }}
            />
          )
        }
      />
      <Route
        path="/register"
        element={
          authUser ? (
            <Navigate to="/dashboard" replace />
          ) : (
            <AuthScreen
              key="register"
              initialMode="register"
              onAuthed={u => {
                setAuthUser(u);
                navigate("/dashboard");
              }}
            />
          )
        }
      />
      <Route
        path="/dashboard"
        element={
          !authUser ? (
            <Navigate to="/login" replace />
          ) : authUser.hasAccess === false ? (
            <TrialExpired user={authUser} />
          ) : (
            <div className="page-glow flex h-[100dvh] flex-col overflow-hidden text-slate-900">

      {/* ================= HEADER ================= */}

      <header className="relative flex h-16 shrink-0 items-center justify-between border-b border-slate-200/70 bg-white/90 px-4 backdrop-blur-md lg:px-6">

        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-amber-300/70 to-transparent" />

        <div className="flex items-center gap-3">

          <div className="brand-gold-dot flex h-9 w-9 items-center justify-center rounded-xl">

            <BarChart3 className="h-[18px] w-[18px] text-white" />

          </div>


          <div className="leading-tight">

            <div className="font-display text-[17px] font-bold tracking-tight text-slate-900">

              BULLION

              <span className="gold-text">
                AI
              </span>

            </div>

            <div className="text-[9px] font-semibold uppercase tracking-[0.22em] text-slate-400">

              Market intelligence · MCX

            </div>

          </div>

        </div>


        <div className="hidden min-w-[260px] max-w-sm flex-1 px-2 md:block">
          <InstrumentPicker
            onAdd={(sym: any) => addCustomSym(sym)}
          />
        </div>

        <div className="flex items-center gap-2">

          {/* IST DATE-TIME */}

          <span className="hidden items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-semibold text-slate-500 lg:flex">

            <Clock className="h-3 w-3 text-slate-400" />

            <span className="font-mono tabular-nums">

              {headerDate} · {clockIST}

            </span>

            <span className="text-slate-400">
              IST
            </span>

          </span>




          {(authUser as any)?.isAdmin && (
            <button
              onClick={() => setShowAdmin(true)}
              title="Admin Dashboard"
              className="hidden items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-700 hover:bg-amber-100 md:flex"
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              Admin
            </button>
          )}

          <TrialBadge user={authUser} />

          {authUser?.segments &&
            authUser.segments.length > 0 && (
              <span className="hidden items-center gap-1 md:flex">
                {authUser.segments.map(seg => {
                  const m = (state as any)?.marketStatus?.[seg];
                  const open = m ? m.status === "OPEN" : seg === "MCX" ? marketOpenIST : marketOpenIST;
                  return (
                    <span
                      key={seg}
                      className="flex items-center gap-1 rounded-full bg-slate-900 px-2 py-0.5 text-[9px] font-bold tracking-wider text-white"
                      title={`${seg} market ${m ? (m.status || (open ? "OPEN" : "CLOSED")) : open ? "OPEN" : "CLOSED"}`}
                    >
                      {seg}
                      <span className={`h-1.5 w-1.5 rounded-full ${open ? "bg-emerald-400" : "bg-red-400"}`} />
                    </span>
                  );
                })}
              </span>
            )}

          <span className="hidden h-5 w-px bg-slate-200 md:block" />


          {/* ACCOUNT — login-ready slot */}

          <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white py-[3px] pl-1 pr-1.5"><span className="brand-gold-dot flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-extrabold text-white">{authUser?.email?.[0]?.toUpperCase() ?? "G"}</span><span className="hidden flex-col items-start leading-none sm:flex"><span className="text-[10px] font-semibold text-slate-700">{authUser?.name ?? "Trader"}</span><span className="max-w-[140px] truncate text-[8px] font-medium uppercase tracking-wider text-slate-400">{authUser?.email}</span></span><button type="button" title="Sign out" onClick={() => { clearAuthSession(); setAuthUser(null); }} className="rounded-full px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-slate-400 transition hover:bg-slate-100 hover:text-slate-600">Logout</button></div>

        </div>

      </header>




      {/* ================= LIVE TICKER ================= */}

      {(customTickerRows.length > 0 ||
        importantIndicesLive.length > 0) && (
        <div className="ticker-viewport z-10 flex shrink-0 border-b border-slate-200/60 bg-white/80 py-1">

          <div className="ticker-track">

            {[...[...customTickerRows, ...importantIndicesLive], ...[...customTickerRows, ...importantIndicesLive]].map(
              (row, i) => {
                const up =
                  (row.change ?? 0) >= 0;

                return (
                  <span
                    key={`${row.instrument}-${i}`}
                    className="flex items-center gap-1.5 px-4 text-[11px] font-medium"
                  >
                    <span className="font-semibold text-slate-700">
                      {row.tvName}
                    </span>

                    <span className="font-mono tabular-nums text-slate-900">
                      {fmtRow(row.price, row.tickSize)}
                    </span>

                    <span
                      className={[
                        "font-mono text-[10px] font-semibold tabular-nums",
                        up ? "text-emerald-600" : "text-rose-600",
                      ].join(" ")}
                    >
                      {up ? "+" : ""}
                      {row.changePct != null
                        ? row.changePct.toFixed(2) + "%"
                        : "—"}
                    </span>
                  </span>
                );
              }
            )}

          </div>

        </div>
      )}


      {/* ================= WORKSPACE ================= */}

      <main className="mx-auto flex w-full max-w-[1800px] flex-1 min-h-0 flex-col gap-3 overflow-hidden p-3 pb-[calc(76px_+_env(safe-area-inset-bottom))] lg:flex-row lg:gap-3 lg:p-3 lg:pb-3">

        {/* Mobile premium header (symbol + live price, on Chart/Signals tabs) */}
        <div className={`-mt-1 shrink-0 lg:hidden ${mobileTab === "chart" || mobileTab === "signals" ? "block" : "hidden"}`}>
          <Card className="overflow-hidden border-0 bg-white/80 p-0">
            {/* Live symbol + price header */}
            <div className="px-3 pb-1.5 pt-2">
              {/* Tappable symbol selector */}
              <button
                onClick={() => setMobileSymbolOpen(true)}
                className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 transition hover:bg-slate-100"
              >
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-navy text-[11px] font-bold text-white">
                    {(selectedSymbol?.label ?? selectedSymbol?.tsym ?? "—").charAt(0)}
                  </span>
                  <div className="text-left">
                    <div className="text-[14px] font-bold text-slate-900">
                      {selectedSymbol ? (selectedSymbol.label ?? selectedSymbol.tsym) : "Select symbol"}
                    </div>
                    <div className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
                      {selectedSymbol ? selectedSymbol.exch : "—"}
                    </div>
                  </div>
                </div>
                <ChevronDown className="h-4 w-4 text-slate-400" />
              </button>

              {/* Live price + change */}
              <div className="mt-1">
                <div className="flex items-baseline gap-2">
                  <span className="font-mono text-[22px] font-bold tabular-nums tracking-[-0.02em] text-slate-900">
                    {fmt(livePrice ?? dayStats?.close)}
                  </span>
                  <span className={`font-mono text-[12px] font-semibold tabular-nums ${(() => {
                    const pc = dayStats?.prevClose ?? null;
                    const chg = livePrice != null && pc != null ? livePrice - pc : null;
                    return (chg ?? 0) >= 0 ? "text-emerald-600" : "text-rose-600";
                  })()}`}>
                    {(() => {
                      const pc = dayStats?.prevClose ?? null;
                      const chg = livePrice != null && pc != null ? livePrice - pc : null;
                      const pct = chg != null && pc ? (chg / pc) * 100 : null;
                      return `${chg != null ? `${chg >= 0 ? "+" : ""}${fmt(chg)}` : "—"} ${pct != null ? `(${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%)` : ""}`;
                    })()}
                  </span>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Mobile symbol picker bottom sheet */}
        {mobileSymbolOpen && (
          <div className="fixed inset-0 z-[120] flex flex-col justify-end lg:hidden">
            <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setMobileSymbolOpen(false)} />
            <div className="relative max-h-[70vh] overflow-hidden rounded-t-3xl bg-white shadow-2xl">
              <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-slate-200" />
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                <h3 className="text-[15px] font-bold text-slate-900">Select Symbol</h3>
                <button onClick={() => setMobileSymbolOpen(false)} className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100" aria-label="Close">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="max-h-[55vh] overflow-y-auto">
                {filteredCustomSyms.length === 0 && (
                  <div className="px-4 py-10 text-center text-[12px] text-slate-400">
                    No symbols in watchlist yet. Add scripts using the search box above.
                  </div>
                )}
                <div className="divide-y divide-slate-50">
                  {filteredCustomSyms.map((sym) => {
                    const live = (state as any)?.livePrices?.[sym.token] ?? null;
                    const lp = live?.price ?? customLastCloses[`${sym.exch}:${sym.token}`] ?? null;
                    const pc = customPrevCloses[`${sym.exch}:${sym.token}`] ?? dayStats?.prevClose ?? null;
                    const chg = lp != null && pc != null ? lp - pc : null;
                    const pct = chg != null && pc ? (chg / pc) * 100 : null;
                    const up = (chg ?? 0) >= 0;
                    const bid = live?.bestBid ?? null;
                    const ask = live?.bestAsk ?? null;
                    const hi = live?.high ?? null;
                    const lo = live?.low ?? null;
                    const hasBidAsk = bid != null || ask != null;
                    const flash = watchlistFlash.get(sym.token);
                    const flashCls = flash === "up"
                      ? "price-flash-up"
                      : flash === "down"
                        ? "price-flash-down"
                        : "";
                    const dirUp = (chg ?? 0) >= 0;
                    const quotesName = String(sym.label ?? sym.tsym ?? "").toUpperCase().replace(/[^A-Z]/g, "") || String(sym.tsym ?? "").toUpperCase();
                    const isSel = selectedSymbol?.token === sym.token && selectedSymbol?.exch === sym.exch;
                    return (
                      <button
                        key={`${sym.exch}:${sym.token}`}
                        onClick={() => { setSelectedSymbol(sym); setMobileSymbolOpen(false); }}
                        className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition ${isSel ? "bg-slate-50" : "active:bg-slate-50"}`}
                      >
                        <span className="min-w-0 flex-1 leading-tight">
                          <span className="block truncate text-[17px] font-extrabold tracking-tight text-slate-900">{quotesName}</span>
                          <span className={`block font-mono text-[11px] font-bold tabular-nums ${dirUp ? "text-blue-600" : "text-rose-600"}`}>
                            {chg != null ? `${chg >= 0 ? "+" : ""}${fmtRow(chg, (sym as any)?.tickSize)}` : "—"}{" "}
                            {pct != null ? `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%` : ""}
                          </span>
                        </span>
                        {hasBidAsk ? (
                          <span className="grid shrink-0 grid-cols-[80px_1px_80px] grid-rows-[auto_auto_auto] gap-x-3 text-right leading-tight">
                            <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-slate-400">Bid</span>
                            <span className="row-span-3 w-px rounded-full bg-slate-200" aria-hidden />
                            <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-slate-400">Ask</span>
                            <span title="Bid (Buy)" className={`rounded-md bg-blue-50/80 px-1.5 py-0.5 font-mono text-[15px] font-extrabold tabular-nums tracking-tight text-blue-700 ${flashCls}`}>{fmtRow(bid, (sym as any)?.tickSize)}</span>
                            <span title="Ask (Sell)" className={`rounded-md bg-rose-50/80 px-1.5 py-0.5 font-mono text-[15px] font-extrabold tabular-nums tracking-tight text-rose-700 ${flashCls}`}>{fmtRow(ask, (sym as any)?.tickSize)}</span>
                            <span title="Day low" className="font-mono text-[10px] tabular-nums text-slate-500">L: {fmtRow(lo, (sym as any)?.tickSize)}</span>
                            <span title="Day high" className="font-mono text-[10px] tabular-nums text-slate-500">H: {fmtRow(hi, (sym as any)?.tickSize)}</span>
                          </span>
                        ) : (
                          <span className="text-right">
                            <span
                              className={[
                                "block font-mono text-[14px] font-bold tabular-nums",
                                flash === "up"
                                  ? "price-flash-up text-blue-600"
                                  : flash === "down"
                                    ? "price-flash-down text-rose-600"
                                    : "text-slate-900",
                              ].join(" ")}
                            >
                              {fmt(lp)}
                            </span>
                            <span className={`block font-mono text-[11px] tabular-nums ${up ? "text-emerald-600" : "text-rose-600"}`}>
                              {chg != null ? `${chg >= 0 ? "+" : ""}${fmt(chg)}` : "—"}{" "}
                              {pct != null ? `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%` : ""}
                            </span>
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============ LEFT: CHART ============ */}

                <aside className={`flex w-full flex-col gap-3 lg:w-[300px] lg:min-h-0 lg:shrink-0 max-lg:min-h-0 max-lg:flex-1 order-3 lg:order-1 ${mobileTab === "signals" ? "flex" : "hidden"} lg:flex`}>

          {/* TIMEFRAME — premium segmented selector (drives strategy + chart).
              Mobile Signals tab only: on desktop the chart's own TF bar
              drives the shared timeframe, so the duplicate row is hidden. */}
          <div className="flex shrink-0 items-center gap-1 overflow-x-auto rounded-full border border-slate-200/70 bg-white/60 p-1 shadow-sm slim-scroll lg:hidden">
            {TIMEFRAMES.map(tf => {
              const active = tf.value === selectedTimeframe;
              return (
                <button
                  key={tf.value}
                  onClick={() => setSelectedTimeframe(tf.value)}
                  aria-pressed={active}
                  className={[
                    "shrink-0 rounded-full px-2.5 py-1.5 text-[10px] font-bold tracking-wide transition-all",
                    active
                      ? "tf-active text-white"
                      : "text-slate-500 hover:bg-slate-100 hover:text-slate-900",
                  ].join(" ")}
                >
                  {tf.label}
                </button>
              );
            })}
          </div>

          {/* BULLIONAI STRATEGY */}

          <Card className="min-h-0 flex-1 overflow-y-auto slim-scroll">

            <CardTitle

              right={

                strategyLoading ? (

                  <span className="flex items-center gap-1.5 rounded-full bg-blue-50 px-2 py-0.5 text-[9px] font-semibold text-blue-600">

                    <span className="h-2 w-2 animate-spin rounded-full border-[1.5px] border-blue-200 border-t-blue-600" />

                    BullionAI…
                  </span>
                ) : strategyError ? (

                  <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[9px] font-semibold text-amber-600">

                    STALE

                  </span>
                ) : (

                  <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-semibold text-emerald-600">

                    <ShieldCheck className="h-3 w-3" />

                    VERIFIED

                  </span>
                )
              }
            >

              BullionAI

            </CardTitle>


            <div className="p-3">

              {/* ============ SIGNAL / STATUS ROW ============ */}

              <div className="flex items-stretch gap-1.5">

                <div
                  className={[
                    "flex flex-1 items-center justify-between rounded-lg px-2.5 py-2",

                    signal === "BUY"

                      ? "bg-emerald-50 ring-1 ring-emerald-200"

                      : signal === "SELL"

                        ? "bg-rose-50 ring-1 ring-rose-200"

                        : "bg-slate-50 ring-1 ring-slate-200",
                  ].join(" ")}
                >

                  <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                    Signal
                  </span>

                  <span
                    className={[
                      "text-[16px] font-black tracking-tight",

                      signal === "BUY"

                        ? UP

                        : signal === "SELL"

                          ? DOWN

                          : "text-slate-400",
                    ].join(" ")}
                  >

                    {signal ?? "—"}

                  </span>
                </div>

                <div
                  className={[
                    "flex items-center gap-1.5 rounded-lg px-2.5",

                    status === "OPEN"

                      ? "bg-amber-50 ring-1 ring-amber-200"

                      : "bg-slate-50 ring-1 ring-slate-200",
                  ].join(" ")}
                >

                  <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                    {status === "OPEN" ? "LIVE" : "CLOSED"}
                  </span>

                  {status === "OPEN" && (
                    <span className="live-dot text-amber-500" />
                  )}
                </div>

              </div>


              {/* ============ STRATEGY TABLE ============ */}

              {usesFixedTargets ? (
                <table className="mt-2 w-full border-collapse text-[12px]">
                  <tbody>
                    {[
                        ["Entry", fmt(entryPrice), ""],
                        ["SL", fmt(trailSL), "text-amber-600"],
                        [
                          "TGT-1",
                          (strategy as any)?.target1 ?? "-",
                          (strategy as any)?.target1 &&
                          String((strategy as any).target1).includes(
                            "ACHIEVED"
                          )
                            ? "text-emerald-600"
                            : "",
                        ],
                        [
                          "TGT-2",
                          (strategy as any)?.target2 ?? "-",
                          (strategy as any)?.target2 &&
                          String((strategy as any).target2).includes(
                            "ACHIEVED"
                          )
                            ? "text-emerald-600"
                            : "",
                        ],
                        [
                          "Current P/L",
                          fmtSigned(currentPL),
                          currentPL == null
                            ? "text-slate-400"
                            : currentPL >= 0
                              ? "text-emerald-600"
                              : "text-rose-600",
                        ],
                        [
                          "Max Points",
                          (strategy as any)?.maxPointsText ??
                            ((strategy as any)?.maxPoints !=
                            null
                              ? fmt(
                                  (strategy as any)
                                    .maxPoints
                                )
                              : "-"),
                          "",
                        ],
                        [
                          "Entry Time",
                          entryTimeLabel ?? "-",
                          "",
                        ],
                        [
                          "Exit Time",
                          exitTimeLabel ?? "-",
                          "",
                        ],
                        [
                          "Result",
                          (strategy as any)?.result ??
                            "-",
                          "",
                        ],
                      ].map(([label, value, tone]) => (
                      <tr
                        key={label as string}
                        className="border-b border-slate-100 last:border-0"
                      >
                        <td className="py-[7px] pl-2 font-bold text-slate-700">
                          {label}
                        </td>
                        <td className="py-[7px] pr-2 text-right">
                          <span
                            className={`font-mono font-bold tabular-nums ${tone || "text-slate-900"}`}
                          >
                            {value}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <table className="mt-2 w-full border-collapse text-[12px]">

                <tbody>

                  {[[
                    "Entry price",
                    fmt(entryPrice),
                    "",
                  ],
                  ["Trail SL", fmt(trailSL), "text-amber-600"],
                  [extremeLabel, fmt(extremePrice), ""],
                  [
                    "Current P/L",
                    fmtSigned(currentPL),
                    currentPL == null
                      ? "text-slate-400"
                      : currentPL >= 0
                        ? "text-emerald-600"
                        : "text-rose-600",
                  ],
                  [
                    "Best P/L",
                    fmtSigned(bestPL),
                    bestPL == null
                      ? "text-slate-400"
                      : bestPL >= 0
                        ? "text-emerald-600"
                        : "text-rose-600",
                  ],
                  [
                    "Realized P/L",
                    status === "CLOSED"
                      ? fmtSigned(strategy?.realizedPL ?? null)
                      : "—",
                    status !== "CLOSED" || strategy?.realizedPL == null
                      ? "text-slate-400"
                      : strategy.realizedPL >= 0
                        ? "text-emerald-600"
                        : "text-rose-600",
                  ]].map(([label, value, tone]) => (
                    <tr
                      key={label as string}
                      className="border-b border-slate-100 last:border-0"
                    >
                      <td className="py-[7px] pl-2 font-bold text-slate-700">{label}</td>
                      <td className="py-[7px] pr-2 text-right">
                        <span className={`font-mono font-bold tabular-nums ${tone || "text-slate-900"}`}>
                          {value}
                        </span>
                      </td>
                    </tr>
                  ))}

                  <tr className="border-t border-dashed border-slate-200">
                      <td className="py-[7px] pl-2 font-bold text-slate-700">Entry time</td>
                      <td className="max-w-[150px] truncate py-[7px] pr-2 text-right font-mono text-[10px] tabular-nums text-slate-700">
                        {entryTimeLabel ?? "—"}
                      </td>
                  </tr>
                  <tr>
                      <td className="py-[7px] pl-2 font-bold text-slate-700">Exit time</td>
                      <td className="max-w-[150px] truncate py-[7px] pr-2 text-right font-mono text-[10px] tabular-nums text-slate-700">
                        {exitTimeLabel ?? "—"}
                      </td>
                  </tr>

                </tbody>
              </table>
              )}

              {strategyError && (
                <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50/70 px-2.5 py-2 text-[10px] font-medium leading-4 text-amber-700">

                  {strategyError}

                </div>
              )}

            </div>

          </Card>

        </aside>

<section className={`flex min-w-0 min-h-0 flex-1 flex-col gap-3 order-2 lg:order-2 ${mobileTab === "chart" ? "flex" : "hidden"} lg:flex`}>

          <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">

            {/* Chart canvas */}

            <div className="relative min-h-0 flex-1">

              {!selectedSymbol && (
                <div className="absolute inset-0 z-10 flex items-center justify-center">

                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-6 py-5 text-center shadow-sm">

                    <BarChart3 className="mx-auto h-5 w-5 text-slate-300" />

                    <div className="mt-2 text-[12px] font-medium text-slate-500">

                      No script selected

                    </div>

                    <div className="mt-1 text-[10px] text-slate-400">

                      Search above and add a script
                      to begin

                    </div>

                  </div>

                </div>
              )}

              {loadingCandles && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/75 backdrop-blur-sm">

                  <div className="text-center">

                    <div className="mx-auto h-7 w-7 animate-spin rounded-full border-2 border-slate-200 border-t-blue-600" />

                    <div className="mt-3 text-[11px] font-medium text-slate-400">

                      Loading{" "}
                      {selectedSymbol?.tsym}{" "}
                      {selectedTimeframe}
                      …

                    </div>

                  </div>

                </div>
              )}


              {candleError && candles.length === 0 && (
                <div className="absolute inset-0 z-10 flex items-center justify-center">

                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-center shadow-sm">

                    <div className="text-[12px] font-semibold text-amber-700">
                      Loading candle data
                    </div>

                    <div className="mt-1 text-[10px] text-amber-600/80">
                      {candleError}
                    </div>

                  </div>

                </div>
              )}


              {!loadingCandles &&
                !candleError &&
                selectedSymbol &&
                candles.length ===
                  0 && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center">

                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-6 py-5 text-center shadow-sm">

                      <BarChart3 className="mx-auto h-5 w-5 text-slate-300" />

                      <div className="mt-2 text-[12px] font-medium text-slate-500">

                        No data for{" "}
                        {selectedSymbol.tsym}{" "}
                        {selectedTimeframe} yet

                      </div>

                    </div>

                  </div>
                )}


              <BullionChart

                candles={candles}

                signal={signal}

                livePrice={livePrice}

                label={
                  selectedSymbol
                    ? selectedSymbol.label ??
                      selectedSymbol.tsym
                    : "No script added"
                }

                timeframeLabel={

                  selectedTimeframe
                }

                signals={

                  strategy?.signalHistory ??
                  null
                }


                timeframeSeconds={tfSec}

                instrumentConfig={{
                  tickSize: currentTickSize ?? 1,
                  decimals: currentDecimals ?? 0,
                }}

              />

            </div>


            {/* Bottom bar: intervals + countdown + clock */}

            <div className="flex shrink-0 items-center justify-between gap-2 border-t border-slate-100 px-3 py-1.5">

              {selectedSymbol &&
                String(
                  selectedSymbol.exch || ""
                ).toUpperCase() === "MCX" &&
                selectedTimeframe === "15m" && (
                  <span className="mr-2 hidden shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700 sm:inline">
                    MCX · Fixed targets
                  </span>
                )}

              <div className="flex items-center gap-0.5 overflow-x-auto">

                {TIMEFRAMES.map(tf => {

                  const active =

                    tf.value ===
                    selectedTimeframe;


                  return (
                    <button

                      key={tf.value}

                      onClick={() =>
                        setSelectedTimeframe(
                          tf.value
                        )
                      }

                      className={[
                        "min-w-[34px] rounded-md px-1.5 py-1 text-[10px] transition-colors lg:min-w-[38px] lg:px-2 lg:text-[11px]",

                        active

                          ? "tf-active font-semibold text-white"

                          : "font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-900",
                      ].join(" ")}
                    >

                      {tf.label}

                    </button>
                  );

                })}

              </div>


              <div className="flex items-center gap-2.5 text-[10px] font-medium text-slate-500">

                <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono tabular-nums text-slate-600">

                  {barCountdown}

                </span>


                <span className="hidden font-mono tabular-nums sm:inline">

                  {clockIST} IST

                </span>

              </div>

            </div>

          </Card>




        </section>


        {/* ============ RIGHT: SIDEBAR ============ */}

        <aside className={`flex w-full flex-col gap-2 lg:w-[360px] lg:min-h-0 lg:shrink-0 max-lg:min-h-0 max-lg:flex-1 order-1 lg:order-3 ${mobileTab === "watchlist" ? "flex" : "hidden"} lg:flex`}>

          {/* Mobile-only: add a script to the watchlist */}
          <div className="lg:hidden">
            <Card className="p-2.5">
              <InstrumentPicker
                onAdd={(sym: any) => addCustomSym(sym)}
              />
            </Card>
          </div>

          {/* MCX SESSION */}
          {/* WATCHLIST */}

          <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">

            <CardTitle

              right={

                <span className="flex items-center gap-1 text-[10px] font-medium text-slate-400">

                  <Circle

                    className={[
                      "h-1.5 w-1.5",

                      marketOpenIST

                        ? "fill-emerald-500 text-emerald-500"

                        : "fill-slate-300 text-slate-300",
                    ].join(" ")}
                  />


                  MCX

                </span>
              }
            >

              Watchlist

            </CardTitle>

            {/* Watchlist — same Quotes rows on mobile and desktop */}
            <div className="divide-y divide-slate-100 min-h-0 flex-1 overflow-y-auto slim-scroll">
              {filteredCustomSyms.length === 0 && (
                <div className="px-4 py-10 text-center text-[12px] text-slate-400">
                  {customSyms.length === 0
                    ? "No scripts added yet."
                    : "No scripts match your segments."}
                  <br />
                  Add scripts using the search box above.
                </div>
              )}
              {filteredCustomSyms.map((sym) => {
                const liverow = (state as any)?.livePrices?.[sym.token] ?? null;
                const lprow =
                  liverow?.price ??
                  customLastCloses[`${sym.exch}:${sym.token}`] ??
                  null;
                const pcrow =
                  customPrevCloses[`${sym.exch}:${sym.token}`] ??
                  dayStats?.prevClose ??
                  null;
                const chgrow = lprow != null && pcrow != null ? lprow - pcrow : null;
                const pctrow = chgrow != null && pcrow ? (chgrow / pcrow) * 100 : null;
                const uprow = (chgrow ?? 0) >= 0;
                const bidrow = liverow?.bestBid ?? null;
                const askrow = liverow?.bestAsk ?? null;
                const hirow = liverow?.high ?? null;
                const lorow = liverow?.low ?? null;
                const hasBARow = bidrow != null || askrow != null;
                const dirUpRow = (chgrow ?? 0) >= 0;
                const quotesNameRow = String(sym.label ?? sym.tsym ?? "").toUpperCase().replace(/[^A-Z]/g, "") || String(sym.tsym ?? "").toUpperCase();
                const isSel = selectedSymbol?.token === sym.token && selectedSymbol?.exch === sym.exch;
                return (
                  <div
                    key={sym.exch + sym.token}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedSymbol(sym)}
                    className={`flex cursor-pointer select-none items-center gap-3 px-4 py-2.5 transition lg:gap-2.5 lg:px-3 lg:py-[7px] ${isSel ? "bg-slate-50" : "active:bg-slate-50"}`}
                  >
                    <span className="min-w-0 flex-1 leading-tight">
                      <span className="block truncate text-[16px] font-extrabold tracking-tight text-slate-900 lg:text-[13px]">{quotesNameRow}</span>
                      <span className={`block font-mono text-[11px] font-bold tabular-nums lg:text-[10px] ${dirUpRow ? "text-blue-600" : "text-rose-600"}`}>
                        {chgrow != null ? `${chgrow >= 0 ? "+" : ""}${fmt(chgrow)}` : "—"}{" "}
                        {pctrow != null ? `${pctrow >= 0 ? "+" : ""}${pctrow.toFixed(2)}%` : ""}
                      </span>
                    </span>
                    {hasBARow ? (
                      <span className="grid shrink-0 grid-cols-[80px_1px_80px] grid-rows-[auto_auto_auto] gap-x-3 text-right leading-tight lg:grid-cols-[70px_1px_70px] lg:gap-x-2">
                        <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-slate-400">Bid</span>
                        <span className="row-span-3 w-px rounded-full bg-slate-200" aria-hidden />
                        <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-slate-400">Ask</span>
                        <span title="Bid (Buy)" className="rounded-md bg-blue-50/80 px-1.5 py-0.5 font-mono text-[15px] font-extrabold tabular-nums tracking-tight text-blue-700 lg:text-[12px]">{fmtRow(bidrow, (sym as any)?.tickSize)}</span>
                        <span title="Ask (Sell)" className="rounded-md bg-rose-50/80 px-1.5 py-0.5 font-mono text-[15px] font-extrabold tabular-nums tracking-tight text-rose-700 lg:text-[12px]">{fmtRow(askrow, (sym as any)?.tickSize)}</span>
                        <span title="Day low" className="font-mono text-[10px] tabular-nums text-slate-500 lg:text-[9px]">L: {fmtRow(lorow, (sym as any)?.tickSize)}</span>
                        <span title="Day high" className="font-mono text-[10px] tabular-nums text-slate-500 lg:text-[9px]">H: {fmtRow(hirow, (sym as any)?.tickSize)}</span>
                      </span>
                    ) : (
                    <span className="text-right">
                      <span className={`block font-mono text-[15px] font-bold tabular-nums lg:text-[12px] ${uprow ? "text-slate-900" : "text-slate-900"}`}>
                        {fmt(lprow)}
                      </span>
                      <span className={`block font-mono text-[12px] font-medium tabular-nums lg:text-[10px] ${uprow ? "text-emerald-600" : "text-rose-600"}`}>
                        {chgrow != null ? `${chgrow >= 0 ? "+" : ""}${fmt(chgrow)}` : "—"}{" "}
                        {pctrow != null ? `${pctrow >= 0 ? "+" : ""}${pctrow.toFixed(2)}%` : ""}
                      </span>
                    </span>
                    )}
                    <button
                      onClick={e => { e.stopPropagation(); removeCustomSym(sym); }}
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-slate-300 hover:bg-rose-50 hover:text-rose-500"
                      aria-label="Remove"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
            </div>

          </Card>


          {/* QUOTE DETAILS — desktop only (hidden on mobile watchlist) */}

          <Card className="hidden shrink-0 p-3.5 lg:block">

            <div className="flex items-center gap-3">

              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[12px] font-bold text-slate-600">

                {selectedSymbol?.tsym?.[0] ?? "?"}

              </span>


              <div className="min-w-0 leading-tight">

                <div className="text-[14px] font-bold tracking-tight text-slate-900">

                  {selectedSymbol ? selectedSymbol.tsym : "No script"}

                </div>

                <div className="truncate text-[11px] font-medium text-slate-500">

                  {selectedSymbol
                    ? `${selectedSymbol.exch} · ${selectedSymbol.tsym}`
                    : "Add from the search box"}

                </div>

                <div className="text-[10px] text-slate-400">

                  {selectedSymbol
                    ? `${selectedSymbol.exch} · ${selectedSymbol.token}`
                    : "—"}

                </div>

              </div>

            </div>


            <div className="mt-3 flex flex-wrap items-baseline gap-x-2">

              <span

                className={[
                  "font-mono text-[22px] font-bold leading-none tracking-[-0.03em] tabular-nums",

                  priceFlash === "up"
                    ? "price-flash-up text-blue-600"

                    : priceFlash === "down"
                      ? "price-flash-down text-rose-600"

                      : "text-slate-900",
                ].join(" ")}
              >

                {fmt(
                  livePrice ??
                    dayStats?.close
                )}

              </span>


              <span className="text-[10px] font-medium text-slate-400">

                {selectedSymbol
                  ? `${selectedSymbol.exch}`
                  : ""}

              </span>

            </div>


            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">

              {livePrice !== null &&
                dayStats?.prevClose !=
                  null &&
                (() => {

                  const chg =

                    livePrice -

                    dayStats.prevClose;

                  const pct =

                    dayStats.prevClose !==
                      0

                      ? (chg /
                          dayStats.prevClose) *

                        100

                      : 0;

                  const up = chg >= 0;


                  return (
                    <span

                      className={[
                        "font-mono text-[13px] font-semibold tabular-nums",

                        up ? UP : DOWN,
                      ].join(" ")}
                    >

                      {up ? "+" : ""}

                      {fmtSigned(chg)}{" "}

                      <span className="opacity-75">

                        ({up ? "+" : ""}

                        {pct.toFixed(2)}%)

                      </span>

                    </span>
                  );

                })()}


              <span className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500">

                <Circle

                  className={[
                    "h-2 w-2",

                    selectedExchangeStatus.current.open

                      ? "fill-emerald-500 text-emerald-500"

                      : "fill-slate-300 text-slate-300",
                  ].join(" ")}
                />


                {selectedExchangeStatus.current.open
                  ? `${selectedExchangeStatus.current.exchange} · ${selectedExchangeStatus.current.status}`
                  : `${selectedExchangeStatus.current.exchange} · ${selectedExchangeStatus.current.status || "CLOSED"}`}

              </span>

              {/* Shoonya connection state — Connected / Disconnected / Login Required */}
              <ShoonyaStatusPill status={apiStatus} sseStatus={sseStatus} lastSyncAt={lastSyncAt} />

            </div>


            {dayStats && (
              <div className="mt-3">

                <RangeBar

                  label="DAY'S RANGE"

                  low={liveLow ?? dayStats.low}

                  high={liveHigh ?? dayStats.high}

                  value={

                    livePrice ??
                    dayStats.close
                  }

                />


                <div className="mt-2 grid grid-cols-4 gap-1 text-center">

                  {[

                    ["O", dayStats.open],

                    ["H", liveHigh],

                    ["L", liveLow],

                    [

                      "PC",

                      dayStats.prevClose,

                    ],

                  ].map(
                    ([k, v]) => (
                      <div

                        key={k as string}

                        className="rounded-lg bg-slate-50 py-1.5"
                      >

                        <div className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">

                          {k}

                        </div>

                        <div className="font-mono text-[11px] font-semibold tabular-nums text-slate-700">

                          {fmt(v as number)}

                        </div>

                      </div>
                    )
                  )}

                </div>

              </div>
            )}


          </Card>


        </aside>

        {/* Mobile bottom tabs — Watchlist / Chart / Signals, icon + label */}
        <nav
          className="fixed bottom-0 left-0 right-0 z-30 border-t border-slate-200/80 bg-white/95 backdrop-blur-xl lg:hidden"
          aria-label="Mobile terminal tabs"
        >
          <div className="mx-auto grid max-w-md grid-cols-3 gap-1 px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2">
          {[
            { id: "watchlist", label: "Watchlist", icon: List },
            { id: "chart", label: "Chart", icon: CandlestickChart },
            { id: "signals", label: "Signals", icon: Activity },
          ].map(tab => {
            const Icon = tab.icon;
            const active = mobileTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setMobileTab(tab.id as any)}
                aria-label={tab.label}
                className={[
                  "flex flex-col items-center gap-1 rounded-2xl px-2 py-2 text-[10px] font-bold transition-colors",
                  active
                    ? "bg-accent/10 text-accent"
                    : "text-slate-400 hover:text-slate-600",
                ].join(" ")}
              >
                <Icon className="h-5 w-5" strokeWidth={active ? 2.4 : 2} />
                {tab.label}
              </button>
            );
          })}
          </div>
        </nav>

      </main>

    </div>
          )
        }
      />
      <Route
        path="/performance"
        element={
          <Layout>
            <PerformancePage />
          </Layout>
        }
      />
      <Route
        path="/signal/:uid"
        element={<SignalDetailPage />}
      />
      <Route path="*" element={<Navigate to="/" replace />} />

      {/* RECENT SIGNAL DETAIL DRAWER */}
      {selectedRecentSignal && (
        <div className="fixed inset-0 z-[130] flex items-end justify-center sm:items-center">
          <div
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
            onClick={() => setSelectedRecentSignal(null)}
          />
          <div className="relative z-10 m-3 w-full max-w-md rounded-3xl bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className={[
                    "flex h-6 w-[48px] items-center justify-center rounded-md text-[10px] font-black tracking-wider",
                    selectedRecentSignal.signal.signal === "BUY"
                      ? "bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200"
                      : "bg-rose-50 text-rose-600 ring-1 ring-rose-200",
                  ].join(" ")}
                >
                  {selectedRecentSignal.signal.signal}
                </span>
                <div>
                  <div className="text-sm font-black text-slate-900">
                    {selectedRecentSignal.group.symbol}
                  </div>
                  <div className="text-[10px] font-medium text-slate-400">
                    {selectedRecentSignal.group.exchange} · {selectedRecentSignal.group.timeframe}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSelectedRecentSignal(null)}
                className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <SignalDetailRows
              signal={selectedRecentSignal.signal}
              fmt={fmt}
              fmtSigned={fmtSigned}
              formatISTShortDateTime={formatISTShortDateTime}
            />
          </div>
        </div>
      )}

    </Routes>
  );
}


export default App;
