const EventEmitter = require("events");


class BullionAILiveDisplayController extends EventEmitter {

    constructor({
        coordinator,
    } = {}) {

        super();

        if (!coordinator) {
            throw new Error(
                "BullionAILiveCoordinator is required."
            );
        }

        this.coordinator =
            coordinator;

        this.running =
            false;

        this.lastState =
            null;

        this.bindEvents();
    }


    // =========================================================
    // BIND COORDINATOR EVENTS
    // =========================================================

    bindEvents() {

        this.coordinator.on(
            "update",
            state => {

                this.lastState =
                    state;

                this.emit(
                    "update",
                    state
                );

            }
        );


        this.coordinator.on(
            "market-connected",
            () => {

                this.emit(
                    "market-connected"
                );

            }
        );


        this.coordinator.on(
            "market-disconnected",
            reason => {

                this.emit(
                    "market-disconnected",
                    reason
                );

            }
        );


        this.coordinator.on(
            "market-error",
            error => {

                this.emit(
                    "market-error",
                    error
                );

            }
        );
    }


    // =========================================================
    // START
    // =========================================================

    async start() {

        if (this.running) {

            return this.getState();

        }


        this.running =
            true;


        const state =
            await this.coordinator.start();


        this.lastState =
            state;


        this.emit(
            "update",
            state
        );


        return state;
    }


    // =========================================================
    // GET CURRENT STATE
    // =========================================================

    getState() {

        if (this.lastState) {

            return this.lastState;

        }


        return this.coordinator.getState();
    }


    // =========================================================
    // GET LIVE PRICE
    // =========================================================

    getLivePrice() {

        return (
            this.getState()
                ?.market
                ?.price ??
            null
        );
    }


    // =========================================================
    // GET PINE TRAIL SL
    // =========================================================

    getPineTrailSL() {

        return (
            this.getState()
                ?.strategy
                ?.trailSL ??
            null
        );
    }


    // =========================================================
    // GET PINE SIGNAL
    // =========================================================

    getPineSignal() {

        return (
            this.getState()
                ?.strategy
                ?.signal ??
            null
        );
    }


    // =========================================================
    // GET STRATEGY STATUS
    // =========================================================

    getStrategyStatus() {

        return (
            this.getState()
                ?.strategy
                ?.status ??
            null
        );
    }


    // =========================================================
    // MARKET CONNECTED
    // =========================================================

    isMarketConnected() {

        return Boolean(
            this.getState()
                ?.market
                ?.connected
        );
    }


    // =========================================================
    // LIVE TICK COUNT
    // =========================================================

    getTickCount() {

        return (
            this.getState()
                ?.market
                ?.tickCount ??
            0
        );
    }


    // =========================================================
    // STOP
    // =========================================================

    async stop() {

        if (!this.running) {
            return;
        }


        await this.coordinator.stop();


        this.running =
            false;

    }
}


module.exports = {
    BullionAILiveDisplayController,
};