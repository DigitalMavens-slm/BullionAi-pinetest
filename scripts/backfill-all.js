/*
 * backfill-all.js
 *
 * Waits for a Shoonya session (drop the fresh
 * redirect URL into data\shoonya-auth.txt),
 * then downloads REAL candle data for every
 * timeframe x instrument combination.
 *
 * Daily / Weekly / Monthly fall back to
 * aggregating real 60m candles when the
 * broker endpoint does not serve them.
 */

const fs = require("fs");
const path = require("path");

const {
  IST_TIME_ZONE,
  getISTDate,
} = require("../src/utils/ist-time");

const BASE = "http://127.0.0.1:8787";

const LOG = path.join(
  __dirname,
  "..",
  "backfill.log"
);


function out(msg) {
  process.stdout.write(msg + "\n");

  try {
    fs.appendFileSync(
      LOG,
      msg + "\n"
    );
  } catch {
    // ignore
  }
}

const INSTRUMENTS = [
  { key: "gold", token: "483079" },
  { key: "silver", token: "471725" },
];

const TIMEFRAMES = [
  "15m",
  "30m",
  "60m",
  "120m",
  "180m",
  "240m",
  "1d",
  "1w",
  "1m",
];

const results = [];


function sleep(ms) {
  return new Promise(r =>
    setTimeout(r, ms)
  );
}


async function getJson(url, timeoutMs = 120000) {

  const ctrl =
    new AbortController();

  const t = setTimeout(
    () =>
      ctrl.abort(),
    timeoutMs
  );

  try {

    const res =
      await fetch(url, {
        signal:
          ctrl.signal,
      });

    return await res.json();

  } finally {

    clearTimeout(t);

  }

}


async function waitForSession() {

  out("Waiting for Shoonya session..."
  );

  out("-> drop fresh redirect URL into data\\shoonya-auth.txt"
  );

  for (
    let i = 0;
    i < 600;
    i++
  ) {

    try {

      const h =
        await getJson(
          `${BASE}/health`,
          5000
        );

      if (h.started) {
        out("Session detected.\n"
        );
        return true;
      }

    } catch {
      // server not up yet
    }

    await sleep(3000);

  }

  return false;

}


async function ensureBase(
  instKey,
  token
) {

  // Make sure the 60m dataset exists
  // before any aggregation attempt.

  await getJson(

    `${BASE}/api/candles?instrument=${instKey}&timeframe=60m`

  ).catch(() => null);

  const p = path.join(
    __dirname,
    "..",
    "data",
    `MCX_${token}_60m.json`
  );

  if (
    !fs.existsSync(p)
  ) {
    return null;
  }

  const raw = JSON.parse(
    fs.readFileSync(
      p,
      "utf8"
    )
  );

  return Array.isArray(raw)
    ? raw
    : null;

}


function istDayKey(ms) {
  return new Date(ms)
    .toLocaleString(
      "en-GB",
      {
        timeZone:
          IST_TIME_ZONE,

        year: "numeric",

        month: "2-digit",

        day: "2-digit",
      }
    )
    .split(",")
    .join("");
}


function bucketKey(
  ms,
  tf
) {

  /*
   * Group real intraday candles by
   * calendar day / ISO week / month
   * in exchange local time (IST).
   */

  const ist = getISTDate(ms);


  if (tf === "1d") {

    return ist
      .toISOString()
      .slice(0, 10);

  }


  if (tf === "1w") {

    const t = new Date(ist);

    const day =

      (t.getDay() + 6) % 7; // Mon=0

    t.setDate(
      t.getDate() - day
    );

    return `w${t
      .toISOString()
      .slice(0, 10)}`;

  }


  // 1m (month)

  return ist
    .toISOString()
    .slice(0, 7);

}


function aggregate(
  base,
  tf
) {

  const map = new Map();


  for (const c of base) {

    const k = bucketKey(
      c.time,
      tf
    );


    const cur =
      map.get(k);


    if (!cur) {

      map.set(k, {
        time:
          c.time,

        open:
          c.open,

        high:
          c.high,

        low:
          c.low,

        close:
          c.close,

        volume:

          c.volume ?? 0,

      });

    } else {

      cur.high =
        Math.max(
          cur.high,
          c.high
        );

      cur.low = Math.min(
        cur.low,
        c.low
      );

      cur.close =
        c.close;

      cur.time = cur.time; // keep first

      cur.volume +=
        c.volume ?? 0;

    }

  }


  return Array.from(

    map.values()

  ).sort(
    (a, b) =>
      a.time - b.time
  );

}


async function main() {

  const ok =
    await waitForSession();

  if (!ok) {

    out("Timed out waiting for session."
    );

    process.exit(1);

  }


  for (const inst of INSTRUMENTS) {

    for (const tf of TIMEFRAMES) {

      let status = "";
      let count = 0;


      try {

        const r =
          await getJson(

            `${BASE}/api/candles?instrument=${inst.key}&timeframe=${tf}`

          );

        count =
          r.count ?? 0;


        status =

          count > 0
            ? "OK"
            : "EMPTY";


        /*
         * Higher timeframes may not be
         * served by TPSeries — aggregate
         * real 60m data instead.
         */

        if (

          count === 0 &&
          ["1d", "1w", "1m"].includes(
            tf
          )

        ) {

          const base =
            await ensureBase(
              inst.key,
              inst.token
            );

          if (
            base &&
            base.length > 0
          ) {

            const bars =
              aggregate(
                base,
                tf
              );

            const out =
              path.join(
                __dirname,
                "..",
                "data",
                `MCX_${inst.token}_${tf}.json`
              );

            fs.writeFileSync(
              out,
              JSON.stringify(
                bars,
                null,
                2
              ),
              "utf8"
            );

            count =
              bars.length;

            status =
              "AGGREGATED";

          } else {

            status =
              "NO-BASE";

          }

        }

      } catch (e) {

        status =

          "FAIL: " +
          String(e.message).slice(
            0,
            40
          );

      }


      results.push({
        inst:
          inst.key,

        tf,

        count,

        status,
      });


      out(`${inst.key.padEnd(7)} ${tf.padEnd(5)} ${String(count).padStart(6)}  ${status}`
      );

    }

  }


  const okCount =
    results.filter(
      r => r.count > 0
    ).length;


  out(`\nDone: ${okCount}/${results.length} datasets ready.`
  );

}


main();

