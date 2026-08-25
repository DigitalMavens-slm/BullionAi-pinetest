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
        // PRICE CHANGE
        // -----------------------------------------------------

        if (
            previousPrice !== null
        ) {

            this.state.change =
                price -
                previousPrice;

        } else {

            this.state.change =
                null;

        }


        // -----------------------------------------------------
        // PERCENT CHANGE
        // -----------------------------------------------------

        if (
            previousPrice !== null &&
            previousPrice !== 0
        ) {

            this.state.changePercent =
                (
                    (
                        price -
                        previousPrice
                    ) /
                    previousPrice
                ) *
                100;

        } else {

            this.state.changePercent =
                null;

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