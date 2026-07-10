/**
 * Server-side Alpaca API helpers — used ONLY in Next.js route handlers (never imported on client).
 * Reads credentials from server-side env vars (no NEXT_PUBLIC_ prefix needed).
 */

const TRADING_BASE = process.env.ALPACA_BASE_URL ?? "https://paper-api.alpaca.markets";
const DATA_BASE = process.env.ALPACA_DATA_URL ?? "https://data.alpaca.markets";

export const alpacaHeaders = () => ({
  "APCA-API-KEY-ID": process.env.ALPACA_API_KEY_ID ?? "",
  "APCA-API-SECRET-KEY": process.env.ALPACA_API_SECRET_KEY ?? "",
  "Content-Type": "application/json",
});

export const isAlpacaConnected = () =>
  !!(process.env.ALPACA_API_KEY_ID && process.env.ALPACA_API_SECRET_KEY);

export const alpacaMode = () =>
  TRADING_BASE.includes("paper") ? "paper" : "live";

/** Fetch from Alpaca Trading API (orders, positions, account) */
export async function tradingFetch<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(`${TRADING_BASE}${path}`, {
    ...init,
    headers: { ...alpacaHeaders(), ...(init?.headers ?? {}) },
    cache: "no-store",
  });
  if (!r.ok) {
    const msg = await r.text().catch(() => r.statusText);
    throw new Error(`Alpaca trading ${path}: ${r.status} — ${msg}`);
  }
  return r.json() as Promise<T>;
}

/** Fetch from Alpaca Data API (bars, quotes, news, snapshots) */
export async function dataFetch<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(`${DATA_BASE}${path}`, {
    ...init,
    headers: { ...alpacaHeaders(), ...(init?.headers ?? {}) },
    cache: "no-store",
  });
  if (!r.ok) {
    const msg = await r.text().catch(() => r.statusText);
    throw new Error(`Alpaca data ${path}: ${r.status} — ${msg}`);
  }
  return r.json() as Promise<T>;
}

/** Get snapshot(s) for one or many symbols — includes latestTrade, dailyBar, prevDailyBar */
export async function getSnapshots(symbols: string[]): Promise<Record<string, AlpacaSnapshot>> {
  const qs = symbols.map(s => `symbols=${encodeURIComponent(s)}`).join("&");
  return dataFetch<Record<string, AlpacaSnapshot>>(`/v2/stocks/snapshots?${qs}&feed=iex`);
}

// ─── Alpaca response shapes ───────────────────────────────────────────────────

export interface AlpacaSnapshot {
  latestTrade?: { p: number; s: number; t: string };
  latestQuote?: { ap: number; as: number; bp: number; bs: number; t: string };
  minuteBar?: AlpacaBar;
  dailyBar?: AlpacaBar;
  prevDailyBar?: AlpacaBar;
}

export interface AlpacaBar {
  o: number; h: number; l: number; c: number; v: number; t: string;
}

/** Convert Alpaca snapshot to our Quote shape */
export function snapshotToQuote(symbol: string, snap: AlpacaSnapshot) {
  const price = snap.latestTrade?.p ?? snap.dailyBar?.c ?? 0;
  const prevClose = snap.prevDailyBar?.c ?? price;
  const change = price - prevClose;
  const change_pct = prevClose ? (change / prevClose) * 100 : 0;
  const volume = snap.dailyBar?.v ?? 0;
  return {
    symbol,
    price: +price.toFixed(4),
    change: +change.toFixed(4),
    change_pct: +change_pct.toFixed(4),
    volume,
    ts: new Date().toISOString(),
  };
}
