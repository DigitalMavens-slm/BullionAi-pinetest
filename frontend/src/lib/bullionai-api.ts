export type Candle = {
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
  openInterest?: number;
  time: number;
};

export type Instrument = "gold" | "silver" | "copper" | "lead" | "natural_gas" | "zinc" | "nickel" | "crude_oil";

export type DayStats = {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  prevClose: number | null;
  week52High?: number | null;
  week52Low?: number | null;
  range52Source?: string;
};

export type CandleResponse = {
  notice?: string | null;
  instrument: Instrument;
  symbol: string;
  name: string;
  timeframe: string;
  exchange: string;
  token: string;
  count: number;
  candles: Candle[];
  dayStats?: DayStats | null;
};

export type SignalEvent = {
  index: number;
  signal: "BUY" | "SELL";
  price: number;
  time: number;
  realizedPL?: number | null;
  exitTime?: number | null;
};

export type TrailPoint = {
  time: number;
  value: number;
  buy: boolean;
};

export type StrategyState = {
  available: boolean;
  signal: string | null;
  status: string | null;
  entryPrice: number | null;
  trailSL: number | null;
  extremeLabel: string | null;
  extremePrice: number | null;
  currentPL: number | null;
  bestPL: number | null;
  realizedPL: number | null;
  entryTime: number | null;
  exitTime: string | number | null;
  currentCandle?: Candle | null;
  candleCount?: number;
  lastCandleTime?: number | null;
  signalHistory?: SignalEvent[] | null;
  trailHistory?: TrailPoint[] | null;
  panel?: "fixed-target" | "trailing" | null;
  // Fixed-target (BullionAI-fixedtgt.pine) fields.
  target1?: number | string | null;
  target2?: number | string | null;
  sl?: number | string | null;
  target1Status?: string | null;
  target2Status?: string | null;
  maxPoints?: number | null;
};

export type MarketState = {
  connected: boolean;
  price: number | null;
  previousPrice: number | null;
  change: number | null;
  changePercent: number | null;
  tickCount: number;
  tickTime: number | null;
  receivedAt: number | null;
  lastTick?: {
    price?: number;
  } | null;
};

export type LivePriceInfo = {
  exchange?: string;
  token?: string;
  price: number | null;
  previousPrice: number | null;
  change: number | null;
  changePercent: number | null;
  tickCount: number;
  tickTime: number | null;
  receivedAt: number | null;
  connected: boolean;
};

export type StrategyRunResponse = {
  ok: boolean;
  instrument: Instrument;
  symbol: string;
  name?: string;
  timeframe: string;
  count?: number;
  strategy?: StrategyState;
  error?: string;
};

export type SegmentStatus = {
  status: "OPEN" | "CLOSED" | "PRE-OPEN" | "PAUSED" | "HALTED" | "UNKNOWN";
  label: string;
  open: boolean;
  tradingDay: boolean;
};

export type MarketStatus = {
  MCX?: SegmentStatus;
  NSE?: SegmentStatus;
  BSE?: SegmentStatus;
  SPOT?: SegmentStatus;
  open?: boolean;
};

export type BullionState = {
  timeframe: string;
  updatedAt: number;
  strategy: StrategyState;
  market: MarketState;
  marketStatus?: MarketStatus | null;
  segments?: SegmentSnapshot | null;
  livePrices?: {
    connected?: boolean;
    gold?: LivePriceInfo | null;
    silver?: LivePriceInfo | null;
    copper?: LivePriceInfo | null;
    lead?: LivePriceInfo | null;
    natural_gas?: LivePriceInfo | null;
    zinc?: LivePriceInfo | null;
    nickel?: LivePriceInfo | null;
    crude_oil?: LivePriceInfo | null;
  } | null;
};

// Per-instrument strategy/trade snapshot served by /api/state (segments).
// `recent` holds the newest signals (active + completed history, deduped by
// tradeUid, capped at 5) for this instrument.
export type RecentSignalTrade = {
  tradeUid: string;
  signal: string;
  status: string;
  entryPrice?: number | null;
  activeSL?: number | null;
  entrySL?: number | null;
  target1?: number | null;
  target2?: number | null;
  target1Status?: string | null;
  target2Status?: string | null;
  currentPL?: number | null;
  maxPoints?: number | null;
  entryTime?: number | null;
  exitTime?: number | null;
  result?: string | null;
  resultPoints?: number | null;
};

export type SegmentSnapshotEntry = {
  exchange?: string;
  symbol?: string;
  token?: string;
  timeframe?: string;
  status?: string;
  signal?: string;
  recent?: RecentSignalTrade[];
};

export type SegmentSnapshot = SegmentSnapshotEntry[] | null;

import { API_BASE } from "./api-base";

export async function fetchCandles(
  timeframe: string,
  instrument: Instrument = "gold",
  sym?: { exch: string; token: string; tsym: string } | null
): Promise<CandleResponse> {
  const response = await fetch(
    `${API_BASE}/api/candles?timeframe=${encodeURIComponent(timeframe)}&instrument=${encodeURIComponent(instrument)}${sym ? `&exchange=${encodeURIComponent(sym.exch)}&token=${encodeURIComponent(sym.token)}&tsym=${encodeURIComponent(sym.tsym)}` : ''}`
  );

  if (!response.ok) {
    throw new Error(
      `Failed to load candles: ${response.status}`
    );
  }

  return response.json();
}

export async function fetchState(): Promise<BullionState> {
  const response = await fetch(
    `${API_BASE}/api/state`
  );

  if (!response.ok) {
    throw new Error(
      `Failed to load state: ${response.status}`
    );
  }

  return response.json();
}

// =========================================================
// STRATEGY REQUEST DEDUPLICATION + SHORT-TTL CACHE
//
// Two independent frontend pollers (chart strategy + watchlist signals) both
// call fetchStrategy(). Without protection this amplifies /api/strategy
// traffic and triggers HTTP 429 rate-limiting.
//
// Layer guarantees:
//   - IN-FLIGHT COALESCING: identical concurrent requests share ONE network
//     call (single > one /api/strategy request).
//   - SHORT-TTL CACHE: a cached result is reused within STRATEGY_TTL_MS
//     (~8s) so back-to-back identical pollers don't double-fetch. TTL stays
//     small so a fresh BUY/SELL is never hidden for long.
//   - FULL-IDENTITY KEY: timeframe+instrument+exchange+token+tsym — results
//     are never shared across different instruments/timeframes.
//   - 429 HANDLING: a rate-limit response is surfaced as a controlled error
//     (not retried/stormed); the next normal poll recovers.
//
// No long-lived caching, no hidden signal suppression, no behavior change.
// =========================================================

type StrategyCacheEntry = {
  promise: Promise<StrategyRunResponse>;
  at: number;
};

const strategyCache = new Map<string, StrategyCacheEntry>();

// Small, configurable freshness window. Leave TTL SHORT so a new signal is
// reflected quickly. ~8s is safe (pollers run at 30s; coalescing handles the
// in-flight burst). Build-time override via import.meta.env.STRATEGY_TTL_MS.
const STRATEGY_TTL_MS = Number(
  (import.meta?.env?.STRATEGY_TTL_MS as string | undefined) || 8000
);

function strategyIdentity(url: string): string {
  return url;
}

// Return a merged Promise for an identical request. If a request is already
// in-flight, reuse its promise (dedup). If a recent cached result exists and
// is fresh, return it (short-TTL cache). Otherwise issue the network request.
function requestStrategy(url: string): Promise<StrategyRunResponse> {
  const key = strategyIdentity(url);

  const entry = strategyCache.get(key);
  const now = Date.now();

  if (entry) {
    // Fresh cached/in-flight result — reuse (never a duplicate network call).
    if (entry.at && now - entry.at < STRATEGY_TTL_MS) {
      return entry.promise;
    }
    // Expired in-flight? Re-issue but keep coalescing semantics.
    if (entry.promise && !entry.at) {
      return entry.promise;
    }
  }

  const promise = doFetchStrategy(url)
    .then((res) => {
      strategyCache.set(key, { promise, at: Date.now() });
      return res;
    })
    .catch((err) => {
      // On failure, remove so the next poll retries cleanly (no stale entry).
      if (strategyCache.get(key)?.promise === promise) {
        strategyCache.delete(key);
      }
      throw err;
    });

  strategyCache.set(key, { promise, at: 0 });

  return promise;
}

async function doFetchStrategy(url: string): Promise<StrategyRunResponse> {
  let response: Response;
  try {
    response = await fetch(url);
  } catch (err) {
    // Network-level failure (offline, DNS, CORS) — controlled, non-retried.
    throw new Error(
      `Strategy network error: ${(err as Error)?.message || "failed"}`
    );
  }

  if (response.status === 429) {
    // Rate-limited: honor Retry-After if present (seconds), else a sensible
    // default. Do NOT immediately retry — the next normal poll (30s) recovers.
    const retryAfter = Number(response.headers.get("retry-after"));
    const wait = Number.isFinite(retryAfter) ? retryAfter : 30;
    const err = new Error(
      `Strategy rate-limited (HTTP 429). Retry in ~${wait}s.`
    ) as Error & { status?: number; retryAfterSec?: number };
    err.status = 429;
    err.retryAfterSec = wait;
    throw err;
  }

  if (!response.ok) {
    const err = new Error(
      `Strategy request failed: ${response.status}`
    ) as Error & { status?: number };
    err.status = response.status;
    throw err;
  }

  return response.json();
}

export async function fetchStrategy(
  timeframe: string,
  instrument: Instrument = "gold",
  sym?: { exch: string; token: string; tsym: string } | null
): Promise<StrategyRunResponse> {
  const url =
    `${API_BASE}/api/strategy?timeframe=${encodeURIComponent(timeframe)}&instrument=${encodeURIComponent(instrument)}${sym ? `&exchange=${encodeURIComponent(sym.exch)}&token=${encodeURIComponent(sym.token)}&tsym=${encodeURIComponent(sym.tsym)}` : ''}`;

  return requestStrategy(url);
}

export function createStateStream(
  onState: (state: BullionState) => void,
  onError?: (error: Event) => void,
  onStatus?: (s: SseStatus) => void
) {
  const r = createResilientSource(
    `${API_BASE}/api/stream`,
    (s) => onStatus?.(s),
    (source) => {
      source.addEventListener(
        "state",
        event => {
          const data = (event as MessageEvent).data;
          if (!data || data.trim() === "" || data.trim() === "undefined") return;
          try {
            const state = JSON.parse(data);
            onState(state);
          } catch (error) {
            console.error("Invalid SSE state:", error);
          }
        }
      );
      // Legacy onError hook.
      source.onerror = event => onError?.(event);
    }
  );

  // Back-compat: expose .close()/.reconnect()/.status() so existing callers
  // that call source.close() keep working.
  return r;
}

export type SseStatus =
  | "connected"
  | "reconnecting"
  | "disconnected"
  | "connecting";

// A resilient EventSource wrapper with:
//   - callbacks for connection status (LIVE / RECONNECTING / DISCONNECTED)
//   - automatic exponential backoff reconnect (no duplicate connections)
//   - an explicit `reconnect()` that never reloads the page
//   - a `connected` flag so callers can guard against duplicate timers
export type ResilientSource = {
  source: EventSource;
  status: () => SseStatus;
  reconnect: () => void;
  close: () => void;
};

function createResilientSource(
  url: string,
  onStatus: (s: SseStatus) => void,
  setup: (src: EventSource) => void
): ResilientSource {
  let es: EventSource | null = null;
  let closed = false;
  let attempts = 0;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let status: SseStatus = "disconnected";

  const setStatus = (s: SseStatus) => {
    if (status !== s) {
      status = s;
      // Fire-and-forget; never disrupt React render with a stale callback.
      queueMicrotask(() => onStatus(s));
    }
  };

  const open = () => {
    if (closed) return;
    if (es) return; // never open a second connection
    setStatus(attempts > 0 ? "reconnecting" : "disconnected");

    let s: EventSource;
    try {
      s = new EventSource(url);
    } catch {
      setStatus("disconnected");
      scheduleReconnect();
      return;
    }
    es = s;

    s.onopen = () => {
      attempts = 0;
      setStatus("connected");
      clearReconnectTimer();
    };

    s.onerror = () => {
      setStatus("reconnecting");
      // EventSource fires error on disconnect; force-clean the current one
      // so it never keeps retrying with the browser default delay.
      try { s.close(); } catch {}
      if (es === s) es = null;
      scheduleReconnect();
    };

    setup(s);
  };

  const clearReconnectTimer = () => {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  };

  const scheduleReconnect = () => {
    if (closed || reconnectTimer) return;
    attempts += 1;
    const delay = Math.min(1000 * Math.pow(2, Math.min(attempts - 1, 6)), 30_000);
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      open();
    }, delay);
  };

  const api: ResilientSource = {
    get source() {
      return es as EventSource;
    },
    status: () => status,
    reconnect: () => {
      if (closed) return;
      clearReconnectTimer();
      // Destroy current connection so open() creates a fresh one (no dup).
      if (es) { try { es.close(); } catch {} es = null; }
      attempts = 0;
      open();
    },
    close: () => {
      closed = true;
      clearReconnectTimer();
      if (es) { try { es.close(); } catch {} es = null; }
    },
  };

  open();
  return api;
}

/* =========================================================
   INCREMENTAL EVENT STREAM — /api/events (phase 2)
   ========================================================= */

export type SegmentEventType =
  | "snapshot"
  | "tick"
  | "candle_update"
  | "candle_close"
  | "strategy"
  | "signal"
  | "trade_open"
  | "target1"
  | "target2"
  | "sl_update"
  | "trade_close"
  | "contract_change"
  | "connection_status"
  | "error";

export type SegmentEvent = {
  type: SegmentEventType;
  exchange?: string | null;
  symbol?: string | null;
  token?: string | null;
  timeframe?: string | null;
  at?: number;
  price?: number | null;
  timestamp?: number | null;
  volume?: number | null;
  candle?: Candle | null;
  signal?: string | null;
  status?: string | null;
  entryPrice?: number | null;
  trailSL?: number | null;
  currentPL?: number | null;
  bestPL?: number | null;
  realizedPL?: number | null;
  entryTime?: number | null;
  exitTime?: string | number | null;
  connected?: boolean;
  message?: string;
  state?: BullionState;
  marketStatus?: MarketStatus;
  prevToken?: string;
  prevSymbol?: string;
  nextToken?: string;
  nextSymbol?: string;
  nextExpiry?: number | null;
  reason?: string;
  entry?: number;
  sl?: number;
  target1?: number;
  target2?: number;
  result?: string;
  resultPoints?: number;
  maxPoints?: number;
  entrySL?: number;
  activeSL?: number;
  target1Status?: string;
  target2Status?: string;
};

export function createEventStream(
  onEvent: (event: SegmentEvent) => void,
  opts?: { types?: SegmentEventType[]; onSnapshot?: (snap: { state: BullionState; marketStatus?: MarketStatus }) => void; onError?: (e: Event) => void; onStatus?: (s: SseStatus) => void }
) {
  const types = opts?.types?.join(",") || "";
  const r = createResilientSource(
    `${API_BASE}/api/events${types ? `?types=${encodeURIComponent(types)}` : ""}`,
    (s) => opts?.onStatus?.(s),
    (source) => {
      const handle = (raw: string) => {
        // Guard against empty / malformed payloads (e.g. the "data:" line being
        // empty or literally "undefined"). Never let a bad frame crash the app.
        if (!raw || raw.trim() === "" || raw.trim() === "undefined") {
          return;
        }
        try {
          const data = JSON.parse(raw);
          if (data?.type === "snapshot" && opts?.onSnapshot) {
            opts.onSnapshot(data);
          }
          onEvent(data as SegmentEvent);
        } catch (e) {
          console.error("Invalid SSE event:", e);
        }
      };

      source.onmessage = event => {
        handle((event as MessageEvent).data);
      };

      // Some browsers deliver named events via addEventListener, so cover both.
      ["snapshot", "tick", "candle_update", "candle_close", "strategy", "signal", "trade_open", "target1", "target2", "sl_update", "trade_close", "contract_change", "connection_status", "error"].forEach(type => {
        source.addEventListener(type, (event: Event) => {
          handle((event as MessageEvent).data);
        });
      });

      source.onerror = event => {
        opts?.onError?.(event);
      };
    }
  );

  return r;
}

export type SymbolRow = {
  exch: string;
  token: string;
  symbol: string;
  tsym: string;
  lotSize: number | null;
};

export async function searchSymbols(
  q: string,
  exchange: string | null,
  limit = 20
): Promise<SymbolRow[]> {
  const u = new URL(API_BASE + "/api/symbols");
  u.searchParams.set("q", q);
  if (exchange) u.searchParams.set("exchange", exchange);
  u.searchParams.set("limit", String(limit));
  const r = await fetch(u);
  const d = await r.json();
  return (d.symbols || []) as SymbolRow[];
}
export async function subscribeSymbol(
  sym: { exch: string; token: string; tsym: string },
  unsubscribe?: Array<{ exch: string; token: string }>
) {
  await fetch(API_BASE + "/api/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...sym,
      unsubscribe: unsubscribe || [],
    }),
  }).catch(() => {});
}

export type InstrumentEntry = {
  exchange: string;
  token: string;
  symbol: string;
  tradingSymbol: string;
  instrumentType: string;
  expiry: number | null;
  lotSize: number | null;
  tickSize: number | null;
};

export async function getInstruments(
  exchange: string,
  q = ""
): Promise<InstrumentEntry[]> {
  const u = new URL(API_BASE + "/api/instruments");
  u.searchParams.set("exchange", exchange);
  if (q) u.searchParams.set("q", q);
  const r = await fetch(u);
  const d = await r.json();
  return (d.instruments || []) as InstrumentEntry[];
}

export type CurrentContract = {
  ok: boolean;
  resolved?: "registry" | "default";
  exchange?: string;
  instrument?: string;
  symbol?: string;
  token?: string;
  expiry?: number | null;
  expiryText?: string | null;
  error?: string;
};

// Backend Shoonya session lifecycle status (no secrets exposed).
export type ApiSessionStatus = {
  ok?: boolean;
  server?: string;
  api?: string;
  authenticated?: boolean;
  feedConnected?: boolean;
  status?:
    | "connected"
    | "disconnected"
    | "login_required"
    | "connecting"
    | "reconnecting"
    | "stale";
  feedState?: string;
  shoonya?: "authenticated" | "login_required";
  feed?: string;
  feedStarted?: boolean;
  feedReconnecting?: boolean;
  loginRequired?: boolean;
  uid?: string | null;
  actid?: string | null;
  authenticatedAt?: number | null;
  expiresAt?: number | null;
  expired?: boolean;
  lastTickAt?: number | null;
  started?: boolean;
  liveConnected?: boolean;
  market?: { connected?: boolean; price?: number | null } | null;
};

export async function getApiSessionStatus(): Promise<ApiSessionStatus> {
  try {
    const r = await fetch(`${API_BASE}/api/session/status`);
    return (await r.json()) as ApiSessionStatus;
  } catch {
    return { ok: false, status: "disconnected" };
  }
}

// Resolve the CURRENT active contract for an instrument (e.g. "silver",
// "gold") from the backend registry — never a hardcoded expiry.
export async function getCurrentContract(
  instrument: string
): Promise<CurrentContract> {
  const u = new URL(API_BASE + "/api/contract");
  u.searchParams.set("instrument", instrument);
  try {
    const r = await fetch(u);
    return (await r.json()) as CurrentContract;
  } catch {
    return { ok: false, error: "contract lookup failed" };
  }
}
