import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  BarChart3,
  Circle,
  Clock,
  ShieldCheck,
  Trash2,
} from "lucide-react";

import {
  BullionChart,
} from "./components/chart/BullionChart";
import { AuthScreen } from "./components/AuthScreen";
import { InstrumentPicker, type SelectedSymbol } from "./components/SymbolSearch";
import { HomePage, TrialExpired, TrialBadge } from "./components/HomePage";
import { clearAuthSession, getAuthSession, type AuthUser } from "./lib/auth";

import "./App.css";

import {
  createStateStream,
  subscribeSymbol,
  fetchCandles,
  fetchStrategy,
  fetchWatchlist,
  type BullionState,
  type Candle,
  type DayStats,
  type Instrument,
  type StrategyState,
  type WatchlistRow,
} from "./lib/bullionai-api";

import {
  formatISTShortDateTime,
  formatISTTime,
  getISTDate,
} from "./lib/ist-time";

/* =============================================================
   CONSTANTS
   ============================================================= */

const INSTRUMENTS = [
  {
    key: "gold" as Instrument,
    label: "Gold",
    tvName: "GOLD1!",
    fullName: "Gold Futures",
    sub: "GOLD05OCT26 · MCX",
    overlay: "GOLD · MCX",
    unit: "INR / DAG (10g)",
    element: "Au",
  },
  {
    key: "silver" as Instrument,
    label: "Silver",
    tvName: "SILVER1!",
    fullName: "Silver Futures",
    sub: "SILVER04SEP26 · MCX",
    overlay: "SILVER · MCX",
    unit: "INR / KG",
    element: "Ag",
  },
];

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

function MetalIcon({
  instrument,
  size = "md",
}: {
  instrument: Instrument;
  size?: "sm" | "md";
}) {

  const isGold =
    instrument === "gold";

  return (
    <span
      className={[
        "flex shrink-0 items-center justify-center rounded-full font-bold ring-1",

        size === "sm"
          ? "h-6 w-6 text-[10px]"

          : "h-9 w-9 text-[12px]",

        isGold

          ? "icon-gold ring-amber-200/70"

          : "icon-silver ring-slate-300/80",
      ].join(" ")}
    >
      {isGold ? "Au" : "Ag"}
    </span>
  );
}


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
    selectedInstrument,
    setSelectedInstrument,
  ] = useState<Instrument>("gold");

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
    watchlist,
    setWatchlist,
  ] = useState<WatchlistRow[]>(
    []
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

  useEffect(() => {
    localStorage.setItem(
      "bullionai_custom_symbols",
      JSON.stringify(customSyms)
    );
  }, [customSyms]);

  /* Stream live prices for every added script */

  useEffect(() => {
    customSyms.forEach(sym => {
      subscribeSymbol(sym);
    });
  }, [customSyms]);

  useEffect(() => {
    if (!selectedSymbol) return;

    subscribeSymbol(selectedSymbol);
  }, [selectedSymbol]);

  const [customLastCloses, setCustomLastCloses] = useState<
    Record<string, number>
  >({});

  const [customPrevCloses, setCustomPrevCloses] = useState<
    Record<string, number | null>
  >({});

  useEffect(() => {
    customSyms.forEach(async sym => {
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
  }, [customSyms]);

  // Keep ref in sync synchronously (before effects run)
  latestSelRef.current = {
    tf: selectedTimeframe,
    inst: selectedInstrument,
    sym: selectedSymbol ? `${selectedSymbol.exch}:${selectedSymbol.token}` : "",
  };

  function makeLoadGuard() {
    const snap = `${latestSelRef.current.tf}|${latestSelRef.current.inst}|${latestSelRef.current.sym}`;
    return () =>
      `${latestSelRef.current.tf}|${latestSelRef.current.inst}|${latestSelRef.current.sym}` ===
      snap;
  }

  function addCustomSym(sym: SelectedSymbol) {
    setCustomSyms(prev =>
      prev.some(
        x =>
          x.exch === sym.exch &&
          x.token === sym.token
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

  const [landingView, setLandingView] =
    useState<"home" | "signin" | "register">(() => {
      const params =
        new URLSearchParams(window.location.search);
      const hash =
        window.location.hash;
      return params.get("trial") === "1" ||
        hash === "#trial" ||
        hash === "#start-trial"
        ? "register"
        : "home";
    });

  /* -------------------------
     DATA EFFECTS
     ------------------------- */

  // Candles + day stats (45s poll)

  useEffect(() => {

    let cancelled = false;


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
            selectedInstrument,
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


    const poll = setInterval(

      () => load(false),

      45_000

    );


    return () => {

      cancelled = true;

      clearInterval(poll);

    };

  }, [
    selectedTimeframe,
    selectedInstrument,
    selectedSymbol,
  ]);


  // Pine strategy per view (30s poll — backend caches)

  useEffect(() => {

    let cancelled = false;


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
            selectedInstrument,
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
    selectedInstrument,
    selectedSymbol,
  ]);


  // Watchlist (30s poll)

  useEffect(() => {

    let cancelled = false;


    async function load() {

      try {

        const rows =
          await fetchWatchlist();

        if (!cancelled) {

          setWatchlist(rows);

        }

      } catch {
        /* keep last */
      }

    }


    load();


    const poll = setInterval(
      load,
      30_000
    );


    return () => {

      cancelled = true;

      clearInterval(poll);

    };

  }, []);


  // SSE stream (live ticks + state)

  useEffect(() => {

    const source = createStateStream(s => {
      setState(s);
    });


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


  /* -------------------------
     DERIVED
     ------------------------- */

  const activeInstrument =

    INSTRUMENTS.find(
      i => i.key === selectedInstrument
    ) ?? INSTRUMENTS[0];


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


  const liveRow =

    state?.livePrices?.[
      selectedInstrument
    ] ?? null;


  const rawLivePrice = liveRow?.price ?? null;

  const liveTokenPrice =
    state && selectedSymbol
      ? ((state as any)?.livePrices?.[selectedSymbol.token]?.price ?? null)
      : null;

  const livePrice = selectedSymbol
    ? (liveTokenPrice ??
      customLastCloses[`${selectedSymbol.exch}:${selectedSymbol.token}`] ??
      null)
    : rawLivePrice;


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

  const bestPL =
    !isTradeOpen

      ? (strategy?.bestPL ?? null)

      : entryPrice === null

        ? (strategy?.bestPL ?? null)

        : signal === "SELL"

          ? entryPrice -

            Math.min(

              strategy?.extremePrice ??
                Infinity,

              livePrice ?? Infinity

            )

          : Math.max(

              strategy?.extremePrice ??
                -Infinity,

              livePrice ?? -Infinity

            ) - entryPrice;


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


  /* Watchlist active row */

  /* Formatters — decimals only for instruments that trade with them */

  const currentTickSize =
    (selectedSymbol as any)?.tickSize ??
    (selectedInstrument === "gold" ||
    selectedInstrument === "silver"
      ? 1
      : null);

  const fmt = (
    v: number | null | undefined
  ) => {
    if (
      v == null ||
      !Number.isFinite(v)
    ) {
      return "—";
    }

    let decimals = 0;

    if (currentTickSize != null) {
      const s = String(currentTickSize);
      const dot = s.indexOf(".");
      decimals =
        dot >= 0 ? s.length - dot - 1 : 0;
    } else {
      decimals =
        Math.abs(v % 1) > 1e-9 ? 2 : 0;
    }

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

    let decimals = 0;

    if (currentTickSize != null) {
      const s = String(currentTickSize);
      const dot = s.indexOf(".");
      decimals =
        dot >= 0 ? s.length - dot - 1 : 0;
    } else {
      decimals =
        Math.abs(v % 1) > 1e-9 ? 2 : 0;
    }

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

  /* Watchlist rows fused with SSE live prices (no poll delay) */

  const watchlistLive =
    useMemo(() => {
      return watchlist.map(r => {
        const lp =
          state?.livePrices?.[r.instrument];
        if (!lp || lp.price == null) return r;
        const price = lp.price;
        const prev =
          r.prevClose ?? null;
        const change =
          prev != null ? price - prev : r.change;
        const changePct =
          prev != null && prev !== 0 && change != null
            ? (change / prev) * 100
            : r.changePct;
        return { ...r, price, change, changePct };
      });
    }, [watchlist, state]);

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
          tvName: idx.tvName,
          price: lp.price,
          change: (lp as any).change ?? null,
          changePct: (lp as any).changePercent ?? null,
        };
      })
      .filter(Boolean) as typeof watchlistLive;
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

  
  /* ================= AUTH / ACCESS GATES ================= */

  if (!authUser) {
    if (landingView === "home") {
      return (
        <HomePage
          onStartTrial={() => setLandingView("register")}
          onSignIn={() => setLandingView("signin")}
        />
      );
    }
    return (
      <AuthScreen
        key={landingView}
        initialMode={landingView === "register" ? "register" : "login"}
        onAuthed={u => { setAuthUser(u); setLandingView("home"); }}
      />
    );
  }

  if (authUser.hasAccess === false) {
    return <TrialExpired user={authUser} />;
  }

  /* -------------------------
     RENDER
     ------------------------- */

  return (

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


          <TrialBadge user={authUser} />

          <span className="hidden h-5 w-px bg-slate-200 md:block" />


          {/* ACCOUNT — login-ready slot */}

          <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white py-[3px] pl-1 pr-1.5"><span className="brand-gold-dot flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-extrabold text-white">{authUser?.email?.[0]?.toUpperCase() ?? "G"}</span><span className="hidden flex-col items-start leading-none sm:flex"><span className="text-[10px] font-semibold text-slate-700">{authUser?.name ?? "Trader"}</span><span className="max-w-[140px] truncate text-[8px] font-medium uppercase tracking-wider text-slate-400">{authUser?.email}</span></span><button type="button" title="Sign out" onClick={() => { clearAuthSession(); setAuthUser(null); }} className="rounded-full px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-slate-400 transition hover:bg-slate-100 hover:text-slate-600">Logout</button></div>

        </div>

      </header>


      {/* ================= LIVE TICKER ================= */}

      {(watchlistLive.length > 0 ||
        importantIndicesLive.length > 0) && (
        <div className="ticker-viewport z-10 shrink-0 border-b border-slate-200/60 bg-white/80 py-1">

          <div className="ticker-track">

            {[...[...watchlistLive, ...importantIndicesLive], ...[...watchlistLive, ...importantIndicesLive]].map(
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

      <main className="mx-auto flex w-full max-w-[1800px] flex-1 flex-col gap-3 p-3 lg:min-h-0 lg:flex-row lg:gap-3 lg:p-3">

        {/* ============ LEFT: CHART ============ */}

                <aside className="flex w-full shrink-0 flex-col gap-3 lg:w-[300px] lg:min-h-0 order-2 lg:order-1">
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


              {strategyError && (
                <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50/70 px-2.5 py-2 text-[10px] font-medium leading-4 text-amber-700">

                  {strategyError}

                </div>
              )}

            </div>

          </Card>

        </aside>

<section className="flex min-w-0 flex-col gap-3 lg:min-h-0 lg:flex-1 order-1 lg:order-2">

          <Card className="flex min-h-[420px] flex-1 flex-col overflow-hidden max-lg:h-[62vh]">

            {/* Chart canvas */}

            <div className="relative min-h-0 flex-1">

              {loadingCandles && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/75 backdrop-blur-sm">

                  <div className="text-center">

                    <div className="mx-auto h-7 w-7 animate-spin rounded-full border-2 border-slate-200 border-t-blue-600" />

                    <div className="mt-3 text-[11px] font-medium text-slate-400">

                      Loading{" "}
                      {selectedSymbol
                        ? selectedSymbol.tsym
                        : activeInstrument.label}{" "}
                      {selectedTimeframe}
                      …

                    </div>

                  </div>

                </div>
              )}


              {candleError && (
                <div className="absolute inset-0 z-10 flex items-center justify-center">

                  <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-center shadow-sm">

                    <div className="text-[12px] font-semibold text-red-700">

                      Unable to load candles

                    </div>

                    <div className="mt-1 text-[10px] text-red-500/80">
                      {candleError}
                    </div>

                  </div>

                </div>
              )}


              {!loadingCandles &&
                !candleError &&
                candles.length ===
                  0 && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center">

                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-6 py-5 text-center shadow-sm">

                      <BarChart3 className="mx-auto h-5 w-5 text-slate-300" />

                      <div className="mt-2 text-[12px] font-medium text-slate-500">

                        No data for{" "}
                        {selectedSymbol
                          ? selectedSymbol.tsym
                          : activeInstrument.label}{" "}
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
                    : activeInstrument.fullName
                }

                timeframeLabel={

                  selectedTimeframe
                }

                signals={

                  strategy?.signalHistory ??
                  null
                }


                timeframeSeconds={tfSec}

              />

            </div>


            {/* Bottom bar: intervals + countdown + clock */}

            <div className="flex shrink-0 items-center justify-between gap-2 border-t border-slate-100 px-3 py-1.5">

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

        <aside className="flex w-full shrink-0 flex-col gap-2 lg:w-[360px] lg:min-h-0 order-3">

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


            <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/70 px-2.5 py-2 text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-400">
              <span className="w-6 shrink-0" aria-hidden />
              <span className="flex-1">Symbol</span>
              <span className="w-[62px] text-right">LTP</span>
              <span className="w-[48px] text-right">Chg</span>
              <span className="w-[48px] text-right">Chg%</span>
              <span className="hidden w-7 shrink-0 sm:block" aria-hidden />
            </div>

            <div className="p-1">

              {watchlist.length ===
                0 && (
                <div className="px-3 py-4 text-center text-[11px] text-slate-400">

                  Loading quotes…

                </div>
              )}


              {watchlistLive.map(row => {

                const active =

                  !selectedSymbol &&
                  row.instrument ===
                  selectedInstrument;

                const up =

                  (row.change ?? 0) >=
                  0;


                return (
                  <button

                    key={row.instrument}

                    onClick={() => {
                        setSelectedInstrument(
                          row.instrument
                        );
                        setSelectedSymbol(null);
                      }}

                    className={[
                      "flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left transition",

                      active

                        ? "bg-blue-50 ring-1 ring-blue-200"

                        : "hover:bg-slate-50",
                    ].join(" ")}
                  >

                    <MetalIcon

                      instrument={
                        row.instrument
                      }

                      size="sm"
                    />


                    <span className="min-w-0 flex-1">

                      <span className="block truncate text-[12px] font-semibold text-slate-800">

                        {row.tvName}

                      </span>

                      <span className="block truncate text-[9px] font-medium text-slate-400">

                        {row.symbol}

                      </span>

                    </span>


                    <span
                      className={[
                        "w-[62px] text-right font-mono text-[12px] font-semibold tabular-nums",

                        up ? UP : DOWN,
                      ].join(" ")}
                    >
                      {fmt(row.price)}
                    </span>

                    <span
                      className={[
                        "w-[48px] text-right font-mono text-[10px] font-medium tabular-nums",

                        up ? UP : DOWN,
                      ].join(" ")}
                    >
                      {row.change != null
                        ? (row.change >= 0 ? "+" : "") + fmt(row.change)
                        : "—"}
                    </span>


                    <span

                      className={[
                        "w-[48px] text-right font-mono text-[10px] font-medium tabular-nums",

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

                    </span>

                    <span className="hidden w-7 shrink-0 sm:block" aria-hidden />

                  </button>
                );

              })}

                          {/* CUSTOM SYMBOL ROWS */}

              {customSyms.map(sym => {
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

          </Card>


          {/* QUOTE DETAILS */}

          <Card className="shrink-0 p-3.5">

            <div className="flex items-center gap-3">

              <MetalIcon

                instrument={
                  selectedInstrument
                }

              />


              <div className="min-w-0 leading-tight">

                <div className="text-[14px] font-bold tracking-tight text-slate-900">

                  {selectedSymbol ? selectedSymbol.tsym : activeInstrument.tvName}

                </div>

                <div className="truncate text-[11px] font-medium text-slate-500">

                  {selectedSymbol
                    ? `${selectedSymbol.exch} · ${selectedSymbol.tsym}`
                    : `${activeInstrument.fullName} · MCX`}

                </div>

                <div className="text-[10px] text-slate-400">

                  {selectedSymbol
                    ? `${selectedSymbol.exch} · ${selectedSymbol.token}`
                    : `Futures · ${activeInstrument.sub}`}

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
                  : activeInstrument.unit}

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

                    marketOpenIST

                      ? "fill-emerald-500 text-emerald-500"

                      : "fill-slate-300 text-slate-300",
                  ].join(" ")}
                />


                {marketOpenIST

                  ? "Market open"

                  : "Market closed"}

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

      </main>

    </div>
  );
}


export default App;
