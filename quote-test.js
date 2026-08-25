require("dotenv").config();

const { ShoonyaClient } = require("shoonya-api-js");
const readline = require("readline");

const clientId = process.env.SHOONYA_CLIENT_ID;
const secretCode = process.env.SHOONYA_SECRET_CODE;

const client = new ShoonyaClient({
  baseUrl: "https://api.shoonya.com",
});

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.question("Paste fresh Shoonya redirect URL: ", async (redirectUrl) => {
  try {
    const url = new URL(redirectUrl.trim());
    const code = url.searchParams.get("code");

    if (!code) {
      throw new Error("Authorization code missing.");
    }

    const checksum = ShoonyaClient.generateChecksum(
      clientId,
      secretCode,
      code
    );

    console.log("Requesting access token...");

    const session = await client.generateAccessToken({
      code,
      checksum,
    });

    const uid = session.USERID || session.uid;

    console.log("Authenticated:", uid);
    console.log("Requesting MCX GOLD quote...");

    const quote = await client.getQuotes({
      exch: "MCX",
      token: "483079",
    });

    console.log("");
    console.log("====================================");
    console.log("       MCX GOLD QUOTE SUCCESS");
    console.log("====================================");
    console.log(JSON.stringify(quote, null, 2));
    console.log("====================================");

  } catch (error) {
    console.error("");
    console.error("====================================");
    console.error("          QUOTE TEST FAILED");
    console.error("====================================");

    if (error.response) {
      console.error(JSON.stringify(error.response, null, 2));
    } else {
      console.error(error.message || error);
    }

    console.error("====================================");
  } finally {
    rl.close();
  }
});