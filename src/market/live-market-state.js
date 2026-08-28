const EventEmitter = require("events");

const {
    ShoonyaLiveFeed,
} = require("./shoonya-live-feed");

const {
    LivePriceState,
} = require("./live-price-state");


class LiveMarketState extends EventEmitter {

    constructor({
        marketDataService,
        exchange = "MCX",
        token = "483079",
        tokens = null,
    } = {}) {

        super();

        if (!marketDataService) {
            throw new Error(
                "MarketDataService is required."
            );
        }

        this.exchange =
            exchange;

        this.token =
            String(token);

        /*
         * Track every subscribed
         * instrument separately.
         *
         * An explicit empty array is allowed:
         * the feed starts with zero
         * subscriptions (search-box-only flow)
         * and tokens are added at runtime.
         */

        this.tokens =
            Array.isArray(
                tokens
            )
                ? tokens.map(t =>
                      String(t)
                  )
                : [this.token];


        // -----------------------------------------------------
        // LIVE PRICE STATES (PER TOKEN)
        // -----------------------------------------------------

        this.priceStates =
            new Map();


        for (
            const t of this
                .tokens
        ) {

            this.priceStates.set(

                t,

                new LivePriceState({
                    exchange:
                        this.exchange,

                    token: t,
                })

            );

        }


        /*
         * Primary price state kept for
         * backwards compatibility. Absent
         * when starting with no scripts.
         */

        this.priceState =
            this.priceStates.get(
                this.token
            ) ??
            null;


        // -----------------------------------------------------
        // SHOONYA LIVE FEED
        // -----------------------------------------------------

        this.feed =
            new ShoonyaLiveFeed({
                marketDataService,

                exchange:
                    this.exchange,

                token:
                    this.token,

                tokens:
                    this.tokens,

                reconnect:
                    true,

                reconnectDelay:
                    3000,
            });


        this.started =
            false;


        this.bindEvents();
    }


    // =========================================================
    // BIND EVENTS
    // =========================================================

    bindEvents() {

        // -----------------------------------------------------
        // WEBSOCKET CONNECTED
        // -----------------------------------------------------

        this.feed.on(
            "connected",
            message => {

                for (
                    const ps of this
                        .priceStates
                        .values()
                ) {

                    ps.setConnected(
                        true
                    );

                }

                this.emit(
                    "connected",
                    message
                );

                this.emitUpdate();

            }
        );


        // -----------------------------------------------------
        // LIVE PRICE (ROUTED BY TOKEN)
        // -----------------------------------------------------

        this.feed.on(
            "price",
            tick => {

                const token =
                    String(
                        tick.token ??
                        this.token
                    );

                const priceState =

                    this.priceStates.get(
                        token
                    ) ||
                    this.priceState;


                const state =
                    priceState.updateTick(
                        tick
                    );

                this.emit(
                    "price",
                    state
                );

                this.emitUpdate();

            }
        );


        // -----------------------------------------------------
        // DISCONNECTED
        // -----------------------------------------------------

        this.feed.on(
            "disconnected",
            reason => {

                for (
                    const ps of this
                        .priceStates
                        .values()
                ) {

                    ps.setConnected(
                        false
                    );

                }

                this.emit(
                    "disconnected",
                    reason
                );

                this.emitUpdate();

            }
        );


        // -----------------------------------------------------
        // ERROR
        // -----------------------------------------------------

        this.feed.on(
            "error",
            error => {

                this.emit(
                    "error",
                    error
                );

            }
        );


        // -----------------------------------------------------
        // AUTH FAILURE (invalid session)
        // -----------------------------------------------------

        this.feed.on(
            "auth-failed",
            error => {

                this.emit(
                    "auth-failed",
                    error
                );

            }
        );


        // -----------------------------------------------------
        // PRICE STATE UPDATE
        // -----------------------------------------------------

        if (
            this.priceState
        ) {

            this.priceState.on(
                "update",
                state => {

                    this.emit(
                        "priceState",
                        state
                    );

                }
            );

        }

    }


    // =========================================================
    // RUNTIME SUBSCRIBE (dynamic symbols)
    // =========================================================

    subscribeTokens(pairs) {

        const subs = [];

        pairs.forEach(({ exch, token }) => {

            const EX = String(exch || this.exchange).toUpperCase();

            const t = String(token);

            if (!this.priceStates.has(t)) {
                this.priceStates.set(
                    t,
                    new LivePriceState({
                        exchange: EX,
                        token: t,
                    })
                );
            }

            /* Back-compat: first ever script becomes the primary */
            if (!this.priceState) {
                this.priceState =
                    this.priceStates.get(t);
            }

            subs.push(EX + "|" + t);
        });

        try {
            this.feed.subscribeTouchline(subs);
        } catch (error) {
            console.error(
                "Runtime subscribe failed:",
                error?.message || error
            );
        }

        this.emitUpdate();
    }

    unsubscribeTokens(pairs) {

        const subs = [];

        pairs.forEach(({ exch, token }) => {

            const EX = String(exch || this.exchange).toUpperCase();

            const t = String(token);

            subs.push(EX + "|" + t);

            /* Removed scripts drop their live state */
            this.priceStates.delete(t);

        });

        /*
         * Reassign the backwards-compatible
         * primary if it was just removed.
         */

        if (
            this.priceState &&
            !this.priceStates.has(
                this.priceState.token
            )
        ) {

            const first =
                this.priceStates
                    .keys()
                    .next();

            this.priceState =
                first.done
                    ? null
                    : this.priceStates.get(
                          first.value
                      );

        }

        try {
            this.feed.unsubscribeTouchline(subs);
        } catch (error) {
            console.error(
                "Runtime unsubscribe failed:",
                error?.message || error
            );
        }
    }


    // =========================================================
    // START
    // =========================================================

    async start() {

        if (this.started) {

            return this.getState();

        }


        await this.feed.connect();


        this.started =
            true;


        return this.getState();
    }
    // =========================================================
    // STOP
    // =========================================================

    async stop() {

        if (!this.started) {
            return;
        }


        await this.feed.disconnect();


        for (
            const ps of this
                .priceStates
                .values()
        ) {

            ps.setConnected(
                false
            );

        }


        this.started =
            false;


        this.emitUpdate();

    }


    // =========================================================
    // CURRENT STATE
    // =========================================================

    getState() {

        const prices = {};


        let anyConnected =
            false;


        for (
            const [
                token,
                ps,
            ] of this.priceStates
        ) {

            const s =
                ps.getState();


            prices[token] =
                s;


            if (s.connected) {
                anyConnected =
                    true;
            }

        }


        return {

            exchange:
                this.exchange,

            token:
                this.token,

            tokens:
                this.tokens,

            started:
                this.started,

            connected:
                anyConnected,

            prices,

            price:
                this.priceState
                    ? this.priceState.getState()
                    : null,

            lastTick:
                this.feed.getLastTick(),

        };
    }


    // =========================================================
    // PRICE
    // =========================================================

    getPrice() {

        return this.priceState
            ? this.priceState.getPrice()
            : null;

    }


    // =========================================================
    // FRESHNESS
    // =========================================================

    isPriceFresh(
        maxAgeMs = 10000
    ) {

        return this.priceState
            ? this.priceState.isFresh(
                  maxAgeMs
              )
            : false;

    }


    // =========================================================
    // EMIT UNIFIED UPDATE
    // =========================================================

    emitUpdate() {

        this.emit(
            "update",
            this.getState()
        );

    }

}


module.exports = {
    LiveMarketState,
};