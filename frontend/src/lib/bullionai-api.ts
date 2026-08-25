export type Candle = {
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
  openInterest?: number;
  time: number;
};

export type Instrument = "gold" | "silver";

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

export type WatchlistRow = {
  instrument: Instrument;
  tvName: string;
  symbol: string;
  name: string;
  price: number | null;
  open: number | null;
  dayHigh: number | null;
  dayLow: number | null;
  prevClose: number | null;
  change: number | null;
  changePct: number | null;
};

export async function fetchWatchlist(): Promise<
  WatchlistRow[]
> {
  const response = await fetch(
    `${API_BASE}/api/watchlist`
  );

  if (!response.ok) {
    throw new Error(
      `Watchlist failed: ${response.status}`
    );
  }

  const data = await response.json();

  return data.rows ?? [];
}

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

export type BullionState = {
  timeframe: string;
  updatedAt: number;
  strategy: StrategyState;
  market: MarketState;
  livePrices?: {
    connected?: boolean;
    gold?: LivePriceInfo | null;
    silver?: LivePriceInfo | null;
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
   SYMBOL SEARCH — typeahead over /api/symbols
   ========================================================= */

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
