const EventEmitter = require("events");

const {
    formatISTDateTime,
} = require("../utils/ist-time");


class BullionAIDisplayState extends EventEmitter {

    constructor({
        timeframe = "60m",
    } = {}) {

        super();

        this.timeframe =
            timeframe;

        // =====================================================
        // PINE STATE
        // =====================================================

        this.strategyState =
            null;


        // =====================================================
        // LIVE MARKET STATE
        // =====================================================

        this.marketState =
            null;


        // =====================================================
        // UPDATED
        // =====================================================

        this.updatedAt =
            null;
    }


    // =========================================================
    // SET STRATEGY STATE
    // =========================================================

    setStrategyState(
        strategyState
    ) {

        if (!strategyState) {
            return this.getState();
        }


        /*
         * IMPORTANT:
         *
         * This state comes from PineTS.
         *
         * We do NOT calculate or modify:
         *
         * signal
         * status
         * entryPrice
         * trailSL
         * currentPL
         * bestPL
         * realizedPL
         *
         * here.
         */

        this.strategyState =
            {
                ...strategyState,
            };


        this.updatedAt =
            Date.now();


        this.emitUpdate();


        return this.getState();
    }


    // =========================================================
    // SET LIVE MARKET STATE
    // =========================================================

    setMarketState(
        marketState
    ) {

        if (!marketState) {
            return this.getState();
        }


        /*
         * Live market state is read-only display data.
         *
         * It must never modify Pine state.
         */

        this.marketState =
            {
                ...marketState,
            };


        this.updatedAt =
            Date.now();


        this.emitUpdate();


        return this.getState();
    }


    // =========================================================
    // CURRENT PRICE
    // =========================================================

    getCurrentPrice() {

        return (
            this.marketState
                ?.price
                ?.price ??
            null
        );
    }


    // =========================================================
    // LIVE CONNECTION
    // =========================================================

    isMarketConnected() {

        return Boolean(
            this.marketState
                ?.connected
        );
    }


    // =========================================================
    // STRATEGY AVAILABLE
    // =========================================================

    isStrategyAvailable() {

        return Boolean(
            this.strategyState
        );
    }


    // =========================================================
    // BUILD DISPLAY STATE
    // =========================================================

    getState() {

        const strategy =
            this.strategyState;


        const market =
            this.marketState;


        return {

            // =================================================
            // SYSTEM
            // =================================================

            timeframe:
                this.timeframe,

            updatedAt:
                this.updatedAt,

            updatedAtIST:
                formatISTDateTime(
                    this.updatedAt
                ),


            // =================================================
            // STRATEGY
            //
            // EXACTLY AS PROVIDED BY PINETS
            // =================================================

            strategy: {

                available:
                    Boolean(
                        strategy
                    ),

                signal:
                    strategy?.signal ??
                    null,

                status:
                    strategy?.status ??
                    null,

                entryPrice:
                    strategy?.entryPrice ??
                    null,

                trailSL:
                    strategy?.trailSL ??
                    null,

                extremeLabel:
                    strategy?.extremeLabel ??
                    null,

                extremePrice:
                    strategy?.extremePrice ??
                    null,

                currentPL:
                    strategy?.currentPL ??
                    null,

                bestPL:
                    strategy?.bestPL ??
                    null,

                realizedPL:
                    strategy?.realizedPL ??
                    null,

                entryTime:
                    strategy?.entryTime ??
                    null,

                entryTimeIST:
                    formatISTDateTime(
                        strategy?.entryTime
                    ),

                exitTime:
                    strategy?.exitTime ??
                    null,

                exitTimeIST:
                    formatISTDateTime(
                        strategy?.exitTime
                    ),

                currentCandle:
                    strategy?.currentCandle ??
                    null,

                candleCount:
                    strategy?.candleCount ??
                    0,

                lastCandleTime:
                    strategy?.lastCandleTime ??
                    null,

                lastCandleTimeIST:
                    formatISTDateTime(
                        strategy?.lastCandleTime
                    ),

            },


            // =================================================
            // LIVE MARKET
            //
            // DIRECTLY FROM WEBSOCKET
            // =================================================

            market: {

                connected:
                    Boolean(
                        market?.connected
                    ),

                price:
                    market?.price?.price ??
                    null,

                previousPrice:
                    market?.price?.previousPrice ??
                    null,

                change:
                    market?.price?.change ??
                    null,

                changePercent:
                    market?.price?.changePercent ??
                    null,

                tickCount:
                    market?.price?.tickCount ??
                    0,

                tickTime:
                    market?.price?.tickTime ??
                    null,

                tickTimeIST:
                    formatISTDateTime(
                        market?.price?.tickTime
                    ),

                receivedAt:
                    market?.price?.receivedAt ??
                    null,

                receivedAtIST:
                    formatISTDateTime(
                        market?.price?.receivedAt
                    ),

                lastTick:
                    market?.lastTick ??
                    null,

            },

        };
    }


    // =========================================================
    // EMIT
    // =========================================================

    emitUpdate() {

        this.emit(
            "update",
            this.getState()
        );

    }


    // =========================================================
    // RESET
    // =========================================================

    reset() {

        this.strategyState =
            null;

        this.marketState =
            null;

        this.updatedAt =
            null;


        this.emitUpdate();

    }

}


module.exports = {
    BullionAIDisplayState,
};
