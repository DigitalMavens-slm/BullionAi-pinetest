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

const API_BASE =
  import.meta.env.VITE_BULLIONAI_API_URL ||
  "http://localhost:8787";

export async function fetchCandles(
  timeframe: string,
  instrument: Instrument = "gold"
): Promise<CandleResponse> {
  const response = await fetch(
    `${API_BASE}/api/candles?timeframe=${encodeURIComponent(timeframe)}&instrument=${encodeURIComponent(instrument)}`
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
  instrument: Instrument = "gold"
): Promise<StrategyRunResponse> {
  const response = await fetch(
    `${API_BASE}/api/strategy?timeframe=${encodeURIComponent(timeframe)}&instrument=${encodeURIComponent(instrument)}`
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