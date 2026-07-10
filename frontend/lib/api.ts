import type {
  AutoTradeRecord, AutoTradeSettings, AutoTradeStatus,
  BacktestResult, Candle, NewsItem, Order, Portfolio, Position, Quote, RiskLimits, ScanCandidate, TradeDecision,
} from "./types";
import { mockPortfolio, mockPositions, mockCandles, mockNews, mockQuote, mockDecision, mockOrders, mockBacktest } from "./mock";

const API = process.env.NEXT_PUBLIC_API_URL || "/api";

async function req<T>(path: string, init?: RequestInit, fallback?: T): Promise<T> {
  try {
    const r = await fetch(`${API}${path}`, {
      ...init,
      headers: { "content-type": "application/json", ...(init?.headers || {}) },
      cache: "no-store",
    });
    if (!r.ok) throw new Error(await r.text());
    return (await r.json()) as T;
  } catch (e) {
    if (fallback !== undefined) return fallback;
    throw e;
  }
}

export const api = {
  health: () => req<{ ok: boolean; mode: string }>("/health", undefined, { ok: false, mode: "paper" }),

  portfolio: () => req<Portfolio>("/portfolio", undefined, mockPortfolio),
  positions: () => req<Position[]>("/positions", undefined, mockPositions),

  quote: (symbol: string) => req<Quote>(`/market/quote/${symbol}`, undefined, mockQuote(symbol)),
  candles: (symbol: string, tf = "1d", limit = 200) =>
    req<Candle[]>(`/market/candles/${symbol}?tf=${tf}&limit=${limit}`, undefined, mockCandles(symbol, limit)),
  news: (symbol: string, limit = 10) =>
    req<NewsItem[]>(`/market/news/${symbol}?limit=${limit}`, undefined, mockNews(symbol, limit)),
  movers: () =>
    req<{ gainers: Quote[]; losers: Quote[] }>("/market/movers", undefined,
      { gainers: ["NVDA", "AMD", "TSLA", "META", "AVGO"].map((s) => mockQuote(s)),
        losers:  ["INTC", "F", "WBA", "BA", "PFE"].map((s) => mockQuote(s)) }),

  orders: (status = "all") => req<Order[]>(`/orders?status=${status}`, undefined, mockOrders),
  placeOrder: (body: {
    symbol: string; side: "buy" | "sell"; qty: number; order_type?: string;
    limit_price?: number | null; stop_price?: number | null;
    take_profit?: number | null; stop_loss?: number | null; confirm_live?: boolean;
  }) => req<Order>("/orders", { method: "POST", body: JSON.stringify(body) }),
  cancelAll: () => req<{ canceled: number }>("/orders/cancel-all", { method: "POST" }, { canceled: 0 }),

  analyze: (symbol: string) =>
    req<TradeDecision>("/agents/analyze", { method: "POST", body: JSON.stringify({ symbol }) },
      mockDecision(symbol)),

  backtest: (body: { symbol: string; strategy: string; start: string; end: string; initial_capital?: number }) =>
    req<BacktestResult>("/backtest/run", { method: "POST", body: JSON.stringify(body) }, mockBacktest(body.symbol)),

  riskLimits: () =>
    req<RiskLimits>("/risk/limits", undefined,
      { max_daily_loss_pct: 2, max_position_pct: 10, max_drawdown_pct: 15,
        max_trades_per_day: 25, cooldown_after_loss_min: 15, kill_switch_armed: false }),
  updateRiskLimits: (body: Partial<RiskLimits>) =>
    req<RiskLimits>("/risk/limits", { method: "PATCH", body: JSON.stringify(body) }),
  killSwitch: (arm: boolean) =>
    req<{ armed: boolean; canceled_orders: number }>(`/risk/kill-switch?arm=${arm}`, { method: "POST" }),

  // ── Autonomous trading ────────────────────────────────────────────────────
  autoTradeStatus: () =>
    req<AutoTradeStatus>("/auto-trade/status", undefined, {
      enabled: false, min_confidence: 0.70, max_price: 5.0, min_volume: 300_000,
      max_position_pct: 3.0, max_concurrent_positions: 5,
      market_open: false, last_scan_at: null, scan_count: 0, trades_today: 0,
    }),
  autoTradeEnable: () => req<{ ok: boolean; enabled: boolean }>("/auto-trade/enable", { method: "POST" }),
  autoTradeDisable: () => req<{ ok: boolean; enabled: boolean }>("/auto-trade/disable", { method: "POST" }),
  autoTradeSettings: (body: AutoTradeSettings) =>
    req<AutoTradeStatus>("/auto-trade/settings", { method: "PATCH", body: JSON.stringify(body) }),
  autoTradeHistory: (limit = 50) =>
    req<AutoTradeRecord[]>(`/auto-trade/history?limit=${limit}`, undefined, []),
  pennyScanner: () =>
    req<ScanCandidate[]>("/auto-trade/scan", undefined, []),
  pennyUniverse: () =>
    req<{ symbols: string[] }>("/auto-trade/universe", undefined, { symbols: [] }),
  pennyUniverseAdd: (symbols: string[]) =>
    req<{ ok: boolean; universe_size: number }>("/auto-trade/universe",
      { method: "POST", body: JSON.stringify({ symbols }) }),
  pennyUniverseRemove: (symbols: string[]) =>
    req<{ ok: boolean; universe_size: number }>("/auto-trade/universe",
      { method: "DELETE", body: JSON.stringify({ symbols }) }),
};
