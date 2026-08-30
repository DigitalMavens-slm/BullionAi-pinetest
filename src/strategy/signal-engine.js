/*
 * =========================================================
 * SIGNAL ENGINE
 *
 * Generates a single BUY/SELL decision from the indicator
 * engine, matching the BullionAI strategy rules:
 *
 *   trendBull  = supertrend direction < 0
 *   trendBear  = supertrend direction > 0
 *   momentumBull = RSI > 50 AND macdLine > macdSignal
 *   momentumBear = RSI < 50 AND macdLine < macdSignal
 *
 *   BUY  = trendBull AND momentumBull
 *   SELL = trendBear AND momentumBear
 *
 * Signals are evaluated ON CANDLE CLOSE only (never intra-candle),
 * so exactly one signal event is emitted per bar. The caller owns
 * de-duplication of repeated signals.
 * =========================================================
 */

const { computeIndicators } = require("./indicator-engine");

function evaluateBar(indicators, index) {
    const dir = Number(indicators.supertrendDir?.[index]);
    const rsiV = Number(indicators.rsi?.[index]);
    const macdLine = Number(indicators.macdLine?.[index]);
    const macdSig = Number(indicators.macdSignal?.[index]);

    const trendBull = dir < 0;
    const trendBear = dir > 0;
    const momentumBull = rsiV > 50 && macdLine > macdSig;
    const momentumBear = rsiV < 50 && macdLine < macdSig;

    if (trendBull && momentumBull) return "BUY";
    if (trendBear && momentumBear) return "SELL";
    return "NONE";
}

/*
 * Build the full signal series over candles, marking the bar that
 * first triggered each direction change. Returns an array aligned
 * with candles: { index, signal: "BUY"|"SELL"|"NONE", close, time }.
 *
 * This is the single source for backtesting the signal timing —
 * evaluated on the close of each bar.
 */
function generateSignalSeries(candles) {
    const indicators = computeIndicators(candles);
    const series = [];
    for (let i = 0; i < candles.length; i++) {
        const sig = evaluateBar(indicators, i);
        series.push({
            index: i,
            signal: sig,
            close: Number(candles[i].close),
            time: Number(candles[i].time) || 0,
        });
    }
    return series;
}

/*
 * Latest signal at the current (last) closed bar.
 */
function latestSignal(candles) {
    const indicators = computeIndicators(candles);
    const last = candles.length - 1;
    return {
        signal: evaluateBar(indicators, last),
        index: last,
        close: last >= 0 ? Number(candles[last].close) : null,
        time: last >= 0 ? Number(candles[last].time) : null,
        indicators: {
            ema: indicators.ema?.[last] ?? null,
            rsi: indicators.rsi?.[last] ?? null,
            atr: indicators.atr?.[last] ?? null,
            supertrend: indicators.supertrend?.[last] ?? null,
            supertrendDir: indicators.supertrendDir?.[last] ?? null,
            macdLine: indicators.macdLine?.[last] ?? null,
            macdSignal: indicators.macdSignal?.[last] ?? null,
            macdHistogram: indicators.macdHistogram?.[last] ?? null,
        },
    };
}

module.exports = {
    evaluateBar,
    generateSignalSeries,
    latestSignal,
};