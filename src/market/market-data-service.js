const { ShoonyaClient } = require("shoonya-api-js");

/*
 * Shared classifier for Shoonya
 * authentication rejections (HTTP 401/403,
 * expired token, session no longer valid).
 *
 * Deliberately does NOT match generic
 * "Not_Ok" business errors so unrelated
 * API failures are never mistaken for
 * an invalid session.
 */
function isShoonyaAuthFailure(error) {

    const message =
        String(
            error?.message ||
            error ||
            ""
        );

    return /http 40[13]|unauthorized|session expired|token expired|invalid token|invalid session|please login|authentication/i.test(
        message
    );

}

class MarketDataService {
    constructor({
        clientId,
        secretCode,
        exchange = "MCX",
        token = "483079",
        interval = "60",
        baseUrl = "https://api.shoonya.com",
    }) {
        if (!clientId) {
            throw new Error("Missing Shoonya client ID.");
        }

        if (!secretCode) {
            throw new Error("Missing Shoonya secret code.");
        }

        this.clientId = clientId;
        this.secretCode = secretCode;
        this.exchange = exchange;
        this.token = token;
        this.interval = interval;

        this.client = new ShoonyaClient({
            baseUrl,
        });

        this.uid = null;
        this.actid = null;
        this.session = null;
    }

    // =========================================================
    // AUTHENTICATION
    // =========================================================

    async authenticate(code) {
        if (!code) {
            throw new Error(
                "Shoonya authorization code is required."
            );
        }

        const checksum =
            ShoonyaClient.generateChecksum(
                this.clientId,
                this.secretCode,
                code
            );

        // Diagnostic + IP handling for INVALID_IP
        const redirectCfg =
            process.env.SHOONYA_REDIRECT_URL ||
            "not set";
        const whitelistedIp =
            process.env.SHOONYA_WHITELISTED_IP ||
            process.env.SHOONYA_CLIENT_IP ||
            "";
        if (whitelistedIp) {
            console.log(
                `[Shoonya] Using whitelisted IP override: ${whitelistedIp} (via X-Forwarded-For)`
            );
            // Patch ShoonyaClient to send whitelisted IP for GenAcsTok
            this.client._post = async (path, data) => {
                const url = `${this.client._base}${path}`;
                const body = `jData=${JSON.stringify(data)}`;
                const headers = {
                    "Content-Type":
                        "application/x-www-form-urlencoded",
                    "X-Forwarded-For": whitelistedIp,
                    "X-Real-IP": whitelistedIp,
                };
                if (this.client._token)
                    headers["Authorization"] =
                        `Bearer ${this.client._token}`;
                const res = await fetch(url, {
                    method: "POST",
                    headers,
                    body,
                });
                if (!res.ok) {
                    let Err = Error;
                    try {
                        Err =
                            require("shoonya-api-js/src/client")
                                .ShoonyaApiError || Error;
                    } catch {}
                    throw new Err(
                        `HTTP ${res.status}: ${res.statusText}`
                    );
                }
                let json;
                try {
                    json = await res.json();
                } catch {
                    throw new Error(
                        "Invalid JSON response from server"
                    );
                }
                if (json && json.stat === "Not_Ok") {
                    const err = new Error(
                        json.emsg || "API error"
                    );
                    err.response = json;
                    throw err;
                }
                return json;
            };
        }

        console.log(
            "[Shoonya] GenAcsTok →",
            `client=${this.clientId}`,
            `code=${String(code).slice(0, 8)}...`,
            `checksum=${checksum.slice(0, 8)}...`,
            `redirect=${redirectCfg}`,
            `whitelistedIp=${whitelistedIp || "none (using egress IP)"}`,
            `base=${this.client._base || "https://api.shoonya.com"}`
        );

        let session;
        try {
            session =
                await this.client.generateAccessToken({
                    code,
                    checksum,
                });
        } catch (error) {
            const msg = String(error?.message || error || "");
            const respStr = JSON.stringify(error?.response || "");
            const isIpError =
                msg.includes("INVALID_IP") ||
                respStr.includes("INVALID_IP");

            console.error(
                "[Shoonya] GenAcsTok FAILED:",
                error?.message || error,
                "| response:",
                JSON.stringify(
                    error?.response || {}
                ).slice(0, 800)
            );
            if (isIpError) {
                console.error(
                    `  >>> INVALID_IP FIX: Add this server's egress IP to Shoonya portal Allowed IPs.`
                );
                console.error(
                    `  >>> Check GET /api/shoonya/config for requestIp/egressIp.`
                );
                console.error(
                    `  >>> Or set SHOONYA_WHITELISTED_IP=<your whitelisted IP> in .env and restart to send X-Forwarded-For.`
                );
                console.error(
                    `  >>> Also ensure SHOONYA_REDIRECT_URL exactly matches the URL you use to login (including trailing slash). Current: ${redirectCfg}`
                );
            } else {
                console.error(
                    `  Config check: SHOONYA_CLIENT_ID=${this.clientId} ` +
                        `SHOONYA_REDIRECT_URL=${redirectCfg} ` +
                        `code_len=${String(code).length} checksum_len=${checksum.length}`
                );
            }
            throw error;
        } finally {
            // patched _post will be re-created next call if needed
        }

        this.session = session;

        this.uid =
            session.USERID ||
            session.uid;

        this.actid =
            session.actid ||
            this.uid;

        if (!this.uid) {
            throw new Error(
                "Shoonya authentication succeeded but UID was not returned."
            );
        }

        return {
            uid: this.uid,
            actid: this.actid,
            accessToken: session.access_token,
            expiresIn: session.expires_in,
        };
    }

    // =========================================================
    // SESSION CHECK
    // =========================================================

    isAuthenticated() {
        return Boolean(
            this.uid &&
            this.client
        );
    }

    // =========================================================
    // SESSION APPLY / SNAPSHOT
    //
    // Lets a previously issued access
    // token be re-applied after a
    // process restart instead of
    // forcing a fresh OAuth login.
    // =========================================================

    applySession({
        accessToken,
        uid,
        actid,
    }) {

        this.client.setSession({
            accessToken,
            uid,
            actid,
        });

        this.uid = uid;

        this.actid =
            actid ||
            uid;

        this.session = {
            access_token:
                accessToken,

            USERID: uid,

            actid:
                this.actid,
        };

    }


    getSessionSnapshot() {

        const s =

            this.client.getSession
                ? this.client.getSession()
                : {};


        return {
            accessToken:
                s.accessToken ??
                null,

            uid:

                this.uid ??
                s.uid ??
                null,

            actid:

                this.actid ??
                s.actid ??
                null,

        };

    }


    // =========================================================
    // SESSION VERIFICATION
    //
    // Local state proves nothing about what
    // Shoonya currently accepts. Probe the
    // server with a lightweight authenticated
    // call before trusting a restored token.
    //
    // Resolves true  -> token accepted
    // Resolves false -> Shoonya rejected it
    // Throws         -> network problem, verdict unknown
    // =========================================================

    async verifySession() {

        if (
            !this.isAuthenticated()
        ) {
            return false;
        }

        try {

            await this.client.getUserDetails();

            return true;

        } catch (
            error
        ) {

            if (
                isShoonyaAuthFailure(
                    error
                )
            ) {
                return false;
            }

            throw error;

        }

    }


    clearSession() {

        this.client.setSession({
            accessToken: null,
            uid: null,
            actid: null,
        });

        this.uid =
            null;

        this.actid =
            null;

        this.session =
            null;

    }

    // =========================================================
    // FETCH HISTORICAL CANDLES
    // =========================================================

    async getHistoricalCandles({
        startSeconds,
        endSeconds,
        exchange = this.exchange,
        token = this.token,
        interval = this.interval,
    }) {
        if (!this.uid) {
            throw new Error(
                "Shoonya authentication required before requesting candles."
            );
        }

        if (!Number.isFinite(Number(startSeconds))) {
            throw new Error(
                "Invalid startSeconds."
            );
        }

        if (!Number.isFinite(Number(endSeconds))) {
            throw new Error(
                "Invalid endSeconds."
            );
        }

        const payload = {
            uid: this.uid,
            exch: exchange,
            token: String(token),
            st: String(startSeconds),
            et: String(endSeconds),
            intrv: String(interval),
        };

        const response =
            await this.client._post(
                "/NorenWClientAPI/TPSeries",
                payload
            );

        if (!Array.isArray(response)) {
            throw new Error(
                "TPSeries did not return an array."
            );
        }

        return response;
    }

    // =========================================================
    // NORMALIZE SHOONYA CANDLE
    // =========================================================

    normalizeCandle(candle) {
        let timestampSeconds;

        // ---------------------------------------------
        // Preferred: Shoonya ssboe
        // ---------------------------------------------

        if (candle.ssboe !== undefined) {
            timestampSeconds =
                Number(candle.ssboe);
        }

        // ---------------------------------------------
        // Fallback: Shoonya time string
        // ---------------------------------------------

        else if (candle.time) {
            const parts =
                String(candle.time).split(" ");

            if (parts.length >= 2) {
                const dateParts =
                    parts[0].split("-");

                const timeParts =
                    parts[1].split(":");

                if (
                    dateParts.length === 3 &&
                    timeParts.length >= 2
                ) {
                    const day =
                        Number(dateParts[0]);

                    const month =
                        Number(dateParts[1]) - 1;

                    const year =
                        Number(dateParts[2]);

                    const hour =
                        Number(timeParts[0]);

                    const minute =
                        Number(timeParts[1]);

                    const second =
                        Number(
                            timeParts[2] || 0
                        );

                    const dt =
                        new Date(
                            year,
                            month,
                            day,
                            hour,
                            minute,
                            second
                        );

                    timestampSeconds =
                        Math.floor(
                            dt.getTime() / 1000
                        );
                }
            }
        }

        if (!Number.isFinite(timestampSeconds)) {
            return null;
        }

        return {
            open: Number(candle.into),

            high: Number(candle.inth),

            low: Number(candle.intl),

            close: Number(candle.intc),

            volume: Number(
                candle.v ??
                candle.intv ??
                0
            ),

            openInterest: Number(
                candle.oi ?? 0
            ),

            // Milliseconds for our internal format
            time:
                timestampSeconds * 1000,
        };
    }

    // =========================================================
    // NORMALIZE RESPONSE
    // =========================================================

    normalizeCandles(response) {
        if (!Array.isArray(response)) {
            throw new Error(
                "Invalid candle response."
            );
        }

        return response
            .filter(
                candle =>
                    candle.stat === "Ok"
            )
            .map(
                candle =>
                    this.normalizeCandle(candle)
            )
            .filter(
                candle =>
                    candle &&
                    this.isValidCandle(candle)
            );
    }

    // =========================================================
    // VALIDATE CANDLE
    // =========================================================

    isValidCandle(candle) {
        return (
            Number.isFinite(candle.time) &&
            Number.isFinite(candle.open) &&
            Number.isFinite(candle.high) &&
            Number.isFinite(candle.low) &&
            Number.isFinite(candle.close) &&
            Number.isFinite(candle.volume) &&
            Number.isFinite(candle.openInterest)
        );
    }

    // =========================================================
    // FETCH + NORMALIZE IN ONE CALL
    // =========================================================

    async fetchCandles({
        startSeconds,
        endSeconds,
        exchange = this.exchange,
        token = this.token,
        interval = this.interval,
    }) {
        const response =
            await this.getHistoricalCandles({
                startSeconds,
                endSeconds,
                exchange,
                token,
                interval,
            });

        return this.normalizeCandles(
            response
        );
    }

    // =========================================================
    // MERGE CANDLES
    // =========================================================

    mergeCandles(
        existingCandles,
        newCandles
    ) {
        const map = new Map();

        for (
            const candle of existingCandles || []
        ) {
            if (
                candle &&
                Number.isFinite(
                    Number(candle.time)
                )
            ) {
                map.set(
                    Number(candle.time),
                    candle
                );
            }
        }

        for (
            const candle of newCandles || []
        ) {
            if (
                candle &&
                Number.isFinite(
                    Number(candle.time)
                )
            ) {
                // New API response replaces
                // an existing candle with
                // the same timestamp.
                map.set(
                    Number(candle.time),
                    candle
                );
            }
        }

        return Array.from(
            map.values()
        ).sort(
            (a, b) =>
                a.time - b.time
        );
    }

    // =========================================================
    // CALCULATE UPDATE WINDOW
    // =========================================================

    getUpdateWindow({
        latestTime = 0,
        overlapSeconds = 2 * 60 * 60,
        lookbackSeconds = 7 * 24 * 60 * 60,
    } = {}) {
        const nowSeconds =
            Math.floor(
                Date.now() / 1000
            );

        let startSeconds;

        if (
            Number.isFinite(
                Number(latestTime)
            ) &&
            Number(latestTime) > 0
        ) {
            const latestSeconds =
                Math.floor(
                    Number(latestTime) / 1000
                );

            startSeconds =
                latestSeconds -
                overlapSeconds;
        } else {
            startSeconds =
                nowSeconds -
                lookbackSeconds;
        }

        return {
            startSeconds,
            endSeconds: nowSeconds,
        };
    }

    // =========================================================
    // UPDATE EXISTING DATASET
    // =========================================================

    async updateCandles(
        existingCandles = [],
        options = {}
    ) {
        let latestTime = 0;

        if (existingCandles.length > 0) {
            latestTime =
                Math.max(
                    ...existingCandles.map(
                        candle =>
                            Number(
                                candle.time
                            ) || 0
                    )
                );
        }

        const window =
            this.getUpdateWindow({
                latestTime,
                overlapSeconds:
                    options.overlapSeconds,
                lookbackSeconds:
                    options.lookbackSeconds,
            });

        const newCandles =
            await this.fetchCandles({
                startSeconds:
                    window.startSeconds,

                endSeconds:
                    window.endSeconds,

                exchange:
                    options.exchange ||
                    this.exchange,

                token:
                    options.token ||
                    this.token,

                interval:
                    options.interval ||
                    this.interval,
            });

        const updatedCandles =
            this.mergeCandles(
                existingCandles,
                newCandles
            );

        return {
            candles: updatedCandles,
            fetched: newCandles.length,
            previousCount:
                existingCandles.length,
            updatedCount:
                updatedCandles.length,
            added:
                Math.max(
                    0,
                    updatedCandles.length -
                    existingCandles.length
                ),
            startSeconds:
                window.startSeconds,
            endSeconds:
                window.endSeconds,
        };
    }
}

module.exports = {
    MarketDataService,
    isShoonyaAuthFailure,
};