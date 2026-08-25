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

rl.question(
  "Paste fresh Shoonya redirect URL: ",
  async (redirectUrl) => {
    try {
      // =====================================================
      // 1. READ OAUTH CODE
      // =====================================================

      const url = new URL(redirectUrl.trim());
      const code = url.searchParams.get("code");

      if (!code) {
        throw new Error("Authorization code missing.");
      }

      console.log("Authorization code detected.");

      // =====================================================
      // 2. GENERATE CHECKSUM
      // =====================================================

      const checksum = ShoonyaClient.generateChecksum(
        clientId,
        secretCode,
        code
      );

      console.log("Checksum generated.");

      // =====================================================
      // 3. AUTHENTICATE
      // =====================================================

      console.log("Requesting access token...");

      const session = await client.generateAccessToken({
        code,
        checksum,
      });

      const uid = session.USERID || session.uid;
      const actid = session.actid || uid;

      console.log("Shoonya authentication successful.");
      console.log("User:", uid);
      console.log("Account:", actid);

      // =====================================================
      // 4. REQUEST MCX GOLD HISTORICAL DATA
      // =====================================================

      const now = Math.floor(Date.now() / 1000);

      // Last 7 days
      const startTime = now - 7 * 24 * 60 * 60;

      const payload = {
        uid: uid,
        exch: exchange,
        token: token,
        st: String(startTime),
        et: String(now),
        intrv: "60",
      };

      console.log("");
      console.log("Requesting MCX GOLD historical candles...");
      console.log("Exchange:", exchange);
      console.log("Token:", token);
      console.log("Interval: 60 minutes");

      const response = await client._post(
        "/NorenWClientAPI/TPSeries",
        payload
      );

      // =====================================================
      // 5. VALIDATE RESPONSE
      // =====================================================

      if (!Array.isArray(response)) {
        throw new Error(
          "Unexpected TPSeries response format."
        );
      }

      console.log("");
      console.log("Raw candles received:", response.length);

      if (response.length === 0) {
        console.log("No candles returned.");
        return;
      }

      // =====================================================
      // 6. CONVERT SHOONYA → BULLIONAI FORMAT
      // =====================================================

      const candles = response
        .filter((candle) => candle.stat === "Ok")
        .map((candle) => {
          return {
            // Unix timestamp in seconds.
            // ssboe = start time of candle.
            time: Number(candle.ssboe),

            open: Number(candle.into),
            high: Number(candle.inth),
            low: Number(candle.intl),
            close: Number(candle.intc),

            volume: Number(candle.v || candle.intv || 0),

            // Keep OI because BullionAI may use it later.
            openInterest: Number(candle.oi || 0),
          };
        })
        .filter((candle) => {
          return (
            Number.isFinite(candle.time) &&
            Number.isFinite(candle.open) &&
            Number.isFinite(candle.high) &&
            Number.isFinite(candle.low) &&
            Number.isFinite(candle.close)
          );
        });

      // =====================================================
      // 7. SORT OLDEST → NEWEST
      // =====================================================

      candles.sort((a, b) => a.time - b.time);

      // =====================================================
      // 8. SAVE DATA
      // =====================================================

      fs.writeFileSync(
        "gold-candles.json",
        JSON.stringify(candles, null, 2),
        "utf8"
      );

      // =====================================================
      // 9. DISPLAY SUMMARY
      // =====================================================

      const first = candles[0];
      const last = candles[candles.length - 1];

      console.log("");
      console.log("====================================");
      console.log("       MCX GOLD DATA SUCCESS");
      console.log("====================================");
      console.log("Exchange:", exchange);
      console.log("Token:", token);
      console.log("Interval: 60 minutes");
      console.log("Candles saved:", candles.length);
      console.log("File: gold-candles.json");
      console.log("");
      console.log("First candle:");
      console.log(first);
      console.log("");
      console.log("Last candle:");
      console.log(last);
      console.log("====================================");

    } catch (error) {
      console.error("");
      console.error("====================================");
      console.error("       SHOONYA TEST FAILED");
      console.error("====================================");

      if (error.response?.data) {
        console.error(
          JSON.stringify(error.response.data, null, 2)
        );
      } else {
        console.error(error.message || error);
      }

      console.error("====================================");
    } finally {
      rl.close();
    }
  }
);