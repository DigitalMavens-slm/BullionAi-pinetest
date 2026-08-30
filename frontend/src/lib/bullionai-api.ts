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
  open?: boolean;
};

export type BullionState = {
  timeframe: string;
  updatedAt: number;
  strategy: StrategyState;
  market: MarketState;
  marketStatus?: MarketStatus | null;
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

export async function fetchStrategy(
  timeframe: string,
  instrument: Instrument = "gold",
  sym?: { exch: string; token: string; tsym: string } | null
): Promise<StrategyRunResponse> {
  const response = await fetch(
    `${API_BASE}/api/strategy?timeframe=${encodeURIComponent(timeframe)}&instrument=${encodeURIComponent(instrument)}${sym ? `&exchange=${encodeURIComponent(sym.exch)}&token=${encodeURIComponent(sym.token)}&tsym=${encodeURIComponent(sym.tsym)}` : ''}`
  );

  if (!response.ok) {
    throw new Error(
      `Strategy request failed: ${response.status}`
    );
  }

  return response.json();
}

export function createStateStream(
  onState: (state: BullionState) => void,
  onError?: (error: Event) => void
) {
  const source = new EventSource(
    `${API_BASE}/api/stream`
  );

  source.addEventListener(
    "state",
    event => {
      try {
        const state =
          JSON.parse(
            (event as MessageEvent).data
          );

        onState(state);
      } catch (error) {
        console.error(
          "Invalid SSE state:",
          error
        );
      }
    }
  );

  source.onerror = event => {
    onError?.(event);
  };

  return source;
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
  opts?: { types?: SegmentEventType[]; onSnapshot?: (snap: { state: BullionState; marketStatus?: MarketStatus }) => void; onError?: (e: Event) => void }
) {
  const types = opts?.types?.join(",") || "";
  const source = new EventSource(
    `${API_BASE}/api/events${types ? `?types=${encodeURIComponent(types)}` : ""}`
  );

  const handle = (raw: string) => {
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

  return source;
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
