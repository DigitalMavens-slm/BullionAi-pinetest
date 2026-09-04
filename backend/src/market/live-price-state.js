const EventEmitter = require("events");


class LivePriceState extends EventEmitter {

    constructor({
        exchange = "MCX",
        token = "483079",
    } = {}) {

        super();

        this.exchange =
            exchange;

        this.token =
            String(token);

        this.state = {
            exchange:
                this.exchange,

            token:
                this.token,

            price:
                null,

            previousPrice:
                null,

            // Exchange-authoritative day OHLC (from Shoonya tick o/h/l/c).
            // These are the official MCX open / day high / day low / previous
            // close — must stay in sync with the exchange, not derived candles.
            open: null,
            high: null,
            low: null,
            prevClose: null,

            change:
                null,

            changePercent:
                null,

            tickTime:
                null,

            receivedAt:
                null,

            tickCount:
                0,

            connected:
                false,
        };
    }


    // =========================================================
    // CONNECTED
    // =========================================================

    setConnected(
        connected
    ) {

        this.state.connected =
            Boolean(
                connected
            );

        this.emit(
            "update",
            this.getState()
        );

        return this.getState();
    }


    // =========================================================
    // UPDATE FROM SHOONYA TICK
    // =========================================================

    updateTick(
        tick
    ) {

        if (!tick) {
            return this.getState();
        }


        const price =
            Number(
                tick.price ??
                tick.lp ??
                tick.ltp
            );


        if (
            !Number.isFinite(
                price
            )
        ) {

            return this.getState();

        }


        const previousPrice =
            this.state.price;


        this.state.previousPrice =
            previousPrice;


        this.state.price =
            price;


        this.state.tickTime =
            tick.time ??
            Date.now();


        this.state.receivedAt =
            Date.now();


        this.state.tickCount +=
            1;

        // -----------------------------------------------------
        // EXCHANGE-AUTHORITATIVE DAY OHLC (from Shoonya tick).
        // tick.o = today's open, tick.h/l = day high/low, tick.c = prev close.
        // Keep the latest non-null values — these sync with MCX, not candles.
        // -----------------------------------------------------
        const toNum = v => {
            const n = Number(v);
            return Number.isFinite(n) && n > 0 ? n : null;
        };
        const tOpen = toNum(tick.open);
        const tHigh = toNum(tick.high);
        const tLow = toNum(tick.low);
        const tPrev = toNum(tick.close);
        if (tOpen != null) this.state.open = tOpen;
        if (tHigh != null) this.state.high = tHigh;
        if (tLow != null) this.state.low = tLow;
        if (tPrev != null) this.state.prevClose = tPrev;

        // -----------------------------------------------------
        // DAY CHANGE (exchange)
        // LTP - prevClose (MCX), not tick-to-tick.
        // Falls back to tick-to-tick only when prevClose unknown.
        // -----------------------------------------------------
        const pc = this.state.prevClose;
        if (pc != null && pc !== 0) {
            this.state.change = price - pc;
            this.state.changePercent = ((price - pc) / pc) * 100;
        } else if (previousPrice !== null) {
            this.state.change = price - previousPrice;
            if (previousPrice !== 0) {
                this.state.changePercent = ((price - previousPrice) / previousPrice) * 100;
            } else {
                this.state.changePercent = null;
            }
        } else {
            this.state.change = null;
            this.state.changePercent = null;
        }


        this.emit(
            "update",
            this.getState()
        );


        return this.getState();
    }


    // =========================================================
    // GET CURRENT STATE
    // =========================================================

    getState() {

        return {
            ...this.state,
        };

    }


    // =========================================================
    // GET PRICE
    // =========================================================

    getPrice() {

        return this.state.price;

    }


    // =========================================================
    // GET AGE
    // =========================================================

    getTickAgeMs() {

        if (
            !this.state.receivedAt
        ) {

            return null;

        }


        return (
            Date.now() -
            this.state.receivedAt
        );
    }


    // =========================================================
    // FRESHNESS
    // =========================================================

    isFresh(
        maxAgeMs = 10000
    ) {

        const age =
            this.getTickAgeMs();


        if (
            age === null
        ) {

            return false;

        }


        return age <=
            maxAgeMs;
    }


    // =========================================================
    // RESET
    // =========================================================

    reset() {

        this.state.price =
            null;

        this.state.previousPrice =
            null;

        this.state.open =
            null;
        this.state.high =
            null;
        this.state.low =
            null;
        this.state.prevClose =
            null;

        this.state.change =
            null;

        this.state.changePercent =
            null;

        this.state.tickTime =
            null;

        this.state.receivedAt =
            null;

        this.state.tickCount =
            0;


        this.emit(
            "update",
            this.getState()
        );

    }

}


module.exports = {
    LivePriceState,
};