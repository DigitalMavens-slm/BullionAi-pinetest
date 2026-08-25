const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const {
    PineIntegrity,
} = require("../security/pine-integrity");


class StrategyEngine {

    constructor({
        strategyFile = "BullionAI.pine",
        candlesFile = "candles.json",
        resultsFile = "results.json",
    } = {}) {

        this.projectRoot =
            process.cwd();

        this.strategyFile =
            path.resolve(
                this.projectRoot,
                strategyFile
            );

        this.candlesFile =
            path.resolve(
                this.projectRoot,
                candlesFile
            );

        this.resultsFile =
            path.resolve(
                this.projectRoot,
                resultsFile
            );


        // =====================================================
        // PINE INTEGRITY
        // =====================================================

        this.pineIntegrity =
            new PineIntegrity({
                strategyFile:
                    this.strategyFile,

                hashFile:
                    "data/bullionai-pine-integrity.json",
            });
    }


    // =========================================================
    // LOAD CANDLES
    // =========================================================

    loadCandles() {

        if (
            !fs.existsSync(
                this.candlesFile
            )
        ) {

            throw new Error(
                `Candles file not found: ${this.candlesFile}`
            );

        }


        const candles =
            JSON.parse(
                fs.readFileSync(
                    this.candlesFile,
                    "utf8"
                )
            );


        if (
            !Array.isArray(
                candles
            )
        ) {

            throw new Error(
                "Candles file must contain an array."
            );

        }


        return candles;
    }


    // =========================================================
    // PATH FOR PINETS CLI
    // =========================================================

    getCliPath(
        absolutePath
    ) {

        let relativePath =
            path.relative(
                this.projectRoot,
                absolutePath
            );


        if (!relativePath) {

            relativePath =
                path.basename(
                    absolutePath
                );

        }


        // -----------------------------------------------------
        // Node/PineTS command line works better with forward
        // slashes on Windows.
        // -----------------------------------------------------

        relativePath =
            relativePath.replace(
                /\\/g,
                "/"
            );


        return relativePath;
    }


    // =========================================================
    // EXECUTE PINETS
    // =========================================================

    execute() {

        // -----------------------------------------------------
        // PINE INTEGRITY
        //
        // BullionAI.pine remains the ONLY strategy source.
        // -----------------------------------------------------

        console.log(
            "Verifying Pine strategy integrity..."
        );


        const integrity =
            this.pineIntegrity.requireValid();


        console.log(
            "Pine strategy integrity verified."
        );


        console.log(
            "SHA256:",
            integrity.currentHash
        );


        // -----------------------------------------------------
        // STRATEGY FILE
        // -----------------------------------------------------

        if (
            !fs.existsSync(
                this.strategyFile
            )
        ) {

            throw new Error(
                `Strategy file not found: ${this.strategyFile}`
            );

        }


        // -----------------------------------------------------
        // CANDLES FILE
        // -----------------------------------------------------

        if (
            !fs.existsSync(
                this.candlesFile
            )
        ) {

            throw new Error(
                `Candles file not found: ${this.candlesFile}`
            );

        }


        // -----------------------------------------------------
        // LOAD INPUT FOR VALIDATION
        // -----------------------------------------------------

        const candles =
            this.loadCandles();


        if (
            candles.length === 0
        ) {

            throw new Error(
                `Candles file contains zero candles: ${this.candlesFile}`
            );

        }


        // -----------------------------------------------------
        // CLI PATHS
        // -----------------------------------------------------

        const strategyPath =
            this.getCliPath(
                this.strategyFile
            );

        const candlesPath =
            this.getCliPath(
                this.candlesFile
            );

        const resultsPath =
            this.getCliPath(
                this.resultsFile
            );


        // -----------------------------------------------------
        // DELETE OLD RESULT
        //
        // This prevents us from accidentally reading a stale
        // result file if PineTS fails to generate a new one.
        // -----------------------------------------------------

        if (
            fs.existsSync(
                this.resultsFile
            )
        ) {

            fs.unlinkSync(
                this.resultsFile
            );

        }


        console.log("");

        console.log(
            "Executing BullionAI strategy..."
        );

        console.log(
            "Strategy file:",
            this.strategyFile
        );

        console.log(
            "Data source:",
            this.candlesFile
        );

        console.log(
            "Candle count:",
            candles.length
        );

        console.log(
            "Results file:",
            this.resultsFile
        );


        // -----------------------------------------------------
        // IMPORTANT
        //
        // The actual Pine file is still executed unchanged.
        //
        // We are ONLY changing the input/output paths.
        //
        // NO Pine logic is duplicated here.
        // -----------------------------------------------------

        const command =
            [
                "npx",
                "pinets-cli",
                "run",
                `"${strategyPath}"`,
                "--data",
                `"${candlesPath}"`,
                "--pretty",
                "--output",
                `"${resultsPath}"`,
            ].join(" ");


        execSync(
            command,
            {
                cwd:
                    this.projectRoot,

                stdio:
                    "inherit",

                windowsHide:
                    true,
            }
        );


        // -----------------------------------------------------
        // VERIFY RESULT
        // -----------------------------------------------------

        if (
            !fs.existsSync(
                this.resultsFile
            )
        ) {

            throw new Error(
                [
                    "PineTS execution completed but results file was not created.",
                    "",
                    `Expected: ${this.resultsFile}`,
                    `Strategy: ${this.strategyFile}`,
                    `Data: ${this.candlesFile}`,
                    `Candles: ${candles.length}`,
                ].join("\n")
            );

        }


        console.log("");

        console.log(
            "PineTS result file verified."
        );

        console.log(
            "Result:",
            this.resultsFile
        );


        return this.loadResults();
    }


    // =========================================================
    // LOAD RESULTS
    // =========================================================

    loadResults() {

        if (
            !fs.existsSync(
                this.resultsFile
            )
        ) {

            throw new Error(
                `Results file not found: ${this.resultsFile}`
            );

        }


        return JSON.parse(
            fs.readFileSync(
                this.resultsFile,
                "utf8"
            )
        );
    }


    // =========================================================
    // EXTRACT PINE TABLE
    // =========================================================

    extractPineTable(
        results
    ) {

        const tablePlot =
            results?.plots?.__tables__;


        if (
            !tablePlot ||
            !Array.isArray(
                tablePlot.data
            )
        ) {

            throw new Error(
                "PineTS __tables__ output not found."
            );

        }


        if (
            tablePlot.data.length === 0
        ) {

            throw new Error(
                "PineTS returned an empty table."
            );

        }


        const table =
            tablePlot.data[
                tablePlot.data.length - 1
            ]?.value?.[0];


        if (!table) {

            throw new Error(
                "BullionAI table data not found."
            );

        }


        const cells =
            table.cells;


        if (
            !Array.isArray(
                cells
            )
        ) {

            throw new Error(
                "BullionAI table cells not found."
            );

        }


        const values = {};


        for (
            const row of cells
        ) {

            if (
                !Array.isArray(row) ||
                row.length < 2
            ) {

                continue;

            }


            const label =
                String(
                    row[0]?.text ?? ""
                ).trim();


            const value =
                String(
                    row[1]?.text ?? ""
                ).trim();


            if (label) {

                values[label] =
                    value;

            }

        }


        return values;
    }


    // =========================================================
    // NUMBER HELPER
    // =========================================================

    toNumber(
        value
    ) {

        if (
            value === null ||
            value === undefined ||
            value === "" ||
            value === "-"
        ) {

            return null;

        }


        const number =
            Number(
                String(value)
                    .replace(
                        /,/g,
                        ""
                    )
                    .trim()
            );


        return Number.isFinite(
            number
        )
            ? number
            : null;
    }


    // =========================================================
    // SIGNAL HISTORY
    // =========================================================

    getSignalHistory(
        results,
        candles
    ) {

        const signalData =
            results?.plots?.Signal?.data;


        if (
            !Array.isArray(
                signalData
            )
        ) {

            return [];

        }


        const history = [];


        for (
            let i = 0;
            i < signalData.length;
            i++
        ) {

            const value =
                Number(
                    signalData[i]?.value
                );


            if (
                value !== 1 &&
                value !== -1
            ) {

                continue;

            }


            const candle =
                candles[i];


            if (!candle) {

                continue;

            }


            history.push({

                index:
                    i,

                signal:
                    value === 1
                        ? "BUY"
                        : "SELL",

                price:
                    Number(
                        candle.close
                    ),

                time:
                    candle.time,

            });

        }


        return history;
    }


    // =========================================================
    // SIGNAL HISTORY FROM ORIGINAL PLOTSHAPES
    //
    // The exact Pine script does not include the old helper
    // "Signal" plot. PineTS still emits plotshape() calls under
    // plots.plot, so read BUY/SELL labels from there.
    // =========================================================

    getPlotshapeSignalHistory(
        results,
        candles
    ) {

        const data =
            results?.plots?.plot?.data;


        if (
            !Array.isArray(data)
        ) {

            return [];

        }


        const history = [];


        for (
            let i = 0;
            i < data.length;
            i++
        ) {

            const point =
                data[i];

            if (
                point?.value !== true
            ) {

                continue;

            }


            const signal =
                String(
                    point?.options?.text ||
                    ""
                ).trim();


            if (
                signal !== "BUY" &&
                signal !== "SELL"
            ) {

                continue;

            }


            const candle =
                candles[i];

            /*
             * PineTS appends a
             * replayed second pass to
             * plot arrays — points
             * beyond the candle count
             * are duplicates, not
             * real bars.
             */

            if (!candle) {
                continue;
            }


            history.push({

                index:
                    i >= candles.length
                        ? i - candles.length
                        : i,

                signal,

                price:
                    Number(
                        candle.close
                    ),

                time:
                    candle.time,

            });

        }


        return history.sort(
            (a, b) =>
                a.index - b.index
        );

    }


    // =========================================================
    // TRAIL HISTORY FROM PINE PLOT
    //
    // plot(trailSL) lands in results as
    // plots["#1"] carrying Pine's own
    // per-bar values AND colors
    // (#00E676 lime = BUY trade,
    //  #F23645 red  = SELL trade).
    //
    // We pass them through untouched so
    // the chart replicates the Pine
    // line bar-for-bar.
    // =========================================================

    getTrailHistory(
        results,
        candles
    ) {

        const data =
            this.getTrailPlotData(
                results
            );


        if (
            !Array.isArray(
                data
            )
        ) {

            return [];

        }


        const out = [];


        for (
            let i = 0;
            i < data.length;
            i++
        ) {

            const point =
                data[i];

            const value =
                point?.value;


            if (

                typeof value !==
                "number" ||
                !Number.isFinite(
                    value
                )

            ) {

                continue;

            }


            const candle =
                candles[i];


            if (!candle) {

                continue;

            }


            const color =
                String(

                    point?.options
                        ?.color ||
                    ""

                ).toUpperCase();


            const buy =

                !color.includes(
                    "F23645"
                );


            out.push({

                time:
                    Number(
                        candle.time
                    ),

                value,

                buy,

            });

        }


        return out;

    }


    // =========================================================
    // TRAIL PLOT DATA
    // =========================================================

    getTrailPlotData(results) {

        const plots =
            results?.plots || {};


        for (
            const [name, plot] of
            Object.entries(plots)
        ) {

            if (
                name.startsWith("__") ||
                name === "Signal" ||
                name === "plot" ||
                !Array.isArray(
                    plot?.data
                )
            ) {

                continue;

            }


            const hasNumericValue =
                plot.data.some(
                    point =>
                        typeof point?.value ===
                            "number" &&
                        Number.isFinite(
                            point.value
                        )
                );


            if (hasNumericValue) {

                return plot.data;

            }

        }


        return [];

    }


    // =========================================================
    // CURRENT CANDLE
    // =========================================================

    getCurrentCandle(
        candles
    ) {

        if (
            !candles.length
        ) {

            return null;

        }


        const candle =
            candles[
                candles.length - 1
            ];


        return {

            time:
                candle.time,

            open:
                Number(
                    candle.open
                ),

            high:
                Number(
                    candle.high
                ),

            low:
                Number(
                    candle.low
                ),

            close:
                Number(
                    candle.close
                ),

            volume:
                Number(
                    candle.volume
                ),

        };
    }


    // =========================================================
    // FIND LAST SIGNAL INDEX
    // =========================================================

    findLastSignalIndex(
        results,
        candles = [],
        entryPrice = null
    ) {

        const signalData =
            results?.plots?.Signal?.data;


        if (
            !Array.isArray(
                signalData
            )
        ) {

            return this.findEntryIndexByPrice(
                candles,
                entryPrice
            );

        }


        return this.findEntryIndexByPrice(
            candles,
            entryPrice
        ) ??
            (() => {
                for (
                    let i =
                        signalData.length - 1;
                    i >= 0;
                    i--
                ) {

                    const value =
                        Number(
                            signalData[i]?.value
                        );


                    if (
                        value === 1 ||
                        value === -1
                    ) {

                        return i;

                    }

                }


                return null;
            })();
    }


    // =========================================================
    // ENTRY INDEX FROM PINE TABLE ENTRY PRICE
    // =========================================================

    findEntryIndexByPrice(
        candles,
        entryPrice
    ) {

        const roundedEntry =
            this.toNumber(
                entryPrice
            );


        if (
            roundedEntry === null ||
            !Array.isArray(candles)
        ) {

            return null;

        }


        for (
            let i =
                candles.length - 1;
            i >= 0;
            i--
        ) {

            const close =
                Math.round(
                    Number(
                        candles[i]?.close
                    )
                );


            if (
                close === roundedEntry
            ) {

                return i;

            }

        }


        return null;

    }


    // =========================================================
    // BUILD STATE FROM PINE
    // =========================================================

    buildState(
        results,
        candles
    ) {

        /*
         * =====================================================
         * IMPORTANT
         *
         * Pine is the source of truth.
         *
         * JavaScript does NOT recalculate:
         *
         * - Signal
         * - Entry
         * - Trail SL
         * - Current P/L
         * - Best P/L
         * - Realized P/L
         * - Status
         *
         * These values come from PineTS.
         * =====================================================
         */


        const table =
            this.extractPineTable(
                results
            );


        const entryPrice =
            this.toNumber(
                table[
                    "Entry Price"
                ]
            );


        const signalIndex =
            this.findLastSignalIndex(
                results,
                candles,
                entryPrice
            );


        let extremePrice =
            null;


        if (
            table.Trade === "SELL"
        ) {

            extremePrice =
                this.toNumber(
                    table.Lowest
                );

        } else {

            extremePrice =
                this.toNumber(
                    table.Highest
                );

        }


        // -----------------------------------------------------
        // ENTRY / EXIT TIMELINE
        //
        // PineTS does not populate the year/
        // month/hour builtins, so the table
        // Entry/Exit cells print NaN. The
        // real timeline is reconstructed
        // from Pine's OWN outputs only:
        //
        //   Entry : plotshape BUY/SELL
        //           events (newBuy/newSell)
        //
        //   Exit  : first bar AFTER entry
        //           where Pine's plotted
        //           trailSL is crossed by
        //           close (slHitBuy/slHitSell)
        //
        // No indicator logic is re-derived
        // here — trail values come straight
        // from the Pine plot.
        // -----------------------------------------------------

        const entries =
            this.getPlotshapeSignalHistory(
                results,
                candles
            );


        const tradeSide =

            table.Trade === "SELL"
                ? "SELL"

                : table.Trade ===
                  "BUY"
                    ? "BUY"

                    : null;


        /*
         * Entry bar — price-match
         * FIRST: the table's own
         * entry price is exact and
         * self-consistent, while
         * PineTS plot arrays carry a
         * replayed second pass whose
         * indices cannot be trusted.
         */

        let entryIndex =
            signalIndex;


        if (
            entryIndex ===
                null &&
            tradeSide
        ) {

            for (
                let i =
                    entries.length - 1;
                i >= 0;
                i--

            ) {

                if (
                    entries[i]
                        .signal ===
                    tradeSide
                ) {

                    entryIndex =

                        entries[i]
                            .index;

                    break;

                }

            }

        }


        let entryTimestamp = null;


        if (
            entryIndex !== null &&
            candles[entryIndex]
        ) {

            entryTimestamp =

                candles[
                    entryIndex
                ].time;

        }


        let exitTimestamp =
            null;


        if (

            entryIndex !== null &&
            table.Status ===
                "CLOSED"

        ) {

            /* Pine's per-bar trail
             * plot, parallel to the
             * candles array. */

            const trailByIdx =
                new Map();

            const trailPlot =

                this.getTrailPlotData(
                    results
                );

            for (
                let i = 0;
                i < trailPlot.length &&
                i < candles.length;
                i++

            ) {

                const v =
                    trailPlot[i]
                        ?.value;

                if (
                    typeof v ===
                        "number" &&
                    Number.isFinite(
                        v
                    )
                ) {

                    trailByIdx.set(
                        i,
                        v
                    );

                }

            }


            for (
                let i =
                    entryIndex + 1;
                i < candles.length;
                i++

            ) {

                const tv =
                    trailByIdx.get(
                        i
                    );

                if (
                    typeof tv !==
                        "number" ||
                    !Number.isFinite(
                        tv
                    )
                ) {

                    continue;

                }


                const close =
                    Number(
                        candles[i]
                            .close
                    );


                const hitBuy =

                    tradeSide ===
                        "BUY" &&
                    close <= tv;

                const hitSell =

                    tradeSide ===
                        "SELL" &&
                    close >= tv;


                if (
                    hitBuy ||
                    hitSell
                ) {

                    exitTimestamp =

                        candles[i]
                            .time;

                    break;

                }

            }

        }


        /*
         * Legacy fallback: raw Exit
         * string from the table when
         * it is usable (non-NaN).
         */

        if (
            exitTimestamp ===
                null &&
            table.Exit &&
            table.Exit !== "-" &&
            !table.Exit.includes(
                "NaN"
            )
        ) {

            exitTimestamp =
                table.Exit;

        }


        /*
         * Full signal history from
         * Pine's own plotshape()
         * emissions (first pass only)
         * — the same BUY/SELL labels
         * TradingView draws.
         *
         * RECONCILIATION: PineTS plot
         * arrays can emit shapes that
         * contradict the table (the
         * panel's source of truth) —
         * e.g. a trailing SELL while
         * the table reports an OPEN
         * BUY. Everything after the
         * current trade's entry is
         * dropped, and the final
         * marker is forced to mirror
         * the table exactly.
         */

        const signalHistory =
            entries.filter(
                ev =>
                    entryIndex ===
                        null ||
                    ev.index <
                        entryIndex
            );

        if (
            tradeSide &&
            entryPrice !== null &&
            entryTimestamp !== null
        ) {

            signalHistory.push({

                index:
                    entryIndex ?? -1,

                signal:
                    tradeSide,

                price:
                    entryPrice,

                time:
                    entryTimestamp,

            });

        }


        /*
         * Entries strictly alternate
         * (newBuy/newSell only fire
         * while CLOSED), so collapse
         * any same-direction run —
         * keeping the NEWEST, which
         * is anchored to the table.
         */

        const collapsed = [];

        for (
            const ev of
                signalHistory
        ) {

            const prev =

                collapsed[
                    collapsed
                        .length - 1
                ];

            if (
                prev &&
                prev.signal ===
                    ev.signal
            ) {

                collapsed[
                    collapsed
                        .length - 1
                ] = ev;

            } else {

                collapsed.push(
                    ev
                );

            }

        }

        signalHistory.length = 0;

        signalHistory.push(
            ...collapsed
        );


        // -----------------------------------------------------
        // PER-TRADE REALIZED P/L
        //
        // For every historical signal, walk forward using
        // PINE'S OWN plotted trail values and find the bar
        // where the trail was crossed (the SL exit).
        //
        //   realized = exitSL - entry   (BUY)
        //            = entry - exitSL   (SELL)
        //
        // No indicator logic is re-derived — the trail comes
        // straight from the Pine plot. A signal with no cross
        // is still open (realized stays null).
        // -----------------------------------------------------

        const trailPlot =
            this.getTrailPlotData(
                results
            );

        for (
            let m = 0;
            m < signalHistory.length;
            m++
        ) {

            const ev =
                signalHistory[m];

            const idx =
                ev.index;

            if (
                !Number.isFinite(
                    idx
                ) ||
                !candles[idx]
            ) {
                continue;
            }


            let pl = null;

            let exitIdx = null;

            const side =
                ev.signal;


            for (
                let j = idx + 1;
                j < candles.length &&
                j < trailPlot.length;
                j++

            ) {

                const tv =

                    trailPlot[j]
                        ?.value;

                if (

                    typeof tv !==
                        "number" ||
                    !Number.isFinite(
                        tv
                    )

                ) {
                    continue;
                }


                const close =
                    Number(
                        candles[j]
                            .close
                    );


                if (

                    (side ===
                        "BUY" &&
                        close <=
                            tv) ||

                    (side ===
                        "SELL" &&
                        close >=
                            tv)

                ) {

                    exitIdx = j;

                    pl =

                        side ===
                        "BUY"
                            ? tv -
                              Number(
                                  ev.price
                              )
                            : Number(
                                  ev.price
                              ) -
                              tv;

                    break;

                }

            }


            ev.realizedPL =
                typeof pl ===
                    "number" &&
                Number.isFinite(pl)
                    ? pl

                    : null;

            ev.exitTime =

                exitIdx !== null
                    ? candles[
                          exitIdx
                      ].time

                    : null;

        }


        /*
         * The FINAL marker mirrors the
         * current table trade — prefer
         * the table's own Realized P/L
         * and computed exit time.
         */

        if (
            signalHistory.length >
            0
        ) {

            const last =

                signalHistory[
                    signalHistory
                        .length - 1
                ];


            if (
                table.Status ===
                    "CLOSED"
            ) {

                const tablePL =

                    this.toNumber(
                        table[
                            "Realized P/L"
                        ]
                    );

                if (
                    tablePL !== null
                ) {
                    last.realizedPL =
                        tablePL;
                }

                if (
                    exitTimestamp !==
                        null &&
                    typeof exitTimestamp ===
                        "number"
                ) {
                    last.exitTime =
                        exitTimestamp;
                }

            } else {

                /* Still open. */

                last.realizedPL =
                    null;

                last.exitTime = null;

            }

        }


        return {

            signal:
                table.Trade ||
                "NONE",

            status:
                table.Status ||
                "CLOSED",

            entryPrice:
                entryPrice,

            trailSL:
                this.toNumber(
                    table[
                        "Trail SL"
                    ]
                ),

            trailHistory:

                this.getTrailHistory(
                    results,
                    candles
                ),

            extremeLabel:
                table.Trade === "SELL"
                    ? "Lowest"
                    : "Highest",

            extremePrice,

            currentPL:
                this.toNumber(
                    table[
                        "Current P/L"
                    ]
                ),

            bestPL:
                this.toNumber(
                    table[
                        "Best P/L"
                    ]
                ),

            realizedPL:
                this.toNumber(
                    table[
                        "Realized P/L"
                    ]
                ),

            entryTime:
                entryTimestamp,

            exitTime:
                exitTimestamp,

            currentCandle:
                this.getCurrentCandle(
                    candles
                ),

            candleCount:
                candles.length,

            lastCandleTime:
                candles.length
                    ? candles[
                        candles.length - 1
                    ].time
                    : null,

            signalHistory:
                signalHistory,
        };
    }


    // =========================================================
    // RUN
    // =========================================================

    run() {

        const candles =
            this.loadCandles();


        const results =
            this.execute();


        const state =
            this.buildState(
                results,
                candles
            );


        return {

            state,

            candles,

            results,

        };
    }
}


// =============================================================
// EXPORT
// =============================================================

module.exports = {
    StrategyEngine,
};
