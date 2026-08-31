const readline = require("readline");
const fs = require("fs");
const path = require("path");

const {
    formatISTDateTime,
} = require("../utils/ist-time");

// Postgres-backed session store (survives Render restarts). When
// DATABASE_URL is set the session token persists to the shoonya_sessions
// table; otherwise it falls back to the local JSON file.
const {
    saveShoonyaSession,
    getShoonyaSession,
    clearShoonyaSession,
} = require("./db");

class ShoonyaSessionManager {
    constructor(marketDataService) {
        if (!marketDataService) {
            throw new Error(
                "MarketDataService is required."
            );
        }

        this.market =
            marketDataService;

        this.authenticatedAt =
            null;

        this.expiresIn =
            null;

        this.expiresAt =
            null;

        this.uid =
            null;

        this.actid =
            null;
    }

    // =========================================================
    // AUTHENTICATE
    // =========================================================

    async authenticateWithCode(code) {
        if (!code) {
            throw new Error(
                "Shoonya authorization code is required."
            );
        }

        console.log(
            "Authenticating with Shoonya..."
        );

        const session =
            await this.market.authenticate(
                code
            );

        this.authenticatedAt =
            Date.now();

        this.expiresIn =
            session.expiresIn ??
            null;

        this.expiresAt =
            this.parseExpiry(
                this.expiresIn
            );

        this.uid =
            session.uid ??
            null;

        this.actid =
            session.actid ??
            null;

        /*
         * Persist so backend restarts
         * stay logged in for the day.
         */

        const saved =
            this.saveSession();

        console.log(
            "Fresh Shoonya session authenticated."
        );

        if (saved) {
            console.log(
                "Session saved."
            );
        }

        console.log(
            "Shoonya authentication successful."
        );

        console.log(
            "User:",
            this.uid
        );

        console.log(
            "Account:",
            this.actid
        );

        if (this.expiresAt) {
            console.log(
                "Session expiry:",
                formatISTDateTime(
                    this.expiresAt
                )
            );
        }

        return this.getState();
    }

    // =========================================================
    // SESSION PERSISTENCE
    // =========================================================

    getSessionFilePath() {

        return path.resolve(
            process.cwd(),
            "data",
            "shoonya-session.json"
        );

    }


    saveSession() {

        if (
            !this.market.isAuthenticated()
        ) {
            return false;
        }

        const snap =

            this.market.getSessionSnapshot();


        if (
            !snap.accessToken ||
            !snap.uid
        ) {
            return false;
        }

        // Persist to the durable store (Postgres in production) so a valid
        // session survives Render restarts/redeploys. The local file is kept
        // as a fallback for zero-config development.
        try {

            fs.writeFileSync(

                this.getSessionFilePath(),

                JSON.stringify(
                    {
                        accessToken:
                            snap.accessToken,

                        uid:
                            snap.uid,

                        actid:
                            snap.actid,

                        savedAt:
                            Date.now(),
                    },
                    null,
                    2
                ),

                "utf8"

            );

        } catch (
            error
        ) {

            console.error(
                "Failed to persist session file:",
                error.message
            );

        }

        return saveShoonyaSession({
            accessToken: snap.accessToken,
            uid: snap.uid,
            actid: snap.actid,
            savedAt: Date.now(),
        });

    }


    async restoreSession() {

        const file =
            this.getSessionFilePath();

        let data = null;

        // Prefer the durable store (Postgres survives Render restarts); fall
        // back to the local JSON file for zero-config development.
        const durable =
            await getShoonyaSession().catch(
                () => null
            );

        if (durable?.accessToken && durable?.uid) {

            data = {
                accessToken: durable.accessToken,
                uid: durable.uid,
                actid: durable.actid,
                savedAt: durable.savedAt,
            };

        } else if (fs.existsSync(file)) {

            try {

                data =
                    JSON.parse(
                        fs.readFileSync(
                            file,
                            "utf8"
                        )
                    );

            } catch {
                return false;
            }

        } else {

            return false;

        }


        if (

            !data?.accessToken ||
            !data?.uid

        ) {
            return false;
        }


        /*
         * Shoonya tokens are issued per
         * trading day; refuse to reuse
         * anything older than 12 hours.
         */

        const age =
            Date.now() -
            (data.savedAt ?? 0);


        if (
            age > 12 * 60 * 60 * 1000
        ) {

            console.log(
                "Stored session is stale, ignoring."
            );

            return false;

        }

        return this.applyStoredSession(data);

    }


    // Apply a validated session snapshot (durable or file) to the market
    // service and set local authenticated state.
    applyStoredSession(data) {

        try {

            this.market.applySession(
                {
                    accessToken:
                        data.accessToken,

                    uid:
                        data.uid,

                    actid:
                        data.actid,
                }
            );

        } catch (
            error
        ) {

            console.error(
                "Failed to apply stored session:",
                error.message
            );

            return false;

        }


        this.authenticatedAt =
            data.savedAt ??
            Date.now();

        this.uid =
            data.uid;

        this.actid =
            data.actid ??
            data.uid;

        this.expiresAt = null;


        return this.market.isAuthenticated();

    }


    clearPersistedSession() {

        try {

            fs.unlinkSync(
                this.getSessionFilePath()
            );

        } catch {
            // Best effort.
        }

        // Also clear the durable (Postgres) store so a dead session is never
        // resurrected on the next restart.
        clearShoonyaSession().catch(() => {});

    }


    // =========================================================
    // STORED SESSION VALIDATION
    //
    // A file on disk is NOT proof of a live
    // session. Ask Shoonya whether the
    // restored token is actually accepted.
    //
    // "valid"        -> token works
    // "invalid"      -> Shoonya rejected it
    // "inconclusive" -> network problem,
    //                   verdict unknown
    // =========================================================

    async validateStoredSession() {

        console.log(
            "Validating stored session..."
        );

        try {

            const valid =
                await this.market.verifySession();

            if (valid) {

                console.log(
                    "Stored Shoonya session validated."
                );

                return "valid";

            }

            console.log(
                "Stored Shoonya session rejected."
            );

            return "invalid";

        } catch (
            error
        ) {

            console.log(
                "Could not validate stored session:",
                error?.message || error
            );

            return "inconclusive";

        }

    }


    // =========================================================
    // SESSION INVALIDATION
    //
    // Drops in-memory credentials AND deletes
    // the persisted session so nothing can
    // keep using a token Shoonya rejected.
    // =========================================================

    invalidateSession() {

        this.market.clearSession();

        this.authenticatedAt =
            null;

        this.expiresIn =
            null;

        this.expiresAt =
            null;

        this.uid =
            null;

        this.actid =
            null;

        this.clearPersistedSession();

    }


    // =========================================================
    // PARSE SHOONYA EXPIRY
    // =========================================================

    parseExpiry(value) {
        if (
            value === null ||
            value === undefined ||
            value === ""
        ) {
            return null;
        }

        const numeric =
            Number(value);

        if (
            !Number.isFinite(
                numeric
            )
        ) {
            return null;
        }

        /*
         * Shoonya has returned an epoch-style
         * value in our tests, e.g.:
         *
         * 1795157623
         *
         * That's seconds since Unix epoch.
         *
         * Do NOT treat that as "1795157623
         * seconds from now".
         */

        if (
            numeric > 100000000000
        ) {
            // Already milliseconds.
            return numeric;
        }

        if (
            numeric > 1000000000
        ) {
            // Unix epoch seconds.
            return numeric * 1000;
        }

        /*
         * If the returned value is a small
         * duration rather than an epoch,
         * calculate from authentication time.
         */

        return (
            this.authenticatedAt +
            numeric * 1000
        );
    }

    // =========================================================
    // AUTHORIZATION CODE FROM REDIRECT URL
    // =========================================================

    extractCode(redirectUrl) {
        if (!redirectUrl) {
            throw new Error(
                "Shoonya redirect URL is required."
            );
        }

        let parsedUrl;

        try {
            parsedUrl =
                new URL(
                    redirectUrl
                );
        } catch {
            throw new Error(
                "Invalid Shoonya redirect URL."
            );
        }

        const code =
            parsedUrl.searchParams.get(
                "code"
            );

        if (!code) {
            throw new Error(
                "Authorization code not found in redirect URL."
            );
        }

        return code;
    }

    // =========================================================
    // AUTHENTICATE FROM DROP FILE
    //
    // The file may contain EITHER the full
    // Shoonya redirect URL OR the raw code.
    //
    // Returns true when a non-empty file was
    // found and consumed (deleted afterwards,
    // even if the code turns out to be invalid).
    // =========================================================

    async authenticateFromDropFile(
        filePath
    ) {
        const resolved =
            path.resolve(
                process.cwd(),
                filePath
            );

        if (
            !fs.existsSync(
                resolved
            )
        ) {

            return false;

        }

        const content =
            fs.readFileSync(
                resolved,
                "utf8"
            ).trim();


        /*
         * Delete first so a stale or
         * invalid code can never loop.
         */

        try {

            fs.unlinkSync(
                resolved
            );

        } catch {
            // Best effort.
        }


        if (!content) {
            return false;
        }


        console.log(
            "Auth drop file detected:",
            filePath
        );


        if (
            /^https?:\/\//i.test(
                content
            )
        ) {

            await this.authenticateFromRedirect(
                content
            );

        } else {

            await this.authenticateWithCode(
                content
            );

        }


        return true;

    }


    // =========================================================
    // AUTHENTICATE FROM REDIRECT
    // =========================================================

    async authenticateFromRedirect(
        redirectUrl
    ) {
        const code =
            this.extractCode(
                redirectUrl
            );

        console.log(
            "Authorization code detected."
        );

        return this.authenticateWithCode(
            code
        );
    }

    // =========================================================
    // INTERACTIVE LOGIN
    // =========================================================

    async authenticateFromConsole() {
        const rl =
            readline.createInterface({
                input:
                    process.stdin,

                output:
                    process.stdout,
            });

        const redirectUrl =
            await new Promise(
                resolve => {
                    rl.question(
                        "Paste fresh Shoonya redirect URL: ",
                        answer => {
                            rl.close();

                            resolve(
                                answer.trim()
                            );
                        }
                    );
                }
            );

        return this.authenticateFromRedirect(
            redirectUrl
        );
    }

    // =========================================================
    // EXPIRY CHECK
    // =========================================================

    isExpired() {
        if (!this.expiresAt) {
            return false;
        }

        return (
            Date.now() >=
            this.expiresAt
        );
    }

    // =========================================================
    // SESSION STATUS
    // =========================================================

    isAuthenticated() {
        return Boolean(
            this.market.isAuthenticated() &&
            this.uid &&
            !this.isExpired()
        );
    }

    // =========================================================
    // SESSION STATE
    // =========================================================

    getState() {
        return {
            authenticated:
                this.isAuthenticated(),

            uid:
                this.uid,

            actid:
                this.actid,

            authenticatedAt:
                this.authenticatedAt,

            expiresIn:
                this.expiresIn,

            expiresAt:
                this.expiresAt,

            expired:
                this.isExpired(),
        };
    }

    // =========================================================
    // REQUIRE AUTHENTICATION
    // =========================================================

    requireAuthentication() {
        if (!this.isAuthenticated()) {
            if (this.isExpired()) {
                throw new Error(
                    "Shoonya session has expired. Re-authentication is required."
                );
            }

            throw new Error(
                "Shoonya session is not authenticated."
            );
        }
    }

    // =========================================================
    // MARKET SERVICE
    // =========================================================

    getMarketDataService() {
        this.requireAuthentication();

        return this.market;
    }
}

module.exports = {
    ShoonyaSessionManager,
};
