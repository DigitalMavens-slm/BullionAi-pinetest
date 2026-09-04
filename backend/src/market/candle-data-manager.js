const fs = require("fs");
const path = require("path");

const {
    getTimeframe,
} = require("../config/timeframe-config");

class CandleDataManager {
    constructor({
        dataDirectory = "./data",
        exchange = "MCX",
        token = "483079",
    } = {}) {
        this.projectRoot =
            process.cwd();

        this.dataDirectory =
            path.resolve(
                this.projectRoot,
                dataDirectory
            );

        this.exchange =
            exchange;

        this.token =
            token;

        // Make sure data directory exists.
        fs.mkdirSync(
            this.dataDirectory,
            {
                recursive: true,
            }
        );
    }

    // =========================================================
    // TIMEFRAME FILE
    // =========================================================

    getFileName(timeframe) {
        const config =
            getTimeframe(
                timeframe
            );

        return (
            `${this.exchange}_` +
            `${this.token}_` +
            `${config.key}.json`
        );
    }

    // =========================================================
    // FULL FILE PATH
    // =========================================================

    getFilePath(timeframe) {
        return path.join(
            this.dataDirectory,
            this.getFileName(
                timeframe
            )
        );
    }

    // =========================================================
    // LOAD CANDLES
    // =========================================================

    load(timeframe) {
        const filePath =
            this.getFilePath(
                timeframe
            );

        if (
            !fs.existsSync(
                filePath
            )
        ) {
            return [];
        }

        const candles =
            JSON.parse(
                fs.readFileSync(
                    filePath,
                    "utf8"
                )
            );

        if (!Array.isArray(candles)) {
            throw new Error(
                `Invalid candle dataset: ${filePath}`
            );
        }

        return candles;
    }

    // =========================================================
    // SAVE CANDLES
    // =========================================================

    save(
        timeframe,
        candles
    ) {
        if (
            !Array.isArray(candles)
        ) {
            throw new Error(
                "Candles must be an array."
            );
        }

        const filePath =
            this.getFilePath(
                timeframe
            );

        fs.writeFileSync(
            filePath,
            JSON.stringify(
                candles,
                null,
                2
            ),
            "utf8"
        );

        return filePath;
    }

    // =========================================================
    // GET DATASET INFO
    // =========================================================

    getInfo(timeframe) {
        const config =
            getTimeframe(
                timeframe
            );

        const filePath =
            this.getFilePath(
                timeframe
            );

        const candles =
            this.load(
                timeframe
            );

        return {
            timeframe:
                config.key,

            label:
                config.label,

            interval:
                config.interval,

            seconds:
                config.seconds,

            exchange:
                this.exchange,

            token:
                this.token,

            fileName:
                this.getFileName(
                    timeframe
                ),

            filePath,

            exists:
                fs.existsSync(
                    filePath
                ),

            candleCount:
                candles.length,

            firstCandle:
                candles.length
                    ? candles[0].time
                    : null,

            lastCandle:
                candles.length
                    ? candles[
                          candles.length - 1
                      ].time
                    : null,
        };
    }

    // =========================================================
    // UPSERT SINGLE CANDLE
    //
    // Timestamp is the unique key. Merge, dedupe,
    // sort ascending, persist. Never drops existing
    // valid history on failure.
    // =========================================================

    upsertCandle(
        timeframe,
        candle
    ) {
        if (
            !candle ||
            !Number.isFinite(
                Number(candle.time)
            )
        ) {
            throw new Error(
                "Invalid candle for upsert."
            );
        }


        const candles =
            this.load(timeframe);


        const time =
            Number(candle.time);

        const idx = candles.findIndex(
            c =>
                Number(c.time) ===
                    time
        );

        let replaced = false;

        if (idx >= 0) {

            candles[idx] = {

                ...candles[idx],

                ...candle,

                time,

            };

            replaced = true;

        } else {

            candles.push({
                ...candle,
                time,
            });

        }


        candles.sort(
            (a, b) =>
                a.time - b.time
        );


        this.save(
            timeframe,
            candles
        );


        return {
            replaced,

            total: candles.length,
        };

    }

    // =========================================================
    // LIST DATASETS
    // =========================================================

    listDatasets() {
        return fs
            .readdirSync(
                this.dataDirectory
            )
            .filter(
                file =>
                    file.endsWith(
                        ".json"
                    )
            )
            .map(
                file => ({
                    fileName:
                        file,

                    filePath:
                        path.join(
                            this.dataDirectory,
                            file
                        ),
                })
            );
    }
}

module.exports = {
    CandleDataManager,
};