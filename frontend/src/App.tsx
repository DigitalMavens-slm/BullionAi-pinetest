import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  ChevronDown,
  Circle,
  Clock,
  History,
  ShieldCheck,
  Wifi,
} from "lucide-react";

import {
  BullionChart,
} from "./components/chart/BullionChart";

import "./App.css";

import {
  createStateStream,
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

      <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">

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
    streamConnected,
    setStreamConnected,
  ] = useState(false);

  const [
    nowMs,
    setNowMs,
  ] = useState(Date.now());

  /* -------------------------
     DATA EFFECTS
     ------------------------- */

  // Candles + day stats (45s poll)

  useEffect(() => {

    let cancelled = false;


    async function load(
      initial: boolean
    ) {

      if (initial) {

        setLoadingCandles(
          true
        );

        setCandleError(null);

      }


      try {

        const result =
          await fetchCandles(
            selectedTimeframe,
            selectedInstrument
          );

        if (cancelled) return;

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

        if (cancelled) return;


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
  ]);


  // Pine strategy per view (30s poll — backend caches)

  useEffect(() => {

    let cancelled = false;


    async function load(
      initial: boolean
    ) {

      if (initial) {

        setViewStrategy(null);

        setStrategyLoading(true);

        setStrategyError(null);

      }


      try {

        const result =
          await fetchStrategy(
            selectedTimeframe,
            selectedInstrument
          );

        if (cancelled) return;


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

        if (cancelled) return;


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

    const source =
      createStateStream(

        s => {

          setState(s);

          setStreamConnected(true);

        },

        () => setStreamConnected(false)

      );


    return () => {

      source.close();

      setStreamConnected(false);

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


  const livePrice =

    liveRow?.price ?? null;


  const marketConnected =

    liveRow?.connected ??
    state?.market?.connected ??
    false;


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

  /* Formatters */

  const fmt = (
    v: number | null | undefined
  ) =>

    v == null ||
    !Number.isFinite(v)

      ? "—"

      : v.toLocaleString("en-IN", {
          maximumFractionDigits: 0,
        });


  const fmtSigned = (
    v: number | null
  ) =>

    v == null

      ? "—"

      : (v >= 0 ? "+" : "") +
        v.toLocaleString("en-IN", {
          maximumFractionDigits: 0,
        });


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


  /* -------------------------
     RENDER
     ------------------------- */

  return (

    <div className="page-glow flex min-h-screen flex-col text-slate-900 lg:h-screen lg:overflow-hidden">

      {/* ================= HEADER ================= */}

      <header className="relative flex h-14 shrink-0 items-center justify-between border-b border-slate-200/70 bg-white/90 px-4 backdrop-blur lg:px-5">

        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-amber-300/60 to-transparent" />

        <div className="flex items-center gap-3">

          <div className="brand-gold-dot flex h-8 w-8 items-center justify-center rounded-lg">

            <BarChart3 className="h-4 w-4 text-white" />

          </div>


          <div className="leading-tight">

            <div className="text-[14px] font-extrabold tracking-tight text-slate-900">

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


        <div className="flex items-center gap-2">

          <span

            className={[
              "hidden items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold sm:flex",

              marketConnected

                ? "border-emerald-200 bg-emerald-50 text-emerald-600"

                : "border-amber-200 bg-amber-50 text-amber-600",
            ].join(" ")}
          >

            <Circle

              className={[
                "h-1.5 w-1.5",

                marketConnected

                  ? "fill-emerald-500 text-emerald-500"

                  : "fill-amber-500 text-amber-500",
              ].join(" ")}
            />


            {marketConnected

              ? "FEED LIVE"

              : "FEED WAITING"}

          </span>


          <span className="hidden items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-semibold text-slate-500 md:flex">

            <Wifi

              className={[
                "h-3 w-3",

                streamConnected

                  ? "text-emerald-500"

                  : "text-amber-500",
              ].join(" ")}
            />


            {streamConnected
              ? "SSE"
              : "SSE OFF"}

          </span>


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


          <span className="hidden h-5 w-px bg-slate-200 md:block" />


          {/* ACCOUNT — login-ready slot */}

          <button
            type="button"
            title="Sign in"
            className="flex items-center gap-2 rounded-full border border-slate-200 bg-white py-[3px] pl-1 pr-2 transition hover:border-slate-300 hover:shadow-sm"
          >

            <span className="brand-gold-dot flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-extrabold text-white">

              G

            </span>

            <span className="hidden flex-col items-start leading-none sm:flex">

              <span className="text-[10px] font-semibold text-slate-700">

                Guest

              </span>

              <span className="text-[8px] font-medium uppercase tracking-wider text-slate-400">

                Sign in

              </span>

            </span>

            <ChevronDown className="h-3 w-3 text-slate-400" />

          </button>

        </div>

      </header>


      {/* ================= LIVE TICKER ================= */}

      {watchlist.length > 0 && (
        <div className="ticker-viewport z-10 shrink-0 border-b border-slate-200/60 bg-white/80 py-1">

          <div className="ticker-track">

            {[...watchlist, ...watchlist].map(
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

        <section className="flex min-w-0 flex-col gap-3 lg:min-h-0 lg:flex-1">

          <Card className="flex min-h-[420px] flex-1 flex-col overflow-hidden max-lg:h-[62vh]">

            {/* Chart canvas */}

            <div className="relative min-h-0 flex-1">

              {loadingCandles && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/75 backdrop-blur-sm">

                  <div className="text-center">

                    <div className="mx-auto h-7 w-7 animate-spin rounded-full border-2 border-slate-200 border-t-blue-600" />

                    <div className="mt-3 text-[11px] font-medium text-slate-400">

                      Loading{" "}
                      {activeInstrument.label}{" "}
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
                        {activeInstrument.label}{" "}
                        {selectedTimeframe} yet

                      </div>

                    </div>

                  </div>
                )}


              <BullionChart

                candles={candles}

                entryPrice={null}

                entryTime={

                  strategy?.entryTime ??
                  null
                }

                exitTime={

                  typeof strategy?.exitTime ===
                  "number"

                    ? strategy.exitTime

                    : null
                }

                signal={signal}

                livePrice={livePrice}

                label={

                  activeInstrument.fullName
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

        <aside className="flex w-full shrink-0 flex-col gap-2 lg:w-[320px] lg:min-h-0">

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


            <div className="p-1">

              {watchlist.length ===
                0 && (
                <div className="px-3 py-4 text-center text-[11px] text-slate-400">

                  Loading quotes…

                </div>
              )}


              {watchlist.map(row => {

                const active =

                  row.instrument ===
                  selectedInstrument;

                const up =

                  (row.change ?? 0) >=
                  0;


                return (
                  <button

                    key={row.instrument}

                    onClick={() =>
                      setSelectedInstrument(
                        row.instrument
                      )
                    }

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
                        "w-[76px] text-right font-mono text-[12px] font-semibold tabular-nums",

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

                      {row.changePct !=
                      null

                        ? (up ? "+" : "") +

                          row.changePct.toFixed(
                            2
                          ) +

                          "%"

                        : "—"}

                    </span>

                  </button>
                );

              })}

            </div>

          </Card>


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


            <div className="p-2">

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
                      "text-[15px] font-extrabold tracking-tight",

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

              <table className="mt-1.5 w-full border-collapse text-[11px]">

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
                      <td className="py-[5px] pl-1 font-medium text-slate-500">{label}</td>
                      <td className="py-[5px] pr-1 text-right">
                        <span className={`font-mono font-semibold tabular-nums ${tone}`}>
                          {value}
                        </span>
                      </td>
                    </tr>
                  ))}

                  <tr className="border-t border-dashed border-slate-200">
                      <td className="py-[5px] pl-1 font-medium text-slate-500">Entry time</td>
                      <td className="max-w-[150px] truncate py-[5px] pr-1 text-right font-mono text-[10px] tabular-nums text-slate-700">
                        {entryTimeLabel ?? "—"}
                      </td>
                  </tr>
                  <tr>
                      <td className="py-[5px] pl-1 font-medium text-slate-500">Exit time</td>
                      <td className="max-w-[150px] truncate py-[5px] pr-1 text-right font-mono text-[10px] tabular-nums text-slate-700">
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

                  {activeInstrument.tvName}

                </div>

                <div className="truncate text-[11px] font-medium text-slate-500">

                  {activeInstrument.fullName}{" "}
                  · MCX

                </div>

                <div className="text-[10px] text-slate-400">

                  Futures ·{" "}
                  {activeInstrument.sub}

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

                {activeInstrument.unit}

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

                  low={dayStats.low}

                  high={dayStats.high}

                  value={

                    livePrice ??
                    dayStats.close
                  }

                />


                <div className="mt-2 grid grid-cols-4 gap-1 text-center">

                  {[

                    ["O", dayStats.open],

                    ["H", dayStats.high],

                    ["L", dayStats.low],

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


          {/* RECENT SIGNALS */}

          {(strategy?.signalHistory?.length ??
            0) > 0 && (
            <Card className="flex min-h-[180px] flex-1 flex-col overflow-hidden">

              <CardTitle
                right={
                  <span className="flex items-center gap-1 text-[10px] font-medium text-slate-400">
                    <History className="h-3.5 w-3.5" />
                    {selectedTimeframe}
                  </span>
                }
              >
                Recent signals
              </CardTitle>

              <div className="slim-scroll min-h-0 flex-1 overflow-y-auto p-2">
                {[
                  ...(strategy?.signalHistory ?? []),
                ]
                  .slice(-5)
                  .reverse()
                  .map((ev, idx) => {
                    const isBuy =
                      ev.signal === "BUY";

                    const latest =
                      idx === 0;
                    return (
                      <div
                        key={`${ev.time}-${ev.signal}`}
                        className={[
                          "flex items-center gap-2.5 rounded-xl px-2.5 py-2",
                          latest ? "signal-latest" : "",
                        ].join(" ")}
                      >
                        <span
                          className={[
                            "flex h-7 w-7 shrink-0 items-center justify-center rounded-full ring-1",
                            isBuy
                              ? "bg-emerald-50 text-emerald-600 ring-emerald-200"
                              : "bg-rose-50 text-rose-600 ring-rose-200",
                          ].join(" ")}
                        >
                          {isBuy ? (
                            <ArrowUpRight className="h-3.5 w-3.5" />
                          ) : (
                            <ArrowDownRight className="h-3.5 w-3.5" />
                          )}
                        </span>

                        <span className="min-w-0 flex-1 leading-tight">
                          <span className="flex items-center gap-1.5">
                            <span
                              className={[
                                "text-[11px] font-bold",
                                isBuy
                                  ? "text-emerald-600"
                                  : "text-rose-600",
                              ].join(" ")}
                            >
                              {ev.signal}
                            </span>

                            {latest && (
                              <span className="rounded bg-blue-50 px-1 py-px text-[8px] font-bold uppercase tracking-wider text-blue-600">
                                Latest
                              </span>
                            )}
                          </span>

                          <span className="block truncate text-[9px] font-medium text-slate-400">
                            {formatISTShortDateTime(
                              ev.time
                            )}
                          </span>
                        </span>

                        <span className="flex flex-col items-end leading-tight">
                          <span className="font-mono text-[11px] font-semibold tabular-nums text-slate-700">
                            {fmt(ev.price)}
                          </span>

                          {ev.realizedPL != null ? (
                            <span
                              className={[
                                "font-mono text-[10px] font-bold tabular-nums",
                                ev.realizedPL >= 0
                                  ? "text-emerald-600"
                                  : "text-rose-600",
                              ].join(" ")}
                            >
                              {fmtSigned(ev.realizedPL)}
                            </span>
                          ) : ev.exitTime == null && latest ? (
                            <span className="text-[9px] font-bold uppercase tracking-wider text-amber-500">
                              Open
                            </span>
                          ) : null}
                        </span>
                      </div>
                    );
                  })}
              </div>

            </Card>
          )}

          {/* INTEGRITY NOTE */}

          <div className="shrink-0 rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50/80 to-indigo-50/60 p-2.5">

            <div className="flex items-start gap-2.5">

              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />


              <p className="text-[10px] font-medium leading-4 text-blue-700/80">

                BullionAI.pine executes
                verified (SHA-256) on every
                run — display never modifies
                strategy state.

              </p>

            </div>

          </div>

        </aside>

      </main>

    </div>
  );
}


export default App;
