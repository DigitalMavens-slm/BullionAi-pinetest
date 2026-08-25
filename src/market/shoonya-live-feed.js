const {
    ShoonyaWebSocket,
} = require("shoonya-api-js");

const EventEmitter = require("events");

const {
    formatISTDateTime,
} = require("../utils/ist-time");


class ShoonyaLiveFeed extends EventEmitter {

    constructor({
        marketDataService,
        exchange = "MCX",
        token = "483079",
        tokens = null,
        reconnect = true,
        reconnectDelay = 3000,
    }) {

        super();

        if (!marketDataService) {
            throw new Error(
                "MarketDataService is required."
            );
        }

        this.market =
            marketDataService;

        this.exchange =
            exchange;

        /*
         * Primary token kept for
         * backwards compatibility.
         */

        this.token =
            String(token);

        /*
         * One WebSocket can subscribe
         * to many touchlines.
         */

        this.tokens =
            Array.isArray(
                tokens
            ) && tokens.length
                ? tokens.map(t =>
                      String(t)
                  )
                : [this.token];

        this.subscriptions =
            this.tokens.map(
                t =>
                    `${this.exchange}|${t}`
            );

        this.subscription =
            this.subscriptions[0];

        this.reconnect =
            reconnect;

        this.reconnectDelay =
            reconnectDelay;

        this.socket =
            null;

        this.connected =
            false;

        this.subscribed =
            false;

        this.lastTick =
            null;
    }


    // =========================================================
    // CONNECT
    // =========================================================

    async connect() {

        if (this.connected) {

            console.log(
                "Shoonya live feed already connected."
            );

            return;
        }


        if (
            !this.market.isAuthenticated()
        ) {

            throw new Error(
                "Shoonya authentication is required before starting live feed."
            );

        }


        console.log("");

        console.log(
            "===================================="
        );

        console.log(
            "       SHOONYA LIVE FEED"
        );

        console.log(
            "===================================="
        );

        for (
            const sub of this
                .subscriptions
        ) {

            console.log(
                "Subscription:",
                sub
            );

        }

        console.log(
            "Connecting WebSocket..."
        );


        // =====================================================
        // SHOONYA WEBSOCKET
        // =====================================================

        this.socket =
            new ShoonyaWebSocket(
                this.market.client,
                {
                    reconnect:
                        this.reconnect,

                    reconnectDelay:
                        this.reconnectDelay,
                }
            );


        // =====================================================
        // CONNECTED
        // =====================================================

        this.socket.on(
            "connected",
            message => {

                this.connected =
                    true;

                console.log(
                    "Shoonya WebSocket connected."
                );

                console.log(
                    "Subscribing:",
                    this.subscription
                );

                try {

                    this.subscribe();

                } catch (
                    error
                ) {

                    console.error(
                        "Shoonya subscription error:",
                        error?.message ||
                        error
                    );

                    this.emit(
                        "error",
                        error
                    );

                    return;
                }


                this.emit(
                    "connected",
                    message
                );

            }
        );


        // =====================================================
        // TOUCHLINE
        //
        // IMPORTANT:
        // shoonya-api-js emits live market data through
        // the "touchline" event.
        // =====================================================

        this.socket.on(
            "touchline",
            tick => {

                this.handleTick(
                    tick
                );

            }
        );


        // =====================================================
        // DEPTH
        //
        // We don't currently need depth for the strategy,
        // but keep the event available for future UI features.
        // =====================================================

        this.socket.on(
            "depth",
            tick => {

                this.emit(
                    "depth",
                    tick
                );

            }
        );


        // =====================================================
        // ERROR
        // =====================================================

        this.socket.on(
            "error",
            error => {

                console.error(
                    "Shoonya WebSocket error:",
                    error?.message ||
                    error
                );

                this.emit(
                    "error",
                    error
                );

            }
        );


        // =====================================================
        // CLOSE
        //
        // Current shoonya-api-js uses "close".
        // Keep "disconnected" as our application-level event.
        // =====================================================

        this.socket.on(
            "close",
            reason => {

                this.connected =
                    false;

                this.subscribed =
                    false;

                console.log(
                    "Shoonya WebSocket disconnected."
                );

                if (reason) {

                    console.log(
                        "Reason:",
                        reason
                    );

                }

                this.emit(
                    "disconnected",
                    reason
                );

            }
        );


        // =====================================================
        // BACKWARD COMPATIBILITY
        //
        // Some versions/wrappers may emit "disconnected".
        // =====================================================

        this.socket.on(
            "disconnected",
            reason => {

                this.connected =
                    false;

                this.subscribed =
                    false;

                console.log(
                    "Shoonya WebSocket disconnected."
                );

                this.emit(
                    "disconnected",
                    reason
                );

            }
        );


        // =====================================================
        // CONNECT SOCKET
        // =====================================================

        await this.socket.connect();

    }


    // =========================================================
    // SUBSCRIBE
    // =========================================================

    subscribeTouchline(tokens) {

        if (!this.socket) {
            throw new Error(
                "Shoonya WebSocket is not initialized."
            );
        }

        // Merge into persistent subscription list for reconnects
        const toAdd = Array.isArray(tokens) ? tokens : [tokens];
        for (const t of toAdd) {
            if (!this.subscriptions.includes(t)) {
                this.subscriptions.push(t);
            }
        }

        this.socket.subscribeTouchline(toAdd);

        console.log(
            "Live touchline subscribe (dynamic):",
            toAdd.join(", ")
        );
    }

    unsubscribeTouchline(tokens) {

        if (!this.socket) return;

        const toRemove = Array.isArray(tokens) ? tokens : [tokens];
        this.subscriptions = this.subscriptions.filter(
            s => !toRemove.includes(s)
        );

        try {
            this.socket.unsubscribeTouchline(toRemove);
        } catch {}

        console.log(
            "Live touchline unsubscribe (dynamic):",
            toRemove.join(", ")
        );
    }

    subscribe() {

        if (!this.socket) {

            throw new Error(
                "Shoonya WebSocket is not initialized."
            );

        }


        this.socket.subscribeTouchline(
            this.subscriptions
        );


        this.subscribed =
            true;


        console.log(
            "Live touchline subscriptions active:",
            this.subscriptions.join(", ")
        );

    }


    // =========================================================
    // HANDLE TOUCHLINE
    // =========================================================

    handleTick(tick) {

        if (!tick) {
            return;
        }


        const normalized =
            this.normalizeTick(
                tick
            );


        if (!normalized) {

            console.log(
                "Shoonya touchline received without valid price."
            );

            return;
        }


        this.lastTick =
            normalized;


        // -----------------------------------------------------
        // APPLICATION EVENTS
        // -----------------------------------------------------

        this.emit(
            "price",
            normalized
        );


        this.emit(
            "tick",
            normalized
        );


        console.log("");

        console.log(
            "------------------------------------"
        );

        console.log(
            "LIVE TICK"
        );

        console.log(
            "Exchange:",
            normalized.exchange
        );

        console.log(
            "Token:",
            normalized.token
        );

        console.log(
            "Price:",
            normalized.price
        );

        console.log(
            "Time:",
            formatISTDateTime(
                normalized.time
            )
        );

        console.log(
            "------------------------------------"
        );

    }


    // =========================================================
    // NORMALIZE TOUCHLINE
    // =========================================================

    normalizeTick(tick) {

        /*
         * Shoonya touchline fields:
         *
         * lp = last traded price
         * e  = exchange
         * tk = token
         * ft = feed timestamp
         *
         * The SDK documentation confirms touchline
         * messages use the "lp" field for LTP.
         */


        const price =
            Number(
                tick.lp ??
                tick.ltp ??
                tick.lastPrice
            );


        if (
            !Number.isFinite(
                price
            )
        ) {

            return null;

        }


        const exchange =
            tick.e ||
            this.exchange;


        const token =
            tick.tk ||
            this.token;


        const feedTime =
            Number(
                tick.ft
            );


        const time =
            Number.isFinite(
                feedTime
            ) &&
            feedTime > 0

                ? feedTime * 1000

                : Date.now();


        return {

            exchange:
                String(
                    exchange
                ),

            token:
                String(
                    token
                ),

            price,

            time,

            feedTime:
                Number.isFinite(
                    feedTime
                )
                    ? feedTime
                    : null,

            changePercent:
                this.toNumber(
                    tick.pc
                ),

            volume:
                this.toNumber(
                    tick.v
                ),

            open:
                this.toNumber(
                    tick.o
                ),

            high:
                this.toNumber(
                    tick.h
                ),

            low:
                this.toNumber(
                    tick.l
                ),

            close:
                this.toNumber(
                    tick.c
                ),

            averagePrice:
                this.toNumber(
                    tick.ap
                ),

            bestBid:
                this.toNumber(
                    tick.bp1
                ),

            bestAsk:
                this.toNumber(
                    tick.sp1
                ),

            raw:
                tick,

        };

    }


    // =========================================================
    // NUMBER HELPER
    // =========================================================

    toNumber(value) {

        if (
            value === null ||
            value === undefined ||
            value === ""
        ) {

            return null;

        }


        const number =
            Number(value);


        return Number.isFinite(
            number
        )
            ? number
            : null;

    }


    // =========================================================
    // LAST TICK
    // =========================================================

    getLastTick() {

        return this.lastTick;

    }


    // =========================================================
    // CONNECTION STATUS
    // =========================================================

    isConnected() {

        return this.connected;

    }


    // =========================================================
    // SUBSCRIPTION STATUS
    // =========================================================

    isSubscribed() {

        return this.subscribed;

    }


    // =========================================================
    // DISCONNECT
    // =========================================================

    async disconnect() {

        if (!this.socket) {
            return;
        }


        console.log(
            "Disconnecting Shoonya live feed..."
        );


        try {

            this.socket.unsubscribeTouchline(
                this.subscriptions
            );

        } catch {
            // Ignore unsubscribe errors.
        }


        try {

            await this.socket.disconnect();

        } catch (
            error
        ) {

            console.error(
                "WebSocket disconnect error:",
                error?.message ||
                error
            );

        }


        this.connected =
            false;

        this.subscribed =
            false;

        this.socket =
            null;

    }

}


module.exports = {
    ShoonyaLiveFeed,
};
