/*
 * Push Service — fans out Expo push notifications for BUY/SELL, TGT1, SL, TGT2.
 * Uses push-store for tokens/preferences and auth/db for user hasAccess filter.
 * Sends via https://exp.host/--/api/v2/push/send
 */

const pushStore = require("./push-store");

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const CHANNEL_ID = "bullionai-signals";

function chunk(arr, n) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

function scriptKey(exch, token) {
  return `${String(exch || "").toUpperCase()}:${String(token || "")}`;
}

function buildContent(eventType, ctx) {
  const { exchange, token, symbol, label, timeframe, signal, entryPrice, target1, target2, sl, currentPrice, result } = ctx;
  const exch = String(exchange || "MCX").toUpperCase();
  const symLabel = String(label || symbol || token || "").toUpperCase();
  const tf = String(timeframe || "15m");
  const sig = String(signal || "").toUpperCase();

  // titles per event
  if (eventType === "trade_open") {
    const title = `${sig} Signal: ${symLabel} (${exch})`;
    const body = `${symLabel} ${sig} @ ${entryPrice ?? "—"}  SL ${sl ?? "—"}  T1 ${target1 ?? "—"}  T2 ${target2 ?? "—"}  [${tf}]`;
    return { title, body };
  }
  if (eventType === "target1") {
    const title = `TGT1 Achieved: ${symLabel} (${exch})`;
    const body = `${symLabel} ${sig} — TGT1 hit @ ${target1 ?? "—"}, SL trailed. [${tf}]`;
    return { title, body };
  }
  if (eventType === "sl") {
    const title = `SL Triggered: ${symLabel} (${exch})`;
    const body = result ? `${symLabel} ${sig} — ${result} [${tf}]` : `${symLabel} ${sig} — Stop loss hit @ ${currentPrice ?? sl ?? "—"} [${tf}]`;
    return { title, body };
  }
  if (eventType === "tgt2" || eventType === "target2") {
    const title = `TGT2 Achieved: ${symLabel} (${exch})`;
    const body = result ? `${symLabel} ${sig} — ${result} [${tf}]` : `${symLabel} ${sig} — TGT2 hit @ ${target2 ?? "—"} [${tf}]`;
    return { title, body };
  }
  const title = `BullionAI: ${symLabel} (${exch})`;
  const body = `${eventType} ${symLabel} ${sig} [${tf}]`;
  return { title, body };
}

async function sendExpoPush(messages) {
  if (!messages.length) return { ok: true, sent: 0 };
  const chunks = chunk(messages, 90);
  let sent = 0;
  const errors = [];
  for (const c of chunks) {
    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json", "Accept-Encoding": "gzip, deflate" },
        body: JSON.stringify(c),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        errors.push(data);
        console.warn("[push] Expo push chunk failed:", res.status, JSON.stringify(data).slice(0, 500));
      } else {
        // data.data is array of tickets; count non-error tickets
        const tickets = data.data || data.errors || [];
        // Expo returns {data: [{status: 'ok', id}, {status:'error', message}]}
        for (const t of tickets) {
          if (t.status === "ok") sent++;
          else errors.push(t);
        }
        if (!tickets.length && data.ok !== false) sent += c.length;
      }
    } catch (e) {
      errors.push(String(e?.message || e));
      console.warn("[push] Expo push fetch error:", e?.message || e);
    }
  }
  if (errors.length) console.warn("[push] send completed with errors:", errors.slice(0, 5));
  return { ok: errors.length === 0, sent, errors: errors.slice(0, 10) };
}

async function fanout(eventType, ctx) {
  try {
    const exch = String(ctx.exchange || "").toUpperCase();
    const token = String(ctx.token || "");
    if (!exch || !token) return;
    const key = scriptKey(exch, token);

    // 1) Load active users (hasAccess) and their segments
    let activeEmails = new Set();
    try {
      const db = require("../auth/db");
      const users = await db.listUsers();
      const { accessInfo } = require("../auth/users");
      for (const u of users) {
        try {
          const info = accessInfo(u);
          if (!info.hasAccess) continue;
          activeEmails.add(String(u.email).toLowerCase());
        } catch {}
      }
    } catch (e) {
      console.warn("[push] fanout listUsers failed:", e?.message || e);
      return;
    }
    if (!activeEmails.size) return;

    // 2) Load all push tokens, filter to active users
    const allTokens = await pushStore.listAllTokens();
    const candidates = allTokens.filter((t) => activeEmails.has(String(t.email).toLowerCase()));
    if (!candidates.length) return;

    // 3) For each token, check preferences
    const messages = [];
    const cachePrefs = new Map();
    for (const tok of candidates) {
      const email = String(tok.email).toLowerCase();
      let prefs = cachePrefs.get(email);
      if (!prefs) {
        try {
          prefs = await pushStore.getPreferences(email);
        } catch {
          prefs = { enabled: true, scripts: {} };
        }
        cachePrefs.set(email, prefs);
      }
      if (prefs.enabled === false) continue;
      // script-level toggle: if explicitly false, skip; undefined => default true
      if (prefs.scripts && Object.prototype.hasOwnProperty.call(prefs.scripts, key) && prefs.scripts[key] === false) continue;
      // Build notification content
      const label = ctx.label || ctx.symbol || token;
      const content = buildContent(eventType, { ...ctx, label });
      messages.push({
        to: tok.expo_token,
        title: content.title,
        body: content.body,
        data: {
          event: eventType,
          exchange: exch,
          token,
          symbol: ctx.symbol || label,
          timeframe: ctx.timeframe || "15m",
          signal: ctx.signal || "",
          url: `bullionai://signals?exch=${exch}&token=${token}&tf=${ctx.timeframe || "15m"}`,
        },
        sound: "default",
        priority: "high",
        channelId: CHANNEL_ID,
      });
    }
    if (!messages.length) return;
    const res = await sendExpoPush(messages);
    console.log(`[push] ${eventType} ${key} -> ${res.sent}/${messages.length} sent${res.errors?.length ? ` (${res.errors.length} errors)` : ""}`);
  } catch (e) {
    console.warn("[push] fanout error:", e?.message || e);
  }
}

// Convenience wrappers
function onTradeOpen(ctx) {
  return fanout("trade_open", ctx);
}
function onTarget1(ctx) {
  return fanout("target1", ctx);
}
function onSL(ctx) {
  return fanout("sl", ctx);
}
function onTGT2(ctx) {
  return fanout("tgt2", ctx);
}

module.exports = {
  fanout,
  onTradeOpen,
  onTarget1,
  onSL,
  onTGT2,
  buildContent,
  sendExpoPush,
  CHANNEL_ID,
};
