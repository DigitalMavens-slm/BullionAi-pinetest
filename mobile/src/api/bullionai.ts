// Shared with frontend/src/lib/bullionai-api.ts — keep in sync
export const API_BASE = "https://backend.bullionai.in";

export type PerfTrade = {
  tradeUid: string;
  symbol: string;
  signal: string;
  status: string;
  entryPrice: number | null;
  target1: number | null;
  target2: number | null;
  resultPoints: number | null;
  currentPL: number | null;
  entryTime: number | null;
};

export async function fetchPerfRecentSignals(): Promise<any> {
  const r = await fetch(`${API_BASE}/api/performance/recent-signals?timeframe=15m`);
  if (!r.ok) throw new Error(String(r.status));
  return r.json();
}
