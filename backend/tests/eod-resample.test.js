/*
 * eod-resample.test.js — tests for resampleCandles() in
 * src/market/rollover-manager.js (EOD day/week/month buckets, IST).
 *
 * Run: node tests/eod-resample.test.js
 */

const assert = require("assert");
const {
    resampleCandles,
    bucketStartMs,
} = require("../src/market/rollover-manager");

let passed = 0;
let failed = 0;
function test(name, fn) {
    try {
        fn();
        passed++;
        console.log("  \u2713 " + name);
    } catch (e) {
        failed++;
        console.log("  \u2717 " + name + "\n      " + (e.message || e));
    }
}

// 2026-09-07 09:00 IST == 03:30 UTC
const IST = (y, mo, d, h, mi) =>
    Date.UTC(y, mo - 1, d, h, mi) - 5.5 * 3600_000;

function bar(isoMs, o, h, l, c, v = 100) {
    return { time: isoMs, open: o, high: h, low: l, close: c, volume: v };
}

console.log("\n=== EOD RESAMPLE ===");

test("day buckets split at IST midnight", () => {
    const src = [
        bar(IST(2026, 9, 7, 23, 45), 100, 102, 99, 101),
        // 18:30 UTC == 00:00 IST next day -> new bucket
        bar(IST(2026, 9, 8, 0, 15), 101, 103, 100, 102),
    ];
    const out = resampleCandles(src, "day");
    assert.strictEqual(out.length, 2);
    assert.strictEqual(
        out[0].time,
        IST(2026, 9, 7, 0, 0),
        "first bucket starts IST midnight"
    );
    assert.strictEqual(out[1].time, IST(2026, 9, 8, 0, 0));
});

test("day OHLC takes first open / last close / extremes, volume sums", () => {
    const src = [
        bar(IST(2026, 9, 7, 9, 0), 150, 152, 149, 151, 10),
        bar(IST(2026, 9, 7, 9, 15), 151, 155, 150, 154, 20),
        bar(IST(2026, 9, 7, 9, 30), 154, 154, 148, 149, 30),
    ];
    const out = resampleCandles(src, "day");
    assert.strictEqual(out.length, 1);
    assert.strictEqual(out[0].open, 150);
    assert.strictEqual(out[0].high, 155);
    assert.strictEqual(out[0].low, 148);
    assert.strictEqual(out[0].close, 149);
    assert.strictEqual(out[0].volume, 60);
});

test("unsorted input still aggregates correctly", () => {
    const src = [
        bar(IST(2026, 9, 7, 9, 30), 154, 154, 148, 149),
        bar(IST(2026, 9, 7, 9, 0), 150, 152, 149, 151),
    ];
    const out = resampleCandles(src, "day");
    assert.strictEqual(out.length, 1);
    assert.strictEqual(out[0].open, 150, "open from earliest bar");
    assert.strictEqual(out[0].close, 149, "close from latest bar");
});

test("week bucket starts IST Monday 00:00", () => {
    // 2026-09-07 is a Monday.
    const src = [
        bar(IST(2026, 9, 7, 9, 0), 100, 101, 99, 100),
        bar(IST(2026, 9, 11, 15, 0), 100, 105, 98, 104), // Friday
        bar(IST(2026, 9, 13, 10, 0), 104, 106, 103, 105), // Sunday
        bar(IST(2026, 9, 14, 9, 0), 105, 107, 104, 106), // next Monday
    ];
    const out = resampleCandles(src, "week");
    assert.strictEqual(out.length, 2);
    assert.strictEqual(out[0].time, IST(2026, 9, 7, 0, 0));
    assert.strictEqual(out[0].low, 98);
    assert.strictEqual(out[0].close, 105);
    assert.strictEqual(out[1].time, IST(2026, 9, 14, 0, 0));
});

test("month bucket starts IST 1st 00:00", () => {
    const src = [
        bar(IST(2026, 8, 31, 20, 0), 90, 92, 89, 91),
        bar(IST(2026, 9, 1, 9, 0), 91, 95, 90, 94),
    ];
    const out = resampleCandles(src, "month");
    assert.strictEqual(out.length, 2);
    assert.strictEqual(out[0].time, IST(2026, 8, 1, 0, 0));
    assert.strictEqual(out[1].time, IST(2026, 9, 1, 0, 0));
    assert.strictEqual(out[1].high, 95);
});

test("bad bars skipped, bad input returns []", () => {
    const src = [
        null,
        { time: NaN, open: 1, high: 1, low: 1, close: 1 },
        { time: IST(2026, 9, 7, 9, 0), open: 1, high: 2, low: 0.5, close: 1.5 },
        { time: IST(2026, 9, 7, 9, 15), open: null, high: 2, low: 1, close: 1 },
    ];
    const out = resampleCandles(src, "day");
    assert.strictEqual(out.length, 1);
    assert.strictEqual(out[0].high, 2);
    assert.deepStrictEqual(resampleCandles([], "day"), []);
    assert.deepStrictEqual(resampleCandles(null, "day"), []);
    assert.deepStrictEqual(
        resampleCandles(src, "year"),
        [],
        "unknown bucket rejected"
    );
});

test("bucketStartMs day/week/month anchors", () => {
    // Sunday 2026-09-13 10:00 IST -> week bucket Monday 2026-09-07
    assert.strictEqual(
        bucketStartMs(IST(2026, 9, 13, 10, 0), "week"),
        IST(2026, 9, 7, 0, 0)
    );
    // Monday stays on itself
    assert.strictEqual(
        bucketStartMs(IST(2026, 9, 7, 9, 0), "week"),
        IST(2026, 9, 7, 0, 0)
    );
    assert.strictEqual(
        bucketStartMs(IST(2026, 9, 30, 23, 59), "month"),
        IST(2026, 9, 1, 0, 0)
    );
    assert.strictEqual(bucketStartMs(NaN, "day"), null);
    assert.strictEqual(bucketStartMs(Date.now(), "bogus"), null);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
