// Daily Shoonya session check (Render cron).
//
// Runs once before the trading day (see render.yaml). It calls the
// backend's lightweight /api/session/status endpoint and:
//   - If the session is valid and the live feed is connected -> OK (no-op).
//   - If the session is missing/expired/feed disconnected -> alert the admin.
//
// Alert channels (in order of preference, no server-side SMTP needed):
//   1. Render's built-in email provider (SendGrid): set SENDGRID_FROM + SENDGRID_TO
//      and SENDGRID_API_KEY in the cron job env. Simplest, email only.
//   2. A generic webhook (e.g. Telegram, Slack, custom): set ALERT_WEBHOOK_URL.
//
// On success it prints "SESSION_OK", on failure "SESSION_ALERT:<reason>"
// so it's easy to read in the Render cron logs.

require("dotenv").config();

const BACKEND_URL =
    process.env.BACKEND_URL ||
    process.env.BULLIONAI_API_URL ||
    "http://127.0.0.1:8787";
const STATUS_ENDPOINT = `${BACKEND_URL.replace(/\/+$/, "")}/api/session/status`;

const SENDGRID_FROM = process.env.SENDGRID_FROM || "";
const SENDGRID_TO = process.env.SENDGRID_TO || "";
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY || "";
const ALERT_WEBHOOK_URL = process.env.ALERT_WEBHOOK_URL || "";
const ALERT_WEBHOOK_TOKEN = process.env.ALERT_WEBHOOK_TOKEN || "";

// Warn if the session expires within this many minutes (live token refresh).
const EXPIRY_WARN_MS =
    Number(process.env.SESSION_EXPIRY_WARN_MINUTES || 30) * 60 * 1000;

async function sendAlert(subject, text) {
    const errors = [];

    if (SENDGRID_API_KEY && SENDGRID_FROM && SENDGRID_TO) {
        try {
            await fetch("https://api.sendgrid.com/v3/mail/send", {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${SENDGRID_API_KEY}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    personalizations: [{ to: [{ email: SENDGRID_TO }] }],
                    from: { email: SENDGRID_FROM },
                    subject,
                    content: [{ type: "text/plain", value: text }],
                }),
            });
        } catch (e) {
            errors.push(`sendgrid: ${e?.message}`);
        }
    }

    if (ALERT_WEBHOOK_URL) {
        try {
            const headers = {
                "Content-Type": "application/json",
            };
            if (ALERT_WEBHOOK_TOKEN) {
                headers.Authorization = `Bearer ${ALERT_WEBHOOK_TOKEN}`;
            }
            await fetch(ALERT_WEBHOOK_URL, {
                method: "POST",
                headers,
                body: JSON.stringify({
                    text: `${subject}\n\n${text}`,
                }),
            });
        } catch (e) {
            errors.push(`webhook: ${e?.message}`);
        }
    }

    if (!SENDGRID_API_KEY && !ALERT_WEBHOOK_URL) {
        console.log(
            "SESSION_ALERT:" + text +
            " (no alert channel configured: set SENDGRID_* or ALERT_WEBHOOK_URL)"
        );
        return;
    }

    if (errors.length) {
        console.log(`SESSION_ALERT_DELIVERY_FAILED: ${errors.join("; ")}`);
    } else {
        console.log(
            `SESSION_ALERT_SENT: ${text}`
        );
    }
}

async function main() {
    let status = null;
    try {
        const res = await fetch(STATUS_ENDPOINT, { timeout: 20000 });
        if (!res.ok) {
            throw new Error(`HTTP ${res.status} ${res.statusText}`);
        }
        status = await res.json();
    } catch (e) {
        await sendAlert(
            "BullionAI: Shoonya session check FAILED (backend unreachable)",
            `Could not reach the backend status endpoint.\n\n` +
            `URL: ${STATUS_ENDPOINT}\nError: ${e?.message}\n\n` +
            `Check that the BullionAI web service is up and bound to ${BACKEND_URL}.`
        );
        return;
    }

    const session = status?.session || {};
    const started = Boolean(status?.started);
    const liveConnected = Boolean(status?.liveConnected);
    const expired = Boolean(session?.expired);
    const authenticated = Boolean(session?.authenticated);
    const isExpiringSoon =
        session?.expiresAt &&
        session.expiresAt <= Date.now() + EXPIRY_WARN_MS;

    const problems = [];
    if (!started) problems.push("backend coordinator not started");
    if (!authenticated) problems.push("Shoonya session not authenticated");
    if (expired) problems.push("Shoonya session expired");
    if (!liveConnected) problems.push("live market feed disconnected");
    if (isExpiringSoon) {
        problems.push(
            `Shoonya session expires soon (${new Date(session.expiresAt).toISOString()})`
        );
    }

    if (problems.length === 0) {
        console.log(
            `SESSION_OK: valid session, live feed connected (uid=${
                session.uid || "?"
            }, expires=${session.expiresAt || "n/a"})`
        );
        return;
    }

    const text =
        `Detected Shoonya session issues:\n` +
        ` - ${problems.join("\n - ")}\n\n` +
        `Live prices may be stale/paused. Re-authenticate Shoonya:\n` +
        `  1. Open ${BACKEND_URL}/api/shoonya/login\n` +
        `  2. Paste a fresh Shoonya redirect URL (single-use, ~30s)\n` +
        `  3. Confirm via ${BACKEND_URL}/health\n\n` +
        `Status snapshot: ${JSON.stringify(status)}`;

    await sendAlert(
        "BullionAI: Shoonya re-authentication required",
        text
    );
}

main().catch((e) => {
    console.error("SESSION_CHECK_ERROR:", e?.message || e);
    process.exit(1);
});
