/*
 * =========================================================
 * TRADE ENGINE
 *
 * Backend-authoritative trade management per
 * { exchange, symbol, timeframe }. Implements the BullionAI
 * rules:
 *
 *   Entry   : on a confirmed BUY/SELL when no active trade exists
 *   Initial SL (fixed): BUY  = Entry - ATR * 1.5
 *                        SELL = Entry + ATR * 1.5
 *   Target 1 : BUY  = Entry + ATR * 2.0   | SELL = Entry - ATR * 2.0
 *   Target 2 : BUY  = Entry + ATR * 4.0   | SELL = Entry - ATR * 4.0
 *   On T1    : mark ACHIEVED, then modify SL:
 *                BUY  = Entry + (T1 - Entry) * 0.35
 *                SELL = Entry - (Entry - T1) * 0.35
 *   On T2    : close trade, Result = T2 - Entry (BUY) / Entry - T2 (SELL)
 *   On initial SL hit before T1 : close, "SL HIT -xxx"
 *   On modified SL hit after T1  : close, "TGT1 ACHIEVED +xxx"
 *   Max points: max favorable movement while OPEN, frozen on close.
 *
 * Each key gets independent tick/candle/trade state (no cross
 * contamination). State is immutable snapshots; the caller decides
 * how to persist/broadcast.
 * =========================================================
 */

const DEFAULT = {
    SL_MULT: 1.5,
    T1_MULT: 2.0,
    T2_MULT: 4.0,
    T1_LOCK_PCT: 0.35,
};

class TradeEngine {
    constructor(opts = {}) {
        this.slMult = opts.slMult ?? DEFAULT.SL_MULT;
        this.t1Mult = opts.t1Mult ?? DEFAULT.T1_MULT;
        this.t2Mult = opts.t2Mult ?? DEFAULT.T2_MULT;
        this.t1LockPct = opts.t1LockPct ?? DEFAULT.T1_LOCK_PCT;
        this.tickSize = opts.tickSize ?? 1;
        // key -> trade state
        this.trades = new Map();
        // key -> completed trade history (append-only)
        this.history = new Map();
    }

    key({ exchange, symbol, timeframe }) {
        return `${String(exchange || "MCX").toUpperCase()}:${String(symbol).toUpperCase()}:${String(timeframe || "15m")}`;
    }

    round(v) {
        const ts = this.tickSize;
        if (!Number.isFinite(v)) return v;
        return Math.round(v / ts) * ts;
    }

    _trade(key) {
        return this.trades.get(key) || null;
    }

    // ---------------------------------------------------------
    // Open a trade from a confirmed signal + the ATR at entry.
    // ---------------------------------------------------------
    openTrade({ exchange, symbol, timeframe, signal, entryPrice, atr, time = Date.now() }) {
        const key = this.key({ exchange, symbol, timeframe });
        if (this._trade(key)) {
            // No duplicate active trades.
            return { ok: false, reason: "already-open", trade: this._trade(key) };
        }
        if (!["BUY", "SELL"].includes(signal)) {
            return { ok: false, reason: "no-signal" };
        }
        const entry = Number(entryPrice);
        const a = Number(atr);
        if (!Number.isFinite(entry) || !Number.isFinite(a) || a <= 0) {
            return { ok: false, reason: "bad-atr" };
        }

        const isBuy = signal === "BUY";
        const sl = isBuy ? entry - a * this.slMult : entry + a * this.slMult;
        const t1 = isBuy ? entry + a * this.t1Mult : entry - a * this.t1Mult;
        const t2 = isBuy ? entry + a * this.t2Mult : entry - a * this.t2Mult;

        const trade = {
            key,
            exchange: String(exchange || "MCX").toUpperCase(),
            symbol: String(symbol),
            timeframe: String(timeframe || "15m"),
            signal,
            entryPrice: this.round(entry),
            initialSL: this.round(sl),
            activeSL: this.round(sl),
            target1: this.round(t1),
            target2: this.round(t2),
            currentPrice: entry,
            currentPL: 0,
            maxPoints: 0,
            maxFavorable: null,
            entryTime: time,
            exitTime: null,
            status: "OPEN",
            target1Status: "WAITING",
            target2Status: "WAITING",
            result: null,
            resultPoints: null,
        };

        this.trades.set(key, trade);
        return { ok: true, trade };
    }

    // ---------------------------------------------------------
    // Update an OPEN trade with the latest price (called on every
    // tick / candle close). Returns the (possibly closed) trade
    // and any transition events for broadcasting.
    // ---------------------------------------------------------
    updatePrice({ exchange, symbol, timeframe, price, time = Date.now() }) {
        const key = this.key({ exchange, symbol, timeframe });
        const trade = this._trade(key);
        if (!trade || trade.status !== "OPEN") {
            return { trade: trade || null, events: [] };
        }

        const p = Number(price);
        if (!Number.isFinite(p)) return { trade, events: [] };

        trade.currentPrice = p;
        const events = [];

        // Current + max P/L
        if (trade.signal === "BUY") {
            trade.currentPL = p - trade.entryPrice;
            if (trade.maxFavorable === null || p > trade.maxFavorable) {
                trade.maxFavorable = p;
            }
        } else {
            trade.currentPL = trade.entryPrice - p;
            if (trade.maxFavorable === null || p < trade.maxFavorable) {
                trade.maxFavorable = p;
            }
        }
        trade.maxPoints = this.round(
            trade.signal === "BUY"
                ? trade.maxFavorable - trade.entryPrice
                : trade.entryPrice - trade.maxFavorable
        );

        const isBuy = trade.signal === "BUY";

        // ----- TARGET 1 -----
        const t1Hit = isBuy ? p >= trade.target1 : p <= trade.target1;
        if (trade.target1Status !== "ACHIEVED" && t1Hit) {
            trade.target1Status = "ACHIEVED";
            const dist = Math.abs(trade.target1 - trade.entryPrice);
            const lock = dist * this.t1LockPct;
            trade.activeSL = this.round(isBuy ? trade.entryPrice + lock : trade.entryPrice - lock);
            events.push({
                type: "target1",
                trade,
                entry: trade.entryPrice,
                target1: trade.target1,
                modifiedSL: trade.activeSL,
            });
            events.push({
                type: "sl_update",
                trade,
                sl: trade.activeSL,
            });
        }

        // ----- STOP LOSS (initial or modified) -----
        const slHit = isBuy ? p <= trade.activeSL : p >= trade.activeSL;
        if (slHit) {
            const captured = this.round(
                isBuy ? trade.activeSL - trade.entryPrice : trade.entryPrice - trade.activeSL
            );
            const wasAfterT1 = trade.target1Status === "ACHIEVED";
            const resultText = wasAfterT1
                ? `TGT1 ACHIEVED ${captured >= 0 ? "+" : ""}${captured} pts`
                : `SL HIT ${captured >= 0 ? "+" : ""}${captured} pts`;
            events.push(...this._close(trade, p, time, resultText, captured, "SL"));
            return { trade, events };
        }

        // ----- TARGET 2 -----
        const t2Hit = isBuy ? p >= trade.target2 : p <= trade.target2;
        if (t2Hit) {
            trade.target2Status = "ACHIEVED";
            const result = this.round(
                isBuy ? trade.target2 - trade.entryPrice : trade.entryPrice - trade.target2
            );
            const resultText = `TGT2 ACHIEVED ${result >= 0 ? "+" : ""}${result} pts`;
            events.push(...this._close(trade, p, time, resultText, result, "T2"));
            return { trade, events };
        }

        return { trade, events };
    }

    _close(trade, exitPrice, time, resultText, resultPoints, trigger) {
        trade.status = "CLOSED";
        trade.exitTime = time;
        trade.currentPL = trade.signal === "BUY"
            ? exitPrice - trade.entryPrice
            : trade.entryPrice - exitPrice;
        trade.result = resultText;
        trade.resultPoints = this.round(resultPoints);
        // freeze max points (already set during OPEN)

        const key = trade.key;
        if (!this.history.has(key)) this.history.set(key, []);
        this.history.get(key).push({ ...trade });
        this.trades.delete(key);

        return [
            {
                type: "trade_close",
                trade,
                exitPrice,
                trigger,
                result: resultText,
                maxPoints: trade.maxPoints,
            },
        ];
    }

    // ---------------------------------------------------------
    // Get the active trade (or the latest closed) for a key.
    // ---------------------------------------------------------
    getState({ exchange, symbol, timeframe }) {
        const key = this.key({ exchange, symbol, timeframe });
        const trade = this._trade(key);
        const hist = this.history.get(key) || [];
        return {
            active: trade || null,
            history: hist,
            lastClosed: hist[hist.length - 1] || null,
        };
    }

    reset({ exchange, symbol, timeframe }) {
        const key = this.key({ exchange, symbol, timeframe });
        this.trades.delete(key);
        // Preserve completed trades in history.
    }
}

module.exports = {
    TradeEngine,
    DEFAULT,
};