/*
 * =========================================================
 * INDICATOR ENGINE
 *
 * Pure-JS implementations of the indicators used by the
 * BullionAI strategy, matching the TradingView/Pine defaults:
 *
 *   EMA        = 50
 *   RSI        = 14
 *   ATR        = 14
 *   Supertrend = ATR 10, factor 3.0
 *   MACD       = 12 / 26 / 9
 *
 * All functions are pure (input: array of candles
 * { open, high, low, close, volume? }; output: aligned arrays
 * or a single value at the last index). NaN/undefined values
 * are produced for warm-up windows so callers can drop the
 * initial bars the same way Pine does.
 * =========================================================
 */

function ema(values, period) {
    const k = 2 / (period + 1);
    const out = new Array(values.length).fill(NaN);
    let prev = NaN;
    for (let i = 0; i < values.length; i++) {
        const v = Number(values[i]);
        if (!Number.isFinite(v)) continue;
        if (Number.isNaN(prev)) {
            // Seed on the first valid value (matches Pine's initial sma).
            prev = v;
        } else {
            prev = v * k + prev * (1 - k);
        }
        out[i] = prev;
    }
    return out;
}

function sma(values, period) {
    const out = new Array(values.length).fill(NaN);
    let sum = 0;
    for (let i = 0; i < values.length; i++) {
        const v = Number(values[i]);
        if (!Number.isFinite(v)) continue;
        sum += v;
        if (i >= period) sum -= Number(values[i - period]);
        if (i >= period - 1) out[i] = sum / period;
    }
    return out;
}

function rsi(closes, period = 14) {
    const out = new Array(closes.length).fill(NaN);
    let avgGain = 0;
    let avgLoss = 0;
    for (let i = 1; i < closes.length; i++) {
        const ch = Number(closes[i]) - Number(closes[i - 1]);
        const gain = ch > 0 ? ch : 0;
        const loss = ch < 0 ? -ch : 0;
        if (i <= period) {
            avgGain += gain;
            avgLoss += loss;
            if (i === period) {
                avgGain /= period;
                avgLoss /= period;
                out[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
            }
        } else {
            avgGain = (avgGain * (period - 1) + gain) / period;
            avgLoss = (avgLoss * (period - 1) + loss) / period;
            out[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
        }
    }
    return out;
}

function trueRange(candles) {
    const tr = new Array(candles.length).fill(NaN);
    for (let i = 0; i < candles.length; i++) {
        const h = Number(candles[i].high);
        const l = Number(candles[i].low);
        if (i === 0) {
            tr[i] = h - l;
        } else {
            const pc = Number(candles[i - 1].close);
            tr[i] = Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc));
        }
    }
    return tr;
}

function atr(candles, period = 14) {
    const tr = trueRange(candles);
    const out = new Array(candles.length).fill(NaN);
    let prev = NaN;
    for (let i = 0; i < candles.length; i++) {
        const t = tr[i];
        if (!Number.isFinite(t)) continue;
        if (Number.isNaN(prev)) {
            // Seed: Wilder's RMA starts as an SMA of the lookback window.
            // Use the first `period` values as a simple mean.
            if (i >= period - 1) {
                let s = 0;
                for (let j = i - period + 1; j <= i; j++) s += tr[j];
                prev = s / period;
                out[i] = prev;
            }
        } else {
            prev = (prev * (period - 1) + t) / period;
            out[i] = prev;
        }
    }
    return out;
}

function macd(closes, fast = 12, slow = 26, signal = 9) {
    const emaFast = ema(closes, fast);
    const emaSlow = ema(closes, slow);
    const macdLine = closes.map((_, i) => emaFast[i] - emaSlow[i]);
    const signalLine = ema(macdLine.filter(Number.isFinite).length ? macdLine : [], signal);
    // Re-align signalLine to full length (it was computed on the filtered array).
    const sig = new Array(closes.length).fill(NaN);
    const hist = new Array(closes.length).fill(NaN);
    let sIdx = 0;
    for (let i = 0; i < closes.length; i++) {
        if (Number.isFinite(macdLine[i])) {
            if (sIdx < signalLine.length) sig[i] = signalLine[sIdx];
            sIdx++;
        }
        if (Number.isFinite(macdLine[i]) && Number.isFinite(sig[i])) {
            hist[i] = macdLine[i] - sig[i];
        }
    }
    return { macdLine, signalLine: sig, histogram: hist };
}

function supertrend(candles, atrPeriod = 10, factor = 3.0) {
    const atrVals = atr(candles, atrPeriod);
    const n = candles.length;
    const upper = new Array(n).fill(NaN);
    const lower = new Array(n).fill(NaN);
    const st = new Array(n).fill(NaN);
    const dir = new Array(n).fill(0);

    for (let i = 0; i < n; i++) {
        const mid = (Number(candles[i].high) + Number(candles[i].low)) / 2;
        const band = factor * (atrVals[i] || 0);
        let bUp = mid + band;
        let bLo = mid - band;

        if (i > 0 && Number.isFinite(upper[i - 1])) {
            bUp = (bUp < upper[i - 1] || Number(candles[i].close) > upper[i - 1])
                ? bUp
                : upper[i - 1];
            bLo = (bLo > lower[i - 1] || Number(candles[i].close) < lower[i - 1])
                ? bLo
                : lower[i - 1];
        }

        upper[i] = bUp;
        lower[i] = bLo;

        if (i === 0) {
            st[i] = band;
            dir[i] = Number(candles[i].close) > bUp ? -1 : 1;
        } else {
            const prevDir = dir[i - 1];
            const close = Number(candles[i].close);
            if (prevDir === 1) {
                dir[i] = close < bLo ? -1 : 1;
            } else {
                dir[i] = close > bUp ? 1 : -1;
            }
            // Standard SuperTrend line: the lower/upper bound of the active direction.
            st[i] = dir[i] === 1 ? bLo : bUp;
        }
    }

    return { supertrend: st, direction: dir };
}

function computeIndicators(candles) {
    const closes = (candles || []).map(c => Number(c.close));
    const emaTrend = ema(closes, 50);
    const rsiVals = rsi(closes, 14);
    const atrVals = atr(candles, 14);
    const st = supertrend(candles, 10, 3.0);
    const mc = macd(closes, 12, 26, 9);

    return {
        ema: emaTrend,
        rsi: rsiVals,
        atr: atrVals,
        supertrend: st.supertrend,
        supertrendDir: st.direction,
        macdLine: mc.macdLine,
        macdSignal: mc.signalLine,
        macdHistogram: mc.histogram,
    };
}

module.exports = {
    ema,
    sma,
    rsi,
    trueRange,
    atr,
    macd,
    supertrend,
    computeIndicators,
};