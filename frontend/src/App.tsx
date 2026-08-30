import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  BarChart3,
  Bell,
  BellOff,
  BellRing,
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

import "./App.css";

import {
  createStateStream,
  createEventStream,
  subscribeSymbol,
  fetchCandles,
  fetchStrategy,
  type BullionState,
  type Candle,
  type DayStats,
  type StrategyState,
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

  // Mobile tab: 'chart' | 'watchlist' | 'signals'. Desktop ignores this
  // and shows the full 3-column terminal. Defaults to watchlist.
  const [mobileTab, setMobileTab] =
    useState<"chart" | "watchlist" | "signals">("watchlist");

  // Premium mobile symbol picker (bottom sheet) on Chart/Signals tabs.
  const [mobileSymbolOpen, setMobileSymbolOpen] =
    useState(false);

  const latestSelRef =
    useRef<{
      tf: string;
      inst: string;
      sym: string;
    }>({ tf: "", inst: "", sym: "" });

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

  // Segment-based display filtering — user segments from registration
  const allowedSegments = useMemo(
    () =>
      new Set(
        (
          authUser?.segments || [
            "MCX",
            "NSE",
            "BSE",
          ]
        ).map(s =>
          String(s)
            .trim()
            .toUpperCase()
        )
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
    // No watchlist yet -> default to MCX GOLD so the chart isn't empty.
    const defaultSym: SelectedSymbol = {
      exch: "MCX",
      token: "483079",
      tsym: "GOLD",
      label: "GOLD",
    };
    setSelectedSymbol(defaultSym);
    subscribeSymbol(defaultSym);
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
    const isNew = !customSyms.some(
      x => x.exch === sym.exch && x.token === sym.token
    );
    setCustomSyms(prev =>
      prev.some(
        x => x.exch === sym.exch && x.token === sym.token
      )
        ? prev
        : [...prev, sym]
    );
    // Desktop notifications: prompt (user gesture) when the first
    // script is added so BUY/SELL alerts reach the desktop.
    if (isNew && customSyms.length === 0) {
      requestDesktopNotifications();
    }
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

    const source = createStateStream(s => {
      setState(s);
    });


    return () => {

      source.close();

    };

  }, []);


  // Incremental event stream (phase 2): update live prices + candle from
  // backend events without waiting for the next full state broadcast.
  useEffect(() => {

    const source = createEventStream(
      (ev) => {
        if (ev.type === "tick" && ev.price != null) {
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
                  price: ev.price,
                  tickTime: ev.timestamp || Date.now(),
                  receivedAt: Date.now(),
                  exchange: ev.exchange ?? existing?.exchange,
                  token,
                },
              },
            };
          });
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
        types: ["tick", "candle_close", "candle_update", "strategy", "contract_change", "connection_status"],
        onSnapshot: (snap) => {
          if (snap?.state) setState(snap.state);
        },
      }
    );


    return () => {

      source.close();

    };

  }, []);


  // Clock (1s)

  useEffect(() => {

    const id = setInterval(

      () => setNowMs(Date.now()),

      1000

    );

    return () => clearInterval(id);

  }, []);

  // Notifications — BUY/SELL for watchlist scripts (in-app + browser push)

  const [notifications, setNotifications] =
    useState<
      Array<{
        id: string;
        exch: string;
        token: string;
        tsym: string;
        signal: string;
        price: number | null;
        time: number;
        read: boolean;
      }>
    >(() => {
      try {
        return JSON.parse(
          localStorage.getItem(
            "bullionai_notifications"
          ) || "[]"
        );
      } catch {
        return [];
      }
    });

  const [showNotifPanel, setShowNotifPanel] =
    useState(false);

  const [toast, setToast] = useState<{
    id: string;
    signal: string;
    tsym: string;
    price: number | null;
  } | null>(null);

  const prevSignalsRef = useRef<
    Map<string, string>
  >(new Map());

  /* Desktop (browser) notification permission state */
  const [notifyPermission, setNotifyPermission] =
    useState<NotificationPermission | "unsupported">(() => {
      if (typeof window === "undefined" || !("Notification" in window)) {
        return "unsupported";
      }
      return Notification.permission;
    });

  const notifyAvailable =
    notifyPermission !== "unsupported";
  const desktopEnabled =
    notifyPermission === "granted";

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setNotifyPermission("unsupported");
      return;
    }
    const sync = () =>
      setNotifyPermission(Notification.permission);
    sync();
    document.addEventListener("visibilitychange", sync);
    window.addEventListener("focus", sync);
    return () => {
      document.removeEventListener("visibilitychange", sync);
      window.removeEventListener("focus", sync);
    };
  }, []);

  const requestDesktopNotifications = useCallback(async () => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      alert("Desktop notifications are not supported by this browser.");
      return;
    }
    try {
      let perm = Notification.permission;
      if (perm === "default") {
        // Must be called from a user gesture to be allowed.
        perm = await Notification.requestPermission();
      } else if (perm === "denied") {
        setNotifyPermission("denied");
        setToast({
          id: `denied:${Date.now()}`,
          signal: "DENIED",
          tsym: "Desktop notifications blocked",
          price: null,
        });
        setTimeout(() => setToast(null), 6000);
        return;
      }
      setNotifyPermission(perm);
      if (perm === "granted") {
        // Send a test notification so the user knows it's live.
        try {
          new Notification("BullionAI desktop alerts ON", {
            body: "You'll now get BUY/SELL notifications for your watchlist scripts.",
            icon: "/vite.svg",
          });
        } catch {}
      }
    } catch {}
  }, []);

  useEffect(() => {
    localStorage.setItem(
      "bullionai_notifications",
      JSON.stringify(
        notifications.slice(0, 50)
      )
    );
  }, [notifications]);

  useEffect(() => {
    if (!authUser) return;
    if (
      typeof window === "undefined" ||
      !("Notification" in window)
    )
      return;
    // Permission is requested from a user gesture (watchlist add or the
    // "Enable desktop alerts" button) — see requestDesktopNotifications.
  }, [authUser]);

  // Poll strategy for each watchlist script and notify on signal flip
  useEffect(() => {
    if (
      filteredCustomSyms.length === 0
    )
      return;

    let cancelled = false;

    async function checkSignals() {
      for (const sym of filteredCustomSyms) {
        const key = `${sym.exch}:${sym.token}`;
        // Use the timeframe the user is currently viewing so watchlist
        // alerts match the chart/panel. (MCX uses the fixed-target
        // strategy on 15m and the trailing strategy on other timeframes.)
        const tfForSym = selectedTimeframe;
        try {
          const res =
            await fetchStrategy(
              tfForSym,
              undefined,
              sym
            );
          if (cancelled) return;
          const sig = String(
            res.strategy?.signal || "NONE"
          )
            .trim()
            .toUpperCase();
          const prev =
            prevSignalsRef.current.get(
              key
            );

          if (
            prev === undefined
          ) {
            // Baseline — don't notify on first fetch
            if (
              sig === "BUY" ||
              sig === "SELL"
            ) {
              prevSignalsRef.current.set(
                key,
                sig
              );
            } else {
              prevSignalsRef.current.set(
                key,
                sig
              );
            }
            continue;
          }

          if (
            sig !== prev &&
            (sig === "BUY" ||
              sig === "SELL")
          ) {
            const price =
              res.strategy?.entryPrice ??
              null;
            const notif = {
              id: `${key}:${Date.now()}`,
              exch: sym.exch,
              token: sym.token,
              tsym: sym.tsym,
              signal: sig,
              price,
              time: Date.now(),
              read: false,
            };
            setNotifications(prevN => [
              notif,
              ...prevN,
            ].slice(0, 50));
            setToast({
              id: notif.id,
              signal: sig,
              tsym: sym.tsym,
              price,
            });
            setTimeout(
              () => setToast(null),
              4000
            );
            // Desktop push — only when permission is granted.
            if (
              typeof window !== "undefined" &&
              "Notification" in window &&
              Notification.permission === "granted"
            ) {
              try {
                const str = res.strategy as any;
                const parts: string[] = [`${sym.exch} ${sym.tsym}`];
                if (price != null) parts.push(`Entry ${price}`);
                if (str?.target1 != null) parts.push(`T1 ${str.target1}`);
                if (str?.target2 != null) parts.push(`T2 ${str.target2}`);
                new Notification(`BullionAI ${sig} — ${sym.tsym}`, {
                  body: parts.join(" · "),
                  icon: "/vite.svg",
                  tag: `bullionai:${sym.exch}:${sym.token}`,
                });
              } catch {}
            }
          }
          prevSignalsRef.current.set(
            key,
            sig
          );
        } catch {}
      }
    }

    checkSignals();
    const id = setInterval(
      checkSignals,
      30_000
    );
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [
    filteredCustomSyms,
    selectedTimeframe,
  ]);


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

  const isMCXSelected =
    String(
      selectedSymbol?.exch || ""
    )
      .trim()
      .toUpperCase() === "MCX";

  /* Which info-panel layout: backend reports it via strategy.panel.
     Fallback to the MCX+15m rule when the panel field is absent. */
  const usesFixedTargets =
    (viewStrategy as any)?.panel === "fixed-target" ||
    ((viewStrategy as any)?.panel == null &&
      isMCXSelected &&
      selectedTimeframe === "15m");


  /* Last 5 signals, newest first —
     straight from the Pine engine's
     own plotshape() emissions. */

  const recentSignals =
    useMemo(() => {

      const history =
        strategy?.signalHistory ?? [];

      return history
        .slice(-5)
        .reverse();

    }, [strategy]);


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
            <div className="page-glow flex min-h-screen flex-col text-slate-900 lg:h-screen lg:overflow-hidden">

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


          {/* Notifications bell — filtered by user segments */}
          <div className="relative">
            <button
              type="button"
              onClick={() =>
                setShowNotifPanel(v => !v)
              }
              className={`relative flex h-8 w-8 items-center justify-center rounded-full border transition ${
                desktopEnabled
                  ? "border-emerald-200 bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
                  : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
              }`}
              title={
                desktopEnabled
                  ? "Desktop notifications ON"
                  : notifyAvailable
                    ? "Desktop notifications off"
                    : "Notifications not supported"
              }
              aria-label={`Notifications, desktop alerts ${
                desktopEnabled ? "on" : "off"
              }`}
            >
              {desktopEnabled ? (
                <BellRing className="h-4 w-4" />
              ) : notifyAvailable ? (
                <Bell className="h-4 w-4" />
              ) : (
                <BellOff className="h-4 w-4" />
              )}
              {notifications.filter(
                n => !n.read
              ).length > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white">
                  {
                    notifications.filter(
                      n => !n.read
                    ).length
                  }
                </span>
              )}
              {!desktopEnabled &&
                notifyAvailable &&
                notifications.filter(n => !n.read).length > 0 && (
                  <span className="absolute -bottom-1 -right-1 flex h-3 w-3 items-center justify-center rounded-full bg-slate-300">
                    <BellOff className="h-2 w-2 text-slate-600" />
                  </span>
                )}
            </button>
            {showNotifPanel && (
              <div className="absolute right-0 top-9 z-50 max-h-80 w-80 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_20px_60px_-16px_rgba(15,23,42,0.3)]">
                <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                    Notifications
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() =>
                        setNotifications(prev =>
                          prev.map(n => ({
                            ...n,
                            read: true,
                          }))
                        )
                      }
                      className="rounded-full px-2 py-1 text-[10px] font-semibold text-blue-600 hover:bg-blue-50"
                    >
                      Mark read
                    </button>
                    <button
                      onClick={() =>
                        setShowNotifPanel(
                          false
                        )
                      }
                      className="rounded-full p-1 text-slate-400 hover:bg-slate-100"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Desktop notification toggle */}
                {notifyAvailable && (
                  <div className="flex items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/70 px-3 py-2.5">
                    <div className="min-w-0">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        Desktop alerts
                      </div>
                      <div className="truncate text-[10px] text-slate-400">
                        {desktopEnabled
                          ? "BUY/SELL alerts reach your desktop"
                          : notifyPermission === "denied"
                            ? "Blocked in browser settings — unblock to enable"
                            : "Get signal alerts as desktop notifications"}
                      </div>
                    </div>
                    {desktopEnabled ? (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700 ring-1 ring-emerald-200">
                        <BellRing className="h-3 w-3" /> ON
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={requestDesktopNotifications}
                        className="shrink-0 rounded-full bg-accent px-3 py-1.5 text-[10px] font-bold text-white transition hover:bg-accent-dark"
                      >
                        Enable
                      </button>
                    )}
                  </div>
                )}

                <div className="max-h-64 overflow-y-auto">
                  {notifications.length ===
                    0 && (
                    <div className="px-4 py-8 text-center text-[11px] text-slate-400">
                      No signals yet. Add
                      scripts to your watchlist.
                    </div>
                  )}
                  {notifications.map(n => (
                    <div
                      key={n.id}
                      className={[
                        "flex items-center gap-2 border-b border-slate-50 px-3 py-2 last:border-0",
                        !n.read
                          ? "bg-blue-50/60"
                          : "",
                      ].join(" ")}
                    >
                      <span
                        className={[
                          "flex h-6 w-10 shrink-0 items-center justify-center rounded-md text-[10px] font-black",
                          n.signal === "BUY"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-rose-100 text-rose-700",
                        ].join(" ")}
                      >
                        {n.signal}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[11px] font-semibold text-slate-800">
                          {n.tsym} · {n.exch}
                        </span>
                        <span className="block text-[10px] text-slate-400">
                          {n.price != null
                            ? fmt(n.price)
                            : ""}{" "}
                          ·{" "}
                          {new Date(
                            n.time
                          ).toLocaleTimeString(
                            "en-IN",
                            {
                              hour: "2-digit",
                              minute: "2-digit",
                            }
                          )}
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

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

      {/* Toast for BUY/SELL notifications */}
      {toast && (
        <div className="pointer-events-none fixed right-4 top-20 z-[100] flex max-w-sm items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-[0_20px_60px_-16px_rgba(15,23,42,0.3)]">
          <span
            className={[
              "flex h-8 w-12 shrink-0 items-center justify-center rounded-lg text-[11px] font-black",
              toast.signal === "BUY"
                ? "bg-emerald-100 text-emerald-700"
                : toast.signal === "SELL"
                  ? "bg-rose-100 text-rose-700"
                  : "bg-slate-100 text-slate-600",
            ].join(" ")}
          >
            {toast.signal === "BUY" || toast.signal === "SELL" ? (
              toast.signal
            ) : (
              <BellOff className="h-4 w-4" />
            )}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[12px] font-bold text-slate-800">
              {toast.tsym}
            </span>
            <span className="block text-[11px] text-slate-500">
              {toast.signal === "BLOCKED"
                ? "Notifications are blocked in your browser. Enable them to get watchlist alerts."
                : toast.signal === "DENIED"
                  ? "Enable notifications in browser settings to receive alerts."
                  : `${toast.price != null ? fmt(toast.price) : ""} · Watchlist alert`}
            </span>
          </span>
          <button
            onClick={() => setToast(null)}
            className="pointer-events-auto rounded-full p-1 text-slate-400 hover:bg-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}


      {/* ================= LIVE TICKER ================= */}

      {(customTickerRows.length > 0 ||
        importantIndicesLive.length > 0) && (
        <div className="ticker-viewport z-10 hidden shrink-0 border-b border-slate-200/60 bg-white/80 py-1 lg:flex">

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
                      {fmt(row.price)}
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

      <main className="mx-auto flex w-full max-w-[1800px] flex-1 flex-col gap-3 p-3 pb-20 lg:min-h-0 lg:flex-row lg:gap-3 lg:p-3">

        {/* Mobile premium header (shown on Chart + Signals tabs) */}
        <div className={`-mt-1 lg:hidden ${mobileTab === "chart" || mobileTab === "signals" ? "block" : "hidden"}`}>
          <Card className="overflow-hidden border-0 bg-white/80 p-0">
            {/* Live symbol + price header */}
            <div className="px-3 pb-2 pt-2.5">
              {/* Tappable symbol selector */}
              <button
                onClick={() => setMobileSymbolOpen(true)}
                className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 transition hover:bg-slate-100"
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
              <div className="mt-2">
                <div className="flex items-baseline gap-2">
                  <span className="font-mono text-[26px] font-bold tabular-nums tracking-[-0.02em] text-slate-900">
                    {fmt(livePrice ?? dayStats?.close)}
                  </span>
                  <span className={`font-mono text-[13px] font-semibold tabular-nums ${(() => {
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
                  {filteredCustomSyms.map((sym, i) => {
                    const lp = (state as any)?.livePrices?.[sym.token]?.price ?? customLastCloses[`${sym.exch}:${sym.token}`] ?? null;
                    const pc = customPrevCloses[`${sym.exch}:${sym.token}`] ?? dayStats?.prevClose ?? null;
                    const chg = lp != null && pc != null ? lp - pc : null;
                    const pct = chg != null && pc ? (chg / pc) * 100 : null;
                    const up = (chg ?? 0) >= 0;
                    const isSel = selectedSymbol?.token === sym.token && selectedSymbol?.exch === sym.exch;
                    const palette = ["bg-amber-500", "bg-slate-500", "bg-slate-800", "bg-indigo-500", "bg-emerald-600"];
                    return (
                      <button
                        key={`${sym.exch}:${sym.token}`}
                        onClick={() => { setSelectedSymbol(sym); setMobileSymbolOpen(false); }}
                        className={`flex w-full items-center gap-3 px-4 py-3 text-left transition ${isSel ? "bg-slate-50" : "active:bg-slate-50"}`}
                      >
                        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[13px] font-bold text-white ${palette[i % palette.length]}`}>
                          {(sym.label ?? sym.tsym).charAt(0)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[15px] font-semibold text-slate-900">{sym.label ?? sym.tsym}</span>
                          <span className="block truncate text-[11px] text-slate-400">{sym.exch} · {sym.token}</span>
                        </span>
                        <span className="text-right">
                          <span className="block font-mono text-[14px] font-bold tabular-nums text-slate-900">{fmt(lp)}</span>
                          <span className={`block font-mono text-[11px] tabular-nums ${up ? "text-emerald-600" : "text-rose-600"}`}>
                            {chg != null ? `${chg >= 0 ? "+" : ""}${fmt(chg)}` : "—"}{" "}
                            {pct != null ? `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%` : ""}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============ LEFT: CHART ============ */}

                <aside className={`flex w-full shrink-0 flex-col gap-3 lg:w-[300px] lg:min-h-0 order-3 lg:order-1 ${mobileTab === "signals" ? "flex" : "hidden"} lg:flex`}>
          {/* BULLIONAI STRATEGY */}

          <Card className="shrink-0">

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


          {/* RECENT SIGNALS */}

          <Card className="shrink-0">

            <CardTitle

              right={

                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-semibold text-slate-500">
                  last 5
                </span>

              }
            >

              Recent Signals

            </CardTitle>


            <div className="p-1">

              {recentSignals.length ===
                0 && (
                <div className="px-3 py-4 text-center text-[11px] text-slate-400">

                  No signals yet.

                </div>
              )}


              {recentSignals.map(ev => {

                const buy =
                  ev.signal === "BUY";

                const pl = (ev as any).realizedPL ?? null;

                return (

                  <div
                    key={`${ev.index}-${ev.signal}`}

                    className="flex items-center gap-2 rounded-xl px-2 py-1.5 transition hover:bg-slate-50"
                  >

                    <span
                      className={[
                        "flex h-5 w-[44px] shrink-0 items-center justify-center rounded-md text-[9px] font-black tracking-wider",

                        buy
                          ? "bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200"

                          : "bg-rose-50 text-rose-600 ring-1 ring-rose-200",
                      ].join(" ")}
                    >

                      {ev.signal}

                    </span>


                    <span className="min-w-0 flex-1 leading-tight">

                      <span
                        className={[
                          "block font-mono text-[11px] font-bold tabular-nums",

                          buy ? "text-emerald-600" : "text-rose-600",
                        ].join(" ")}
                      >

                        {fmt(ev.price)}

                      </span>

                      <span className="block truncate text-[9px] font-medium text-slate-400">

                        {ev.time
                          ? formatISTShortDateTime(
                              ev.time
                            )
                          : "—"}

                      </span>

                    </span>

                    <span className="text-right leading-tight">
                      <span
                        className={[
                          "block font-mono text-[10px] font-bold tabular-nums",
                          pl == null
                            ? "text-slate-400"
                            : pl >= 0
                              ? "text-emerald-600"
                              : "text-rose-600",
                        ].join(" ")}
                      >
                        {pl != null ? fmtSigned(pl) : "—"}
                      </span>
                      <span className="block text-[8px] font-medium uppercase tracking-wider text-slate-400">
                        P/L
                      </span>
                    </span>

                  </div>
                );

              })}

            </div>

          </Card>

        </aside>

<section className={`flex min-w-0 flex-col gap-3 lg:min-h-0 lg:flex-1 order-2 lg:order-2 max-lg:h-[calc(100dvh-200px)] ${mobileTab === "chart" ? "flex" : "hidden"} lg:flex`}>

          <Card className="flex flex-1 flex-col overflow-hidden min-h-[320px] lg:h-auto">

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
                        "min-w-[38px] rounded-md px-2 py-1 text-[11px] transition-colors",

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

        <aside className={`flex w-full shrink-0 flex-col gap-2 lg:w-[360px] lg:min-h-0 order-1 lg:order-3 ${mobileTab === "watchlist" ? "flex" : "hidden"} lg:flex`}>

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

          <Card className="shrink-0 overflow-hidden">

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

            {/* MOBILE premium TradingView-style list */}
            <div className="divide-y divide-slate-100 lg:hidden">
              {filteredCustomSyms.length === 0 && (
                <div className="px-4 py-10 text-center text-[12px] text-slate-400">
                  No symbols yet. Add scripts using the search box above.
                </div>
              )}
              {filteredCustomSyms.map((sym, i) => {
                const lprow =
                  (state as any)?.livePrices?.[sym.token]?.price ??
                  customLastCloses[`${sym.exch}:${sym.token}`] ??
                  null;
                const pcrow =
                  customPrevCloses[`${sym.exch}:${sym.token}`] ??
                  dayStats?.prevClose ??
                  null;
                const chgrow = lprow != null && pcrow != null ? lprow - pcrow : null;
                const pctrow = chgrow != null && pcrow ? (chgrow / pcrow) * 100 : null;
                const uprow = (chgrow ?? 0) >= 0;
                const isSel = selectedSymbol?.token === sym.token && selectedSymbol?.exch === sym.exch;
                const palette = ["bg-amber-500", "bg-slate-500", "bg-slate-800", "bg-indigo-500", "bg-emerald-600"];
                return (
                  <div
                    key={sym.exch + sym.token}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedSymbol(sym)}
                    className={`flex items-center gap-3 px-4 py-3 transition ${isSel ? "bg-slate-50" : "active:bg-slate-50"}`}
                  >
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[13px] font-bold text-white ${palette[i % palette.length]}`}>
                      {(sym.label ?? sym.tsym).charAt(0)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1 text-[15px] font-semibold text-slate-900">
                        <span className="truncate">{sym.label ?? sym.tsym}</span>
                      </span>
                      <span className="block truncate text-[12px] text-slate-400">
                        {sym.exch} · {String(sym.token)}
                      </span>
                    </span>
                    <span className="text-right">
                      <span className={`block font-mono text-[15px] font-bold tabular-nums ${uprow ? "text-slate-900" : "text-slate-900"}`}>
                        {fmt(lprow)}
                      </span>
                      <span className={`block font-mono text-[12px] font-medium tabular-nums ${uprow ? "text-emerald-600" : "text-rose-600"}`}>
                        {chgrow != null ? `${chgrow >= 0 ? "+" : ""}${fmt(chgrow)}` : "—"}{" "}
                        {pctrow != null ? `${pctrow >= 0 ? "+" : ""}${pctrow.toFixed(2)}%` : ""}
                      </span>
                    </span>
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

            {/* DESKTOP table (unchanged) */}
            <div className="hidden lg:block">
              <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/70 px-2.5 py-2 text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-400">
              <span className="w-6 shrink-0" aria-hidden />
              <span className="flex-1">Symbol</span>
              <span className="w-[62px] text-right">LTP</span>
              <span className="w-[48px] text-right">Chg</span>
              <span className="w-[48px] text-right">Chg%</span>
              <span className="hidden w-7 shrink-0 sm:block" aria-hidden />
              </div>

            <div className="p-1">

              {filteredCustomSyms.length ===
                0 && (
                <div className="px-3 py-6 text-center text-[11px] leading-relaxed text-slate-400">

                  {customSyms.length === 0
                    ? "No scripts added yet."
                    : "No scripts match your segments."}

                  <br />

                  Use the search box above to
                  add one.

                </div>
              )}

                          {/* CUSTOM SYMBOL ROWS */}

              {filteredCustomSyms.map(sym => {
                const lp =
                  state &&
                  (state as any)?.livePrices ?
                      (state as any).livePrices[sym.token] ?? null :
                      null;
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
                const up = (change ?? 0) >= 0;
                const active =
                  selectedSymbol?.token ===
                    sym.token &&
                  selectedSymbol?.exch ===
                    sym.exch;

                return (
                  <div
                    key={sym.exch + sym.token}
                    role="button"
                    tabIndex={0}
                    onClick={() =>
                      setSelectedSymbol(sym)
                    }
                    className={[
                      "group flex w-full cursor-pointer items-center gap-2 rounded-xl px-2.5 py-2 text-left transition",
                      active
                        ? "bg-blue-50 ring-1 ring-blue-200"
                        : "hover:bg-slate-50",
                    ].join(" ")}
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-600">
                      {sym.tsym[0]}
                    </span>

                    <span className="min-w-0 flex-1 leading-tight">
                      <span className="block truncate text-[12px] font-semibold text-slate-800">
                        {sym.label ?? sym.tsym}
                      </span>
                      <span className="block text-[9px] font-medium uppercase tracking-wider text-slate-400">
                        {sym.exch} · {sym.token}
                      </span>
                    </span>

                    <span
                      className={[
                        "w-[62px] text-right font-mono text-[12px] font-semibold tabular-nums",

                        up ? UP : DOWN,
                      ].join(" ")}
                    >
                      {fmt(price)}
                    </span>

                    <span
                      className={[
                        "w-[48px] text-right font-mono text-[10px] font-medium tabular-nums",

                        up ? UP : DOWN,
                      ].join(" ")}
                    >
                      {change != null
                        ? (change >= 0 ? "+" : "") + fmt(change)
                        : "—"}
                    </span>

                    <span
                      className={[
                        "w-[48px] text-right font-mono text-[10px] font-medium tabular-nums",
                        up ? UP : DOWN,
                      ].join(" ")}
                    >
                      {changePct != null
                        ? (up ? "+" : "") + changePct.toFixed(2) + "%"
                        : "—"}
                    </span>

                    <button
                      title="Remove"
                      onClick={e => {
                        e.stopPropagation();
                        removeCustomSym(sym);
                      }}
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-rose-50 hover:text-rose-500 sm:opacity-0 sm:group-hover:opacity-100"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}
</div>
            </div>

          </Card>


          {/* QUOTE DETAILS */}

          <Card className="shrink-0 p-3.5">

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
                  "font-mono text-[27px] font-bold leading-none tracking-[-0.03em] tabular-nums",

                  priceFlash === "up"
                    ? "price-flash-up text-emerald-600"

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

        {/* Mobile bottom tab bar (TradingView-style compact; hidden on desktop) */}
        <nav
          className="fixed bottom-0 left-0 right-0 z-30 border-t border-slate-200/80 bg-white/95 backdrop-blur-xl lg:hidden"
          aria-label="Mobile terminal tabs"
        >
          <div className="mx-auto flex max-w-md items-stretch justify-around py-1">
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
                className={[
                  "flex min-w-[70px] flex-1 flex-col items-center justify-center gap-0.5 pb-[max(0.45rem,env(safe-area-inset-bottom))] pt-1.5 text-[10px] font-semibold transition-colors",
                  active
                    ? "text-accent"
                    : "text-slate-400 hover:text-slate-600",
                ].join(" ")}
              >
                <span className={`h-5 w-5 ${active ? "text-accent" : ""}`}>
                  <Icon className={`h-5 w-5 ${active ? "fill-accent/15" : ""}`} strokeWidth={active ? 2.4 : 2} />
                </span>
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
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}


export default App;
