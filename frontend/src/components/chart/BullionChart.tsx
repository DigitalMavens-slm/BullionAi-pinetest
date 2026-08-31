import {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  createChart,
  CandlestickSeries,
  LineSeries,
  HistogramSeries,
  createSeriesMarkers,
  ColorType,
  CrosshairMode,
  LineStyle,
  TickMarkType,
  type IChartApi,
  type ISeriesApi,
  type ISeriesMarkersPluginApi,
  type CandlestickData,
  type HistogramData,
  type Time,
} from "lightweight-charts";

import {
  ChevronsRight,
} from "lucide-react";


import {
  IST_TIME_ZONE,
  formatISTShortDateTime,
} from "../../lib/ist-time";

type Candle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
};

type BullionChartProps = {
  candles?: Candle[];

  entryTime?: number | null;


  signal?: string | null;

  livePrice?: number | null;

  label?: string;

  timeframeLabel?: string;

  signals?: {
    time: number;
    signal: string;
  }[] | null;

  timeframeSeconds?: number;

  instrumentConfig?: {
    tickSize: number;
    decimals: number;
  };
};

type LegendValues = {
  time: number;

  open: number;

  high: number;

  low: number;

  close: number;

  volume?: number;
} | null;

/*
 * =========================================================
 * TRADINGVIEW PALETTE
 * =========================================================
 */

const UP = "#089981";

const DOWN = "#f23645";

function getDecimals(instrumentConfig?: { tickSize: number; decimals: number }): number {
  if (!instrumentConfig) return 2;
  return instrumentConfig.decimals ?? 2;
}

function fmt(
  value: number,
  instrumentConfig?: { tickSize: number; decimals: number }
) {
  const decimals = getDecimals(instrumentConfig);

  return value.toLocaleString(
    "en-IN",
    {
      minimumFractionDigits: decimals,

      maximumFractionDigits: decimals,
    }
  );
}


function fmtVol(
  value?: number
) {
  if (
    value === undefined ||
    value === null
  ) {
    return "—";
  }

  return value.toLocaleString(
    "en-IN"
  );
}


/*
 * =========================================================
 * IST TIME FORMATTING
 *
 * lightweight-charts renders raw UTC
 * timestamps. MCX sessions are quoted
 * in Asia/Kolkata, so the time axis
 * ticks and the crosshair label are
 * formatted in IST explicitly.
 * =========================================================
 */

const IST_TZ = {
  timeZone: IST_TIME_ZONE,
} as const;


function fmtTickIST(
  unixSec: number,
  tickMarkType: TickMarkType
) {
  const d = new Date(
    unixSec * 1000
  );


  if (
    tickMarkType ===
    TickMarkType.Year
  ) {

    return d.toLocaleDateString(
      "en-IN",
      {
        ...IST_TZ,

        year: "numeric",
      }
    );

  }


  if (
    tickMarkType ===
    TickMarkType.Month
  ) {

    return d.toLocaleDateString(
      "en-IN",
      {
        ...IST_TZ,

        month: "short",
      }
    );

  }


  /*
   * Day ticks (and the first bar
   * of each session day) show the
   * calendar date so intraday bars
   * stay anchored to their day.
   */

  if (
    tickMarkType ===
    TickMarkType.DayOfMonth
  ) {

    return d.toLocaleDateString(
      "en-IN",
      {
        ...IST_TZ,

        day: "2-digit",

        month: "short",
      }
    );

  }


  return d.toLocaleTimeString(
    "en-IN",
    {
      ...IST_TZ,

      hour: "2-digit",

      minute: "2-digit",

      hour12: false,
    }
  );

}


function fmtCrosshairIST(
  unixSec: number
) {
  return formatISTShortDateTime(
    unixSec * 1000
  );
}


export function BullionChart({
  candles = [],
  entryTime = null,
  signal = null,
  livePrice = null,
  label = "MCX Gold",
  timeframeLabel = "",
  signals = null,
  timeframeSeconds = 0,
  instrumentConfig,
}: BullionChartProps) {

  const containerRef =
    useRef<HTMLDivElement | null>(
      null
    );

  const chartRef =
    useRef<IChartApi | null>(
      null
    );

  const candleSeriesRef =
    useRef<ISeriesApi<"Candlestick"> | null>(
      null
    );

  const volumeSeriesRef =
    useRef<ISeriesApi<"Histogram"> | null>(
      null
    );

  const entrySeriesRef =
    useRef<ISeriesApi<"Line"> | null>(
      null
    );

  const markersRef =
    useRef<ISeriesMarkersPluginApi<Time> | null>(
      null
    );

  /*
   * Last candle kept in a ref so
   * the legend can render without
   * re-rendering the chart effect.
   */

  const lastCandleRef =
    useRef<LegendValues>(
      null
    );

  /*
   * Live forming bar state — mutated
   * on every tick, TradingView-style.
   */

  const lastBarRef =
    useRef<{
      t: number;
      o: number;
      h: number;
      l: number;
      c: number;
    } | null>(
      null
    );

  /*
   * View key whose default zoom
   * was already applied — keeps
   * the periodic candle poll
   * from resetting the user's
   * scroll position.
   */

  const viewKeyAppliedRef =
    useRef<string | null>(
      null
    );


  const [
    legend,
    setLegend,
  ] = useState<LegendValues>(
    null
  );


  // =========================================================
  // CREATE CHART
  // =========================================================

  useEffect(() => {

    if (!containerRef.current) {
      return;
    }

    const container =
      containerRef.current;


    const chart =
      createChart(
        container,
        {
          /*
           * v5 native auto-sizing:
           * tracks container box
           * without manual observers.
           */

          autoSize: true,

          layout: {
            background: {
              type:
                ColorType.Solid,

              color:
                "transparent",
            },

            textColor:
              "#64748b",

            fontSize: 11,

            fontFamily:
              "Inter, ui-sans-serif, system-ui, sans-serif",

            attributionLogo: false,
          },

          grid: {
            vertLines: {
              color:
                "rgba(15,23,42,0.03)",
            },

            horzLines: {
              color:
                "rgba(15,23,42,0.05)",
            },
          },

          crosshair: {
            mode:
              CrosshairMode.Normal,

            vertLine: {
              color:
                "rgba(15,23,42,0.30)",

              width: 1,

              style:
                LineStyle.LargeDashed,

              labelBackgroundColor:
                "#131722",
            },

            horzLine: {
              color:
                "rgba(15,23,42,0.30)",

              width: 1,

              style:
                LineStyle.LargeDashed,

              labelBackgroundColor:
                "#131722",
            },
          },

          rightPriceScale: {
            borderVisible:
              false,

            scaleMargins: {
              top: 0.08,

              bottom: 0.24,
            },
          },

timeScale: {
            borderVisible:
              false,

            timeVisible:
              true,

            secondsVisible:
              false,

            rightOffset:
              8,

            barSpacing:
              9,

            minBarSpacing:
              2,

            tickMarkFormatter:
              (
                time: Time,
                tickMarkType: TickMarkType
              ) =>
                fmtTickIST(
                  Number(time),
                  tickMarkType
                ),
          },

          handleScroll: {
            mouseWheel: true,
            pressedMouseMove: true,
            horzTouchDrag: true,
            vertTouchDrag: true,
          },

          handleScale: {
            mouseWheel: true,
            pinch: true,
            axisDoubleClickReset: true,
          },

localization: {
            priceFormatter:
              (
                price: number
              ) => {
                const decimals = getDecimals(instrumentConfig);

                return price.toLocaleString(
                  "en-IN",
                  {
                    minimumFractionDigits: decimals,
                    maximumFractionDigits: decimals,
                  }
                );
              },

            timeFormatter:
              (time: Time) =>
                fmtCrosshairIST(
                  Number(time)
                ),
          },
        }
      );


    // =======================================================
    // CANDLESTICK SERIES — TV COLORS
    // =======================================================

    const candleSeries =
      chart.addSeries(
        CandlestickSeries,
        {
          upColor: UP,

          downColor: DOWN,

          borderVisible:
            false,

          wickUpColor: UP,

          wickDownColor: DOWN,
        }
      );


    // =======================================================
    // VOLUME HISTOGRAM — OVERLAY PANE
    // =======================================================

    const volumeSeries =
      chart.addSeries(
        HistogramSeries,
        {
          priceScaleId:
            "volume",

          priceFormat: {
            type:
              "volume",
          },

          lastValueVisible:
            false,

          priceLineVisible:
            false,
        }
      );


    volumeSeries.priceScale().applyOptions(
      {
        scaleMargins: {
          top: 0.82,

          bottom: 0,
        },
      }
    );


    // =======================================================
    // ENTRY PRICE
    // =======================================================

    const entrySeries =
      chart.addSeries(
        LineSeries,
        {
          color:
            "rgba(15,23,42,0.40)",

          lineWidth: 1,

          lineStyle:
            LineStyle.Dotted,

          priceLineVisible:
            false,

          lastValueVisible:
            true,

          title: "Entry",
        }
      );


    chartRef.current =
      chart;

    candleSeriesRef.current =
      candleSeries;

    volumeSeriesRef.current =
      volumeSeries;

    entrySeriesRef.current =
      entrySeries;


    // =======================================================
    // CROSSHAIR → LEGEND (TV STYLE)
    // =======================================================

    chart.subscribeCrosshairMove(
      param => {

        if (
          !param.time ||
          !param.point
        ) {
          setLegend(
            lastCandleRef.current
          );

          return;
        }


        const candle =

          param.seriesData.get(
            candleSeries
          ) as
          | CandlestickData<Time>
          | undefined;


        if (!candle) {

          setLegend(
            lastCandleRef.current
          );

          return;

        }


        const vol =

          param.seriesData.get(
            volumeSeries
          ) as
          | HistogramData<Time>
          | undefined;


        setLegend({

          time:
            Number(
              param.time
            ) * 1000,

          open:
            candle.open,

          high:
            candle.high,

          low:
            candle.low,

          close:
            candle.close,

          volume:
            vol?.value,

        });

      }
    );


    // =======================================================
    // CLEANUP
    // =======================================================

    return () => {

      chart.remove();

      chartRef.current =
        null;

      candleSeriesRef.current =
        null;

      volumeSeriesRef.current =
        null;

      entrySeriesRef.current =
        null;

markersRef.current =
        null;

    };

  }, []);


  // =========================================================
  // UPDATE PRICE FORMATTER WHEN INSTRUMENT CONFIG CHANGES
  // =========================================================

  useEffect(() => {
    const chart = chartRef.current;
    const candleSeries = candleSeriesRef.current;
    if (!chart || !candleSeries) return;

    // Update candle series price format (right price scale)

    const decimals = getDecimals(instrumentConfig);

    candleSeries.applyOptions({
      priceFormat: {
        type: 'custom',
        formatter: (price: number) => {
          return price.toLocaleString("en-IN", {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals,
          });
        },
      },
    });
  }, [instrumentConfig]);


  // =========================================================
  // HISTORICAL CANDLES + VOLUME
  // =========================================================

  useEffect(() => {

    const chart =
      chartRef.current;

    const series =
      candleSeriesRef.current;

    const volume =
      volumeSeriesRef.current;


    if (
      !chart ||
      !series ||
      !volume
    ) {
      return;
    }


    const valid0 =
      candles.filter(
        c =>
          Number.isFinite(
            c.time
          ) &&
          Number.isFinite(
            c.open
          ) &&
          Number.isFinite(
            c.high
          ) &&
          Number.isFinite(
            c.low
          ) &&
          Number.isFinite(
            c.close
          )
      );


    /*
     * Defensive: charts require
     * strictly ascending unique
     * times — never crash on a
     * bad dataset.
     */

    const byTime = new Map(

      valid0.map(c => [
        c.time,
        c,
      ])

    );

    const valid =
      Array.from(
        byTime.values()
      ).sort(
        (a, b) =>
          a.time - b.time
      );


    const formatted:
      CandlestickData<Time>[] =
      valid.map(c => ({
        time:

          Math.floor(
            c.time / 1000
          ) as Time,

        open: c.open,

        high: c.high,

        low: c.low,

        close: c.close,
      }));


    const volumes:
      HistogramData<Time>[] =
      valid.map(c => ({
        time:

          Math.floor(
            c.time / 1000
          ) as Time,

        value:
          c.volume ?? 0,

        color:

          c.close >= c.open

            ? "rgba(8,153,129,0.28)"

            : "rgba(242,54,69,0.28)",
      }));


    try {
      series.setData(
        formatted
      );

      dataCountRef.current = formatted.length;

      volume.setData(
        volumes
      );
    } catch (err) {
      // Defensive: a lightweight-charts internal error (e.g. reportAllChanges
      // reading an undefined candle) must never take down the whole dashboard.
      console.error("Chart setData failed:", err);
      return;
    }

    const last =
      valid[
        valid.length - 1
      ];


    lastCandleRef.current =
      last
        ? {
            time:
              last.time,

            open:
              last.open,

            high:
              last.high,

            low:
              last.low,

            close:
              last.close,

            volume:
              last.volume,
          }
        : null;


    setLegend(
      lastCandleRef.current
    );


    /*
     * Reset the live forming-bar
     * tracker to the newest
     * historical candle.
     */

    lastBarRef.current = last
      ? {
          t: Math.floor(
            last.time / 1000
          ),

          o: last.open,

          h: last.high,

          l: last.low,

          c: last.close,
        }
      : null;


    if (
      formatted.length > 0
    ) {

      /*
       * TradingView-style default:
       * show only the most recent
       * stretch of bars at a
       * readable spacing instead
       * of squeezing the entire
       * history into view.
       *
       * Applied once per view —
       * NOT on every poll — so
       * the user's scroll/zoom
       * position is preserved
       * while live data refreshes.
       */

      const viewKey =
        `${label}|${timeframeLabel}|${timeframeSeconds}`;

      if (
        viewKeyAppliedRef.current !==
        viewKey
      ) {

        viewKeyAppliedRef.current =
          viewKey;

        const VISIBLE_BARS =
          110;

        const from = Math.max(
          0,

          formatted.length -
            VISIBLE_BARS
        );


        chart

          .timeScale()

          .setVisibleLogicalRange({
            from,

            to:

              formatted.length +
              6,
          });

      }

    }

  }, [candles, label, timeframeLabel, timeframeSeconds]);


  // =========================================================
  // PINE SIGNAL MARKERS
  //
  // Exact match to BullionAI.pine:
  //
  //   newBuy  -> labelup   BELOW bar
  //   newSell -> labeldown ABOVE bar
  //
  // Rendered for every historical
  // signal from the Pine run.
  // =========================================================

  useEffect(() => {

    const series =
      candleSeriesRef.current;


    if (!series) {
      return;
    }


    const times = new Set(

      candles.map(

        c =>
          Math.floor(
            c.time / 1000
          )

      )

    );


    const markers = [];


    type M = {

      time: Time;

      position:
        | "belowBar"
        | "aboveBar";

      color: string;

      shape:
        | "arrowUp"
        | "arrowDown"
        | "circle";

      text: string;

    };


    /*
     * Full signal history —
     * BUY below, SELL above,
     * exactly like plotshape().
     */

    for (
      const ev of signals ??
      []
    ) {

      const t = Math.floor(
        Number(ev.time) /
          1000
      );

      if (!times.has(t)) {
        continue;
      }

      const isBuy =

        String(
          ev.signal
        ) === "BUY";


      markers.push({

        time: t as Time,

        position:

          isBuy

            ? ("belowBar" as const)

            : ("aboveBar" as const),

        color:

          isBuy ? UP : DOWN,

        shape:

          isBuy

            ? ("arrowUp" as const)

            : ("arrowDown" as const),

        text:

          isBuy ? "BUY" : "SELL",

      } satisfies M);

    }


    /*
     * Fallback when history is not
     * available but the entry time
     * is known.
     */

    if (

      markers.length ===
        0 &&

      entryTime &&

      times.has(

        Math.floor(
          entryTime / 1000
        )

      )

    ) {

      const isBuy =

        signal !== "SELL";


      markers.push({

        time:

          Math.floor(
            entryTime / 1000
          ) as Time,

        position:

          isBuy

            ? ("belowBar" as const)

            : ("aboveBar" as const),

        color:

          isBuy ? UP : DOWN,

        shape:

          isBuy

            ? ("arrowUp" as const)

            : ("arrowDown" as const),

        text:

          isBuy ? "BUY" : "SELL",

      });

    }


    /*
     * Exit marker (neutral) — the
     * Pine table reports Exit; a
     * subtle dot above the exit
     * candle keeps it visible
     * without inventing shapes
     * Pine doesn't draw.
     */

    


    try {

      markersRef
        .current
        ?.setMarkers(
          []
        );


      markersRef.current =

        markers.length > 0

          ? createSeriesMarkers(
              series,
              markers
            )

          : null;

    } catch {

      // Markers unsupported — skip silently.

    }

  }, [
    candles,
    signals,
    signal,
  ]);


  // =========================================================
  // LIVE TICKS → REAL-TIME CANDLES
  //
  // Same bar  : update close/high/low
  // New bar   : open a fresh candle
  //
  // This is what makes the last
  // candle move tick-by-tick like
  // on TradingView.
  // =========================================================

  useEffect(() => {

    const series =
      candleSeriesRef.current;

    const volume =
      volumeSeriesRef.current;


    if (
      !series ||
      livePrice === null ||
      livePrice === undefined
    ) {
      return;
    }


    const bar = lastBarRef.current;

    if (!bar) return;


    const tfSec =

      timeframeSeconds > 0

        ? timeframeSeconds

        : 60;


    const nowSec =
      Math.floor(
        Date.now() / 1000
      );

    const curBarStart =
      Math.floor(
        nowSec / tfSec
      ) * tfSec;


    /*
     * Clock-skew guard: never go
     * backwards in time.
     */

    if (curBarStart < bar.t) {
      return;
    }


    if (curBarStart === bar.t) {

      /*
       * Same forming bar — extend it.
       */

      bar.h = Math.max(
        bar.h,
        livePrice
      );

      bar.l = Math.min(
        bar.l,
        livePrice
      );

      bar.c = livePrice;


      try {
        series.update({
          time: bar.t as Time,

          open: bar.o,

          high: bar.h,

          low: bar.l,

          close: bar.c,
        });
      } catch (err) {
        console.error("Chart update (extend) failed:", err);
      }

    } else {

      /*
       * Rolled into a new candle.
       */

      const nb = {
        t: curBarStart,

        o: livePrice,

        h: livePrice,

        l: livePrice,

        c: livePrice,
      };


      try {
        series.update({
          time: nb.t as Time,

          open: nb.o,

          high: nb.h,

          low: nb.l,

          close: nb.c,
        });


        volume?.update({
          time: curBarStart as Time,

          value: 0,

          color:
            "rgba(8,153,129,0.28)",
        });
      } catch (err) {
        console.error("Chart update (new bar) failed:", err);
      }


      lastBarRef.current = nb;

    }

  }, [livePrice, timeframeSeconds]);







  // =========================================================
  // LEGEND DERIVATIONS (TV STYLE)
  // =========================================================

  const shown =
    legend;


  const change =

    shown

      ? shown.close -
        shown.open

      : 0;


  const changePct =

    shown &&
    shown.open !== 0

      ? (change /
          shown.open) *
        100

      : 0;


  const bullish =
    change >= 0;


  /* Jump-to-latest visibility */

  const [showJumpLatest, setShowJumpLatest] =
    useState(false);

  const dataCountRef =
    useRef(0);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    function handler(range: any) {
      const total = dataCountRef.current;
      if (!range || total === 0) {
        setShowJumpLatest(false);
        return;
      }
      setShowJumpLatest(range.to < total - 1);
    }

    const ts = chart.timeScale();
    ts.subscribeVisibleLogicalRangeChange(handler);

    return () => {
      ts.unsubscribeVisibleLogicalRangeChange(handler);
    };
  }, []);



  // =========================================================
  // RENDER
  // =========================================================

  return (
    <div
      className="absolute inset-0"
    >

      {/* WATERMARK */}

      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">

        <span className="select-none text-[64px] font-bold uppercase tracking-[0.35em] text-slate-900/[0.035] lg:text-[88px]">

          BULLIONAI

        </span>

      </div>


{/* JUMP TO LATEST */}

      {showJumpLatest && (
        <button
          onClick={() =>
            chartRef.current
              ?.timeScale()
              ?.scrollToRealTime()
          }
          className="absolute bottom-4 right-4 z-20 flex items-center gap-1 rounded-full border border-slate-200 bg-white/95 px-3 py-1.5 text-[11px] font-bold text-slate-700 shadow-md transition hover:border-amber-300 hover:text-amber-600"
        >
          Latest
          <ChevronsRight className="h-3.5 w-3.5" />
        </button>
      )}

      {/* TRADINGVIEW-LIKE CHART TOOLBAR REMOVED (per request) */}

      {/* CHART CANVAS */}

      <div
        ref={containerRef}
        className="absolute inset-0"
      />


      {/* TRADINGVIEW-STYLE LEGEND */}

      <div className="pointer-events-none absolute left-4 top-4 z-20 space-y-1.5">

        {/* ROW 1 — SYMBOL + TIMEFRAME + LIVE CHIP */}

        <div className="flex items-center gap-2 text-[12px] font-semibold text-slate-800">

          <span>

            {label}

          </span>


          {timeframeLabel && (

            <>

              <span className="text-slate-300">

                ·

              </span>


              <span className="font-medium text-slate-500">

                {timeframeLabel}

              </span>

            </>

          )}


          {livePrice !== null && (
            <span className="rounded bg-[#2962FF] px-1.5 py-px text-[9px] font-bold tracking-wide text-white">

              LIVE

            </span>
          )}

        </div>


        {/* ROW 2 — OHLC + CHANGE */}

{shown && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] font-medium tabular-nums">

            <span className="text-slate-400">

              O{" "}

              <span className="text-slate-700">

                {fmt(shown.open, instrumentConfig)}

              </span>
            </span>

            <span className="text-slate-400">
              H{" "}
              <span className="text-slate-700">

                {fmt(shown.high, instrumentConfig)}

              </span>
            </span>

            <span className="text-slate-400">
              L{" "}
              <span className="text-slate-700">

                {fmt(shown.low, instrumentConfig)}

              </span>
            </span>

            <span className="text-slate-400">
              C{" "}
              <span
                className={
                  bullish

                    ? "text-[#089981]"

                    : "text-[#f23645]"
                }
              >
                {fmt(shown.close, instrumentConfig)}
              </span>
            </span>


            <span
              className={[
                "font-semibold",

                bullish

                  ? "text-[#089981]"

                  : "text-[#f23645]",
              ].join(" ")}
            >
              {fmtSigned(change, instrumentConfig)}
            </span>

            <span
              className={[
                "font-semibold",

                bullish

                  ? "text-[#089981]"

                  : "text-[#f23645]",
              ].join(" ")}
            >
              ({fmtSignedPct(changePct)})
            </span>

          </div>
        )}


        {/* ROW 3 — VOLUME */}

        {shown && (
          <div className="text-[11px] font-medium tabular-nums text-slate-400">

            Vol{" "}
            <span className="text-slate-600">

              {fmtVol(shown.volume)}

            </span>
          </div>
        )}

      </div>

    </div>
  );
}


function fmtSigned(v: number, instrumentConfig?: { tickSize: number; decimals: number }) {
  const decimals = getDecimals(instrumentConfig);

  return (
    (v >= 0 ? "+" : "") +
    v.toLocaleString("en-IN", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })
  );
}


function fmtSignedPct(v: number) {
  return (
    (v >= 0 ? "+" : "") +
    v.toFixed(2) +
    "%"
  );
}
