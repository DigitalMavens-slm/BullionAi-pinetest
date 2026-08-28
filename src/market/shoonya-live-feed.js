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
         * to many touchlines. An explicit
         * empty array is allowed: scripts
         * are added at runtime via the
         * search box.
         */

        this.tokens =
            Array.isArray(
                tokens
            )
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
            this.subscriptions[0] ??
            null;

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

        /*
         * Set when Shoonya rejects our
         * credentials; blocks auto-reconnect
         * until a fresh session is installed.
         */

        this.authFailed =
            false;
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


        if (
            this.authFailed
        ) {

            throw new Error(
                "Shoonya rejected the current session; re-authentication is required before connecting."
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

                if (
                    this.subscription
                ) {

                    console.log(
                        "Subscribing:",
                        this.subscription
                    );

                }

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

                const message =
                    error?.message ||
                    String(error);

                if (
                    this.isAuthFailureMessage(
                        message
                    )
                ) {

                    this.handleSocketAuthFailure(
                        error
                    );

                    return;

                }

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
    // AUTH FAILURE DETECTION
    // =========================================================

    isAuthFailureMessage(message) {

        return /websocket auth failed|not_?ok|http 40[13]|unauthorized/i.test(
            String(message || "")
        );

    }


    // =========================================================
    // SOCKET AUTH FAILURE
    //
    // Shoonya rejected our token. Tear the
    // socket down (which also stops the SDK's
    // internal reconnect timer) and surface an
    // "auth-failed" event so the app can run
    // one shared re-authentication flow instead
    // of looping on a dead session.
    // =========================================================

    handleSocketAuthFailure(error) {

        if (
            this.authFailed
        ) {
            return;
        }

        this.authFailed =
            true;

        console.log("");

        console.log(
            "Shoonya WebSocket authentication failed:",
            error?.message || error
        );

        console.log(
            "Stopping live feed reconnect attempts for the invalid session."
        );

        this.disconnect()
            .catch(() => {});

        this.emit(
            "auth-failed",
            error
        );

    }


    // =========================================================
    // RECONNECT WITH CURRENT SESSION
    //
    // Used after successful re-authentication.
    // The SDK reads the session from the client
    // on every socket open, so once the fresh
    // token is applied this reconnects with it.
    //
    // NOTE: deliberately NOT named "reconnect()"
    // — the constructor stores its SDK auto-
    // reconnect flag under that exact name.
    // =========================================================

    async reconnectWithCurrentSession() {

        if (
            !this.market.isAuthenticated()
        ) {

            throw new Error(
                "Shoonya authentication is required before reconnecting the live feed."
            );

        }

        this.authFailed =
            false;

        await this.disconnect();

        await this.connect();

    }


    // =========================================================
    // SUBSCRIBE
    // =========================================================

    subscribeTouchline(tokens) {

        // Merge into persistent subscription list for reconnects
        const toAdd = Array.isArray(tokens) ? tokens : [tokens];
        for (const t of toAdd) {
            if (!this.subscriptions.includes(t)) {
                this.subscriptions.push(t);
            }
        }

        /*
         * Socket may not exist yet (script added
         * before the WebSocket connects): the
         * merged list above is replayed on
         * connect, so just skip the live send.
         */

        if (!this.socket) {
            return;
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


        /*
         * Nothing subscribed yet (search-box-only
         * flow): skip sending an empty subscribe
         * frame; dynamic adds arrive via
         * subscribeTouchline().
         */

        if (
            this.subscriptions.length ===
            0
        ) {
            return;
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
