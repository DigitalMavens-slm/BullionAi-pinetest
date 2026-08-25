require("dotenv").config();

const { ShoonyaClient } = require("shoonya-api-js");
const fs = require("fs");
const readline = require("readline");

const clientId = process.env.SHOONYA_CLIENT_ID;
const secretCode = process.env.SHOONYA_SECRET_CODE;

const exchange = process.env.SHOONYA_EXCHANGE || "MCX";
const token = process.env.SHOONYA_GOLD_TOKEN || "483079";

if (!clientId || !secretCode) {
  console.error("Missing Shoonya credentials in .env");
  process.exit(1);
}

const client = new ShoonyaClient({
  baseUrl: "https://api.shoonya.com",
});

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.question("Paste the Shoonya redirect URL here: ", async (redirectUrl) => {
  try {
    // ---------------------------------------------------------
    // 1. Extract OAuth authorization code
    // ---------------------------------------------------------

    const url = new URL(redirectUrl.trim());
    const code = url.searchParams.get("code");

    if (!code) {
      throw new Error("No authorization code found.");
    }

    console.log("Authorization code detected.");

    // ---------------------------------------------------------
    // 2. Generate checksum
    // ---------------------------------------------------------

    const checksum = ShoonyaClient.generateChecksum(
      clientId,
      secretCode,
      code
    );

    console.log("Checksum generated.");

    // ---------------------------------------------------------
    // 3. Exchange code for access token
    // ---------------------------------------------------------

    console.log("Requesting Shoonya access token...");

    const session = await client.generateAccessToken({
      code,
      checksum,
    });

    console.log("Shoonya authentication successful.");
    console.log("User:", session.USERID || session.uid);
    console.log("Account:", session.actid);

    // ---------------------------------------------------------
    // 4. Request MCX GOLD historical candles
    // ---------------------------------------------------------

    const endTime = Math.floor(Date.now() / 1000);

    // Last 7 days
    const startTime = endTime - 7 * 24 * 60 * 60;

    const params = {
      uid: session.USERID || session.uid,
      exch: exchange,
      token: token,
      st: String(startTime),
      et: String(endTime),
      intrv: "60",
    };

    console.log("");
    console.log("Requesting MCX GOLD historical candles...");
    console.log("Exchange:", exchange);
    console.log("Token:", token);
    console.log("Interval: 60 minutes");

    // Shoonya documented TPSeries endpoint
    const response = await client._post(
      "/NorenWClientTP/TPSeries",
      params
    );

    // ---------------------------------------------------------
    // 5. Validate response
    // ---------------------------------------------------------

    if (!response) {
      throw new Error("Empty response from Shoonya.");
    }

    if (response.stat && response.stat !== "Ok") {
      throw new Error(
        `Shoonya error: ${response.emsg || response.stat}`
      );
    }

    const candles = Array.isArray(response.values)
      ? response.values
      : [];

    console.log("");
    console.log("Candles received:", candles.length);

    if (candles.length === 0) {
      console.log("Raw response:");
      console.log(JSON.stringify(response, null, 2));
      return;
    }

    // ---------------------------------------------------------
    // 6. Convert Shoonya candles → PineTS format
    // ---------------------------------------------------------

    const pinetsCandles = candles
      .map((candle) => ({
        time: candle.time,
        open: Number(candle.into),
        high: Number(candle.inth),
        low: Number(candle.intl),
        close: Number(candle.intc),
        volume: Number(candle.intv || 0),
      }))
      .filter(
        (candle) =>
          Number.isFinite(candle.open) &&
          Number.isFinite(candle.high) &&
          Number.isFinite(candle.low) &&
          Number.isFinite(candle.close)
      )
      .reverse();

    // ---------------------------------------------------------
    // 7. Save candles
    // ---------------------------------------------------------

    fs.writeFileSync(
      "gold-candles.json",
      JSON.stringify(pinetsCandles, null, 2)
    );

    console.log("");
    console.log("====================================");
    console.log("      MCX GOLD DATA SUCCESS");
    console.log("====================================");
    console.log("Candles saved:", pinetsCandles.length);
    console.log("File: gold-candles.json");
    console.log("====================================");

  } catch (error) {
    console.error("");
    console.error("====================================");
    console.error("       SHOONYA TEST FAILED");
    console.error("====================================");

    if (error.response?.data) {
      console.error(
        "API response:",
        JSON.stringify(error.response.data, null, 2)
      );
    } else {
      console.error("Error:", error.message || error);
    }

    console.error("====================================");
  } finally {
    rl.close();
  }
});