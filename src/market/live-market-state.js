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
         */

        this.tokens =
            Array.isArray(
                tokens
            ) && tokens.length
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
         * backwards compatibility.
         */

        this.priceState =
            this.priceStates.get(
                this.token
            );


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
        // PRICE STATE UPDATE
        // -----------------------------------------------------

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


    // =========================================================
    // RUNTIME SUBSCRIBE (dynamic symbols)
    // =========================================================

    subscribeTokens(pairs) {

        const subs = [];

        pairs.forEach(({ exch, token }) => {

            const EX = String(exch || this.exchange).toUpperCase();

            if (!this.priceStates.has(token)) {
                this.priceStates.set(
                    token,
                    new LivePriceState({
                        exchange: EX,
                        token,
                    })
                );
            }

            subs.push(EX + "|" + token);
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

            subs.push(EX + "|" + token);

            /* keep price state; stop is feed-level only */
        });

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
                this.priceState.getState(),

            lastTick:
                this.feed.getLastTick(),

        };
    }


    // =========================================================
    // PRICE
    // =========================================================

    getPrice() {

        return this.priceState.getPrice();

    }


    // =========================================================
    // FRESHNESS
    // =========================================================

    isPriceFresh(
        maxAgeMs = 10000
    ) {

        return this.priceState.isFresh(
            maxAgeMs
        );

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