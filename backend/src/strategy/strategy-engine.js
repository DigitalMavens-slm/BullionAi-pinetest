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

        const isFixedTgt =
            String(strategyFile)
                .toLowerCase()
                .includes("fixedtgt");

        this.pineIntegrity =
            new PineIntegrity({
                strategyFile:
                    this.strategyFile,

                hashFile:
                    isFixedTgt
                        ? "data/bullionai-fixedtgt-integrity.json"
                        : "data/bullionai-pine-integrity.json",
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

        // Auto-create baseline on first run (needed for new fixedtgt script)
        if (
            !this.pineIntegrity.loadBaseline()
        ) {
            console.log(
                "Creating Pine integrity baseline for:",
                path.basename(this.strategyFile)
            );
            this.pineIntegrity.createBaseline();
        }

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

        const pinetsBin =
            path.resolve(
                this.projectRoot,
                "backend/node_modules/pinets-cli/dist/pinets-cli.min.cjs"
            );

        const bin =
            fs.existsSync(pinetsBin)
                ? pinetsBin
                : path.resolve(
                      this.projectRoot,
                      "node_modules/pinets-cli/dist/pinets-cli.min.cjs"
                  );

        const command =
            [
                "node",
                `"${bin}"`,
                "run",
                `"${strategyPath}"`,
                "--data",
                `"${candlesPath}"`,
                "--pretty",
                "--output",
                `"${resultsPath}"`,
            ].join(" ");


        try {
            execSync(
                command,
                {
                    cwd:
                        this.projectRoot,

                    stdio:
                        "pipe",

                    windowsHide:
                        true,

                    timeout:
                        Number(
                            process.env.BULLIONAI_PINETS_TIMEOUT_MS ||
                            30000
                        ),
                }
            );
        } catch (e) {
            console.error(
                "[pinets] command:",
                command
            );
            console.error(
                "[pinets] cwd:",
                this.projectRoot,
                "strategy:",
                this.strategyFile,
                "data:",
                this.candlesFile,
                "exists:",
                fs.existsSync(
                    this.candlesFile
                )
            );
            console.error(
                "[pinets] exit:",
                e.status,
                "signal:",
                e.signal
            );
            if (e.stderr) {
                console.error(
                    "[pinets] stderr:",
                    e.stderr
                        .toString()
                        .slice(0, 4000)
                );
            }
            if (e.stdout) {
                console.error(
                    "[pinets] stdout:",
                    e.stdout
                        .toString()
                        .slice(0, 2000)
                );
            }
            try {
                console.error(
                    "[pinets] bin check:",
                    fs.existsSync(bin),
                    fs.existsSync(
                        path.join(
                            this.projectRoot,
                            "BullionAI-fixedtgt.pine"
                        )
                    )
                );
            } catch {}
            throw e;
        }


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


        const cleaned = String(value).replace(/,/g, "").trim();
        // Extract leading numeric token (handles "+110 pts", "-496 pts", "WAITING 233396", etc.)
        const m = cleaned.match(/-?\d+(\.\d+)?/);
        const number = m ? Number(m[0]) : Number(cleaned);


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


        /*
         * The table prints a ROUNDED
         * entry (math.round), so the
         * true close may differ by a
         * fraction. Prefer an exact
         * match; otherwise accept the
         * closest bar within ±1.
         */

        let bestIdx = null;

        let bestDiff =
            Infinity;

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


            const diff =
                Math.abs(
                    close -
                        roundedEntry
                );


            if (diff === 0) {

                return i;

            }


            if (
                diff <= 1 &&
                diff < bestDiff
            ) {

                bestDiff = diff;

                bestIdx = i;

            }

        }


        return bestIdx;

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


        const rawTable =
            this.extractPineTable(
                results
            );

        // -----------------------------------------------------
        // Normalize table keys case-insensitively + aliases
        // Supports BOTH BullionAI.pine and BullionAI-fixedtgt.pine
        // -----------------------------------------------------
        const normMap = new Map();
        for (const [k, v] of Object.entries(rawTable)) {
            normMap.set(String(k).trim().toLowerCase(), v);
        }
        const pick = (...keys) => {
            for (const k of keys) {
                const v = normMap.get(String(k).trim().toLowerCase());
                if (v !== undefined && v !== null && String(v).trim() !== "") return v;
            }
            return undefined;
        };
        const table = new Proxy(rawTable, {
            get(target, prop) {
                if (typeof prop !== "string") return target[prop];
                if (prop in target) return target[prop];
                const v = pick(prop);
                return v !== undefined ? v : undefined;
            },
        });

        const entryPrice =
            this.toNumber(
                pick("Entry Price", "ENTRY", "Entry", "entry price", "entry")
            );


        const signalIndex =
            this.findLastSignalIndex(
                results,
                candles,
                entryPrice
            );


        let extremePrice =
            null;

        const tradeVal = String(pick("Trade", "TRADE") || "").trim().toUpperCase();

        // Highest/Lowest are PRICE columns (trailing strategy). The
        // fixed-target table has no such column, so don't fall back to
        // "MAX POINTS" (a points value) — keep extremePrice null there.
        if (
            tradeVal === "SELL"
        ) {

            const lowRaw = pick("Lowest", "LOWEST");
            extremePrice =
                lowRaw != null
                    ? this.toNumber(lowRaw)
                    : null;

        } else {

            const highRaw = pick("Highest", "HIGHEST");
            extremePrice =
                highRaw != null
                    ? this.toNumber(highRaw)
                    : null;

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

            /* Fallback for CLOSED trades where trail scan
             * didn't find an exit (e.g., PineTS NaN gap):
             * use the last candle's time as exit. */

            if (
                exitTimestamp === null &&
                table.Status === "CLOSED" &&
                candles.length > 0
            ) {

                exitTimestamp =
                    candles[
                        candles.length - 1
                    ].time;

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


            /* Fallback for historical trades where trail scan
             * didn't find a cross (e.g., PineTS gap):
             * use next signal - 1 bar as exit proxy. */

            if (
                exitIdx === null &&
                m < signalHistory.length - 1
            ) {

                const nextIdx =
                    signalHistory[m + 1].index;

                if (
                    Number.isFinite(nextIdx) &&
                    candles[nextIdx - 1]
                ) {

                    exitIdx = nextIdx - 1;

                    const tv2 =
                        trailPlot[exitIdx]?.value;

                    if (
                        typeof tv2 ===
                            "number" &&
                        Number.isFinite(tv2)
                    ) {

                        pl =
                            side === "BUY"
                                ? tv2 -
                                  Number(ev.price)
                                : Number(ev.price) -
                                  tv2;

                    } else {

                        pl = null;

                    }

                }

            } else if (
                exitIdx === null &&
                m === signalHistory.length - 1 &&
                table.Status === "CLOSED"
            ) {

                exitIdx = candles.length - 1;

                const tv2 =
                    trailPlot[exitIdx]?.value;

                if (
                    typeof tv2 === "number" &&
                    Number.isFinite(tv2)
                ) {

                    pl =
                        side === "BUY"
                            ? tv2 - Number(ev.price)
                            : Number(ev.price) - tv2;

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


        const signalVal = String(pick("Trade", "TRADE") || "NONE").trim().toUpperCase();
        const statusVal = String(pick("Status", "STATUS") || "CLOSED").trim().toUpperCase();
        // MCX fixedtgt specific display strings (raw table values)
        const target1Raw = pick("TARGET 1", "Target 1", "TARGET1", "Target1", "Target - 1");
        const target2Raw = pick("TARGET 2", "Target 2", "TARGET2", "Target2", "Target - 2");
        const maxPointsRaw = pick("MAX POINTS", "Max Points", "MAXPOINTS", "Max points");
        const resultRaw = pick("RESULT", "Result", "result", "RESULT ");
        const slRaw = pick("SL", "sl", "Stop Loss", "Trail SL", "TRAIL SL");
        return {

            signal:
                signalVal || "NONE",

            status:
                statusVal || "CLOSED",

            entryPrice:
                entryPrice,

            trailSL:
                this.toNumber(
                    pick("Trail SL", "TRAIL SL", "SL", "sl", "Stop Loss")
                ),

            // MCX fixedtgt panel fields (raw display strings)
            target1: target1Raw,
            target1Price: this.toNumber(target1Raw),
            target2: target2Raw,
            target2Price: this.toNumber(target2Raw),
            maxPoints: this.toNumber(maxPointsRaw),
            maxPointsText: maxPointsRaw,
            result: resultRaw,
            resultText: resultRaw,
            slText: slRaw,

            trailHistory:

                this.getTrailHistory(
                    results,
                    candles
                ),

            extremeLabel:
                signalVal === "SELL"
                    ? "Lowest"
                    : "Highest",

            extremePrice,

            currentPL:
                this.toNumber(
                    pick("Current P/L", "CURRENT P/L", "Current PL", "CURRENT PL")
                ),

            bestPL:
                this.toNumber(
                    pick("Best P/L", "BEST P/L", "MAX POINTS", "Max Points", "MAXPOINTS")
                ),

            realizedPL:
                this.toNumber(
                    pick("Realized P/L", "REALIZED P/L", "RESULT", "Result", "result")
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
