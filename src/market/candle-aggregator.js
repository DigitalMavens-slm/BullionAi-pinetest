/*
 * =========================================================
 * CANDLE AGGREGATION ENGINE (BACKEND)
 *
 * Converts the live Shoonya touchline stream into
 * per-timeframe OHLCV buckets — independent of any
 * browser being open.
 *
 *   tick -> bucket(floor(ts / tfSec)) -> OHLCV update
 *        -> bucket roll -> persist completed candle
 *
 * Buckets use the same epoch alignment as the stored
 * Shoonya datasets, so aggregated bars slot seamlessly
 * into existing history. Storage is injected, keeping
 * this engine portable to a future database layer.
 * =========================================================
 */


class CandleAggregator {

    constructor({
        instruments,
        timeframes,
        storage,
    }) {

        /*
         * instruments: [{ key, token }]
         * timeframes : ["15m", ...] keys
         * storage    : { upsertCandle(exchange, token, timeframe, candle) }
         */

        this.instruments =
            new Map();

        for (
            const inst of
                instruments
        ) {

            this.instruments.set(
                String(inst.token),
                inst
            );

        }


        this.timeframes =
            timeframes;

        this.storage =
            storage;


        /* forming[token|tf] = candle */

        this.forming =
            new Map();


        /* Cumulative day-volume tracker per token */

        this.lastCumVolume =
            new Map();


        this.stats = {
            ticks: 0,
            updates: 0,
            persisted: 0,
        };

    }



    // =========================================================
    // RUNTIME INSTRUMENT ADDITION (dynamic symbols)
    // =========================================================

    addInstrument(inst) {
        this.instruments.set(
            String(inst.token),
            inst
        );
    }

    // =========================================================
    // RUNTIME INSTRUMENT ADDITION (dynamic symbols)
    // =========================================================

    addInstrument(inst) {
        this.instruments.set(
            String(inst.token),
            inst
        );
    }
    // =========================================================
    // TICK INLET
    // =========================================================

    onTick(tick) {

        if (!tick) return;

        const token =
            String(
                tick.token ?? ""
            );

        const inst =

            this.instruments.get(
                token
            );

        if (!inst) return;


        const price =
            Number(tick.price);

        if (
            !Number.isFinite(price) ||
            price <= 0
        ) {
            return;
        }


        const ts =
            Number(tick.time) ||
            Date.now();


        this.stats.ticks += 1;


        /* ---- usable volume delta ---- */

        let volDelta = 0;

        const cum =
            Number(tick.volume);

        if (
            Number.isFinite(cum)
        ) {

            const prev =

                this.lastCumVolume.get(
                    token
                );

            if (

                typeof prev ===
                    "number" &&
                cum >= prev

            ) {

                volDelta = cum - prev;

            }

            this.lastCumVolume.set(
                token,
                cum
            );

        }


        /* ---- route into every TF ---- */

        for (
            const tf of
                this.timeframes
        ) {

            this.updateBucket({

                token,

                tfSec:
                    tf.seconds,

                tfKey: tf.key,

                exchange:
                    inst.exchange ??
                    "MCX",

                ts,

                price,

                volDelta,

            });

        }

    }


    // =========================================================
    // BUCKET UPDATE
    // =========================================================

    updateBucket({
        token,
        tfSec,
        tfKey,
        exchange,
        ts,
        price,
        volDelta,
    }) {

        const key =
            `${token}|${tfKey}`;


        const bucketMs =

            Math.floor(
                ts /
                    (tfSec * 1000)
            ) *

            tfSec * 1000;


        const forming =

            this.forming.get(key);


        if (

            !forming ||
            bucketMs >
                forming.time

        ) {

            /* Roll: persist completed */

            if (
                forming &&
                forming.final !== false

            ) {

                try {

                    this.storage.upsertCandle(
                        exchange,
                        token,
                        tfKey,
                        forming
                    );

                    this.stats
                        .persisted += 1;

                } catch (err) {

                    console.error(
                        `[aggregator] persist failed ${exchange}_${token}_${tfKey}:`,
                        err.message
                    );

                }

            }


            const fresh = {

                time: bucketMs,

                open: price,

                high: price,

                low: price,

                close: price,

                volume: volDelta,

            };


            this.forming.set(
                key,
                fresh
            );


            this.stats.updates += 1;

            return;

        }


        if (bucketMs < forming.time) {

            /* Late/out-of-order tick — ignore */

            return;

        }


        /* Same bucket — extend */

        if (price > forming.high)

            forming.high = price;

        if (price < forming.low)

            forming.low = price;

        forming.close = price;

        forming.volume += volDelta;

        this.stats.updates += 1;

    }


    // =========================================================
    // FORMING ACCESS
    // =========================================================

    getForming(token, tfKey) {

        const c =

            this.forming.get(
                `${String(token)}|${tfKey}`
            );

        return c
            ? { ...c }
            : null;

    }


    getStats() {

        return {
            ...this.stats,
        };

    }

}


module.exports = {
    CandleAggregator,
};
