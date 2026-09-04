// =========================================================
// SPOT LIVE FEED (gold-api.com /price polling)
//
// Polls the free, unlimited live-price endpoint for subscribed Spot
// symbols (XAU, XAG) every few seconds and emits application-level
// "tick" events in the same shape as the Shoonya live feed, so the
// existing CandleAggregator + event bus downstream work unchanged.
//
// Emits: "tick" ({exchange:'SPOT', token, price, time, ...}),
//        "connected" / "disconnected" (poll started/stopped),
//        "subscriptions" (when the set changes).
// =========================================================

const { EventEmitter } = require("events");
const {
    fetchSpotPrice,
    SYMBOL_NAMES,
} = require("./gold-api");

const SPOT_EXCHANGE = "SPOT";

class SpotLiveFeed extends EventEmitter {
    constructor({
        tokens = [],
        pollIntervalMs = 2000,
    } = {}) {
        super();
        this.exchange = SPOT_EXCHANGE;
        this.tokens = tokens.map(tok => String(tok).toUpperCase());
        this.subscriptions = new Set(this.tokens);
        this.pollIntervalMs =
            Number(process.env.SPOT_POLL_MS || pollIntervalMs);
        this.timer = null;
        this.connected = false;
        this.lastTick = null;
        this._polling = false;
    }

    // Subscribe a symbol (token), e.g. "XAU" / "XAG".
    subscribeToken(token) {
        const t = String(token).toUpperCase();
        if (this.subscriptions.has(t)) return;
        this.subscriptions.add(t);
        this.emit("subscriptions", Array.from(this.subscriptions));
    }

    subscribeTokens(tokens) {
        (Array.isArray(tokens) ? tokens : [tokens]).forEach(tk =>
            this.subscribeToken(tk?.token || tk)
        );
    }

    isConnected() {
        return this.connected;
    }

    // Start polling all subscribed symbols.
    async start() {
        if (this.connected) return;
        this.connected = true;
        this.emit("connected", { connected: true });
        console.log(
            "[spot] live feed started — polling gold-api.com every " +
                `${this.pollIntervalMs}ms`
        );
        this.timer = setInterval(
            () => this.pollOnce().catch(() => {}),
            this.pollIntervalMs
        );
        // Immediate first poll.
        this.pollOnce().catch(() => {});
    }

    async stop() {
        this.connected = false;
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        this.emit("disconnected", { connected: false });
    }

    async pollOnce() {
        if (this._polling) return;
        this._polling = true;
        try {
            const tokens = Array.from(this.subscriptions);
            for (const token of tokens) {
                try {
                    const p = await fetchSpotPrice(token);
                    const tick = {
                        exchange: SPOT_EXCHANGE,
                        token,
                        price: p.price,
                        time: Date.now(),
                        volume: null,
                        changePercent: null,
                        name:
                            p.name ||
                            SYMBOL_NAMES[token] ||
                            token,
                    };
                    this.lastTick = tick;
                    this.emit("tick", tick);
                } catch (e) {
                    // A single symbol failing shouldn't stop the poll loop.
                    this.emit("error", e);
                }
            }
        } finally {
            this._polling = false;
        }
    }

    getState() {
        return {
            connected: this.connected,
            lastTickTime: this.lastTick?.time ?? null,
            lastTickPrice: this.lastTick?.price ?? null,
            symbols: Array.from(this.subscriptions),
        };
    }
}

module.exports = {
    SpotLiveFeed,
    SPOT_EXCHANGE,
};
