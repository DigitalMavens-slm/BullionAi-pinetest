class StrategyStateEngine {
    constructor({
        tickSize = 1,
    } = {}) {
        this.tickSize =
            Number(tickSize) > 0
                ? Number(tickSize)
                : 1;

        this.state = {
            signal: null,
            status: "CLOSED",

            entryPrice: null,
            currentPrice: null,

            trailSL: null,

            extremeLabel: null,
            extremePrice: null,

            currentPL: null,
            bestPL: null,
            realizedPL: null,

            entryTime: null,
            exitTime: null,

            lastUpdateTime: null,
        };
    }

    // =========================================================
    // LOAD PINE STRATEGY STATE
    // =========================================================

    loadStrategyState(strategyState) {
        if (!strategyState) {
            throw new Error(
                "Strategy state is required."
            );
        }

        this.state = {
            ...this.state,

            signal:
                strategyState.signal ??
                this.state.signal,

            status:
                strategyState.status ??
                this.state.status,

            entryPrice:
                this.toNumber(
                    strategyState.entryPrice
                ),

            trailSL:
                this.toNumber(
                    strategyState.trailSL
                ),

            extremeLabel:
                strategyState.extremeLabel ??
                null,

            extremePrice:
                this.toNumber(
                    strategyState.extremePrice
                ),

            currentPL:
                this.toNumber(
                    strategyState.currentPL
                ),

            bestPL:
                this.toNumber(
                    strategyState.bestPL
                ),

            realizedPL:
                this.toNumber(
                    strategyState.realizedPL
                ),

            entryTime:
                strategyState.entryTime ??
                null,

            exitTime:
                strategyState.exitTime ??
                null,
        };

        if (
            strategyState.currentCandle?.close !==
            undefined
        ) {
            this.state.currentPrice =
                this.toNumber(
                    strategyState.currentCandle.close
                );
        }

        return this.getState();
    }

    // =========================================================
    // UPDATE LIVE PRICE
    // =========================================================

    updatePrice(price, time = Date.now()) {
        const currentPrice =
            this.toNumber(price);

        if (
            currentPrice === null
        ) {
            throw new Error(
                "Invalid live price."
            );
        }

        this.state.currentPrice =
            currentPrice;

        this.state.lastUpdateTime =
            time;

        // -----------------------------------------------------
        // Only an OPEN strategy state is managed.
        // -----------------------------------------------------

        if (
            String(
                this.state.status
            ).toUpperCase() !==
            "OPEN"
        ) {
            return this.getState();
        }

        if (
            this.state.entryPrice === null
        ) {
            return this.getState();
        }

        // -----------------------------------------------------
        // BUY
        // -----------------------------------------------------

        if (
            String(
                this.state.signal
            ).toUpperCase() ===
            "BUY"
        ) {
            this.updateLongState(
                currentPrice
            );
        }

        // -----------------------------------------------------
        // SELL
        // -----------------------------------------------------

        else if (
            String(
                this.state.signal
            ).toUpperCase() ===
            "SELL"
        ) {
            this.updateShortState(
                currentPrice
            );
        }

        // -----------------------------------------------------
        // P/L
        // -----------------------------------------------------

        this.updatePL(
            currentPrice
        );

        // -----------------------------------------------------
        // IMPORTANT:
        //
        // This is DISPLAY/SIMULATION state only.
        // No Shoonya order is sent.
        // -----------------------------------------------------

        this.checkTrailingStop(
            currentPrice,
            time
        );

        return this.getState();
    }

    // =========================================================
    // BUY STATE
    // =========================================================

    updateLongState(price) {
        const previousExtreme =
            this.state.extremePrice;

        if (
            previousExtreme === null ||
            price > previousExtreme
        ) {
            this.state.extremePrice =
                price;

            this.state.extremeLabel =
                "Highest";
        }
    }

    // =========================================================
    // SELL STATE
    // =========================================================

    updateShortState(price) {
        const previousExtreme =
            this.state.extremePrice;

        if (
            previousExtreme === null ||
            price < previousExtreme
        ) {
            this.state.extremePrice =
                price;

            this.state.extremeLabel =
                "Lowest";
        }
    }

    // =========================================================
    // P/L
    // =========================================================

    updatePL(price) {
        const entry =
            this.state.entryPrice;

        if (
            entry === null
        ) {
            return;
        }

        const signal =
            String(
                this.state.signal
            ).toUpperCase();

        let pl;

        if (
            signal === "BUY"
        ) {
            pl =
                price -
                entry;
        }

        else if (
            signal === "SELL"
        ) {
            pl =
                entry -
                price;
        }

        else {
            return;
        }

        this.state.currentPL =
            this.round(
                pl
            );

        if (
            this.state.bestPL === null ||
            pl > this.state.bestPL
        ) {
            this.state.bestPL =
                this.round(
                    pl
                );
        }
    }

    // =========================================================
    // TRAILING STOP CHECK
    // =========================================================

    checkTrailingStop(
        price,
        time
    ) {
        const stop =
            this.state.trailSL;

        if (
            stop === null
        ) {
            return false;
        }

        const signal =
            String(
                this.state.signal
            ).toUpperCase();

        // -----------------------------------------------------
        // BUY
        // -----------------------------------------------------

        if (
            signal === "BUY" &&
            price <= stop
        ) {
            this.closeSimulation(
                price,
                time
            );

            return true;
        }

        // -----------------------------------------------------
        // SELL
        // -----------------------------------------------------

        if (
            signal === "SELL" &&
            price >= stop
        ) {
            this.closeSimulation(
                price,
                time
            );

            return true;
        }

        return false;
    }

    // =========================================================
    // SIMULATED CLOSE
    // =========================================================

    closeSimulation(
        exitPrice,
        time
    ) {
        this.state.currentPrice =
            exitPrice;

        this.updatePL(
            exitPrice
        );

        this.state.realizedPL =
            this.state.currentPL;

        this.state.status =
            "CLOSED";

        this.state.exitTime =
            time;

        this.state.lastUpdateTime =
            time;
    }

    // =========================================================
    // RESET
    // =========================================================

    reset() {
        this.state = {
            signal: null,
            status: "CLOSED",

            entryPrice: null,
            currentPrice: null,

            trailSL: null,

            extremeLabel: null,
            extremePrice: null,

            currentPL: null,
            bestPL: null,
            realizedPL: null,

            entryTime: null,
            exitTime: null,

            lastUpdateTime: null,
        };

        return this.getState();
    }

    // =========================================================
    // GET STATE
    // =========================================================

    getState() {
        return {
            ...this.state,
        };
    }

    // =========================================================
    // NUMBER
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

        return Number.isFinite(number)
            ? number
            : null;
    }

    // =========================================================
    // ROUND
    // =========================================================

    round(value) {
        if (
            !Number.isFinite(
                value
            )
        ) {
            return null;
        }

        return (
            Math.round(
                value /
                this.tickSize
            ) *
            this.tickSize
        );
    }
}


module.exports = {
    StrategyStateEngine,
};