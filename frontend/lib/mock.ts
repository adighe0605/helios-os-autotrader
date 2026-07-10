import type {
  BacktestResult, Candle, NewsItem, Order, Portfolio, Position, Quote, TradeDecision,
} from "./types";

function seed(s: string) { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; }
function rng(s: string) { let v = seed(s) || 1; return () => ((v = (v * 1664525 + 1013904223) >>> 0) / 2 ** 32); }

export const mockPortfolio: Portfolio = {
  cash: 42_180.55,
  equity: 124_312.87,
  buying_power: 84_361.10,
  portfolio_value: 124_312.87,
  day_pnl: 1_287.45,
  day_pnl_pct: 1.04,
  total_pnl: 24_312.87,
  total_pnl_pct: 24.31,
  mode: "paper",
};

export const mockPositions: Position[] = [
  { symbol: "NVDA", qty: 42, avg_entry_price: 412.10, current_price: 478.20, market_value: 20_084.4, unrealized_pnl: 2_776.2, unrealized_pnl_pct: 16.04 },
  { symbol: "AAPL", qty: 50, avg_entry_price: 178.40, current_price: 192.55, market_value: 9_627.5,  unrealized_pnl: 707.5,   unrealized_pnl_pct: 7.93 },
  { symbol: "MSFT", qty: 18, avg_entry_price: 405.10, current_price: 418.62, market_value: 7_535.16, unrealized_pnl: 243.36,  unrealized_pnl_pct: 3.34 },
  { symbol: "TSLA", qty: 14, avg_entry_price: 248.30, current_price: 232.10, market_value: 3_249.4,  unrealized_pnl: -226.8,  unrealized_pnl_pct: -6.52 },
  { symbol: "META", qty: 20, avg_entry_price: 488.20, current_price: 512.74, market_value: 10_254.8, unrealized_pnl: 490.8,   unrealized_pnl_pct: 5.03 },
];

export function mockQuote(symbol: string): Quote {
  const r = rng(symbol);
  const price = 50 + r() * 400;
  const changePct = (r() - 0.5) * 6;
  return {
    symbol, price: +price.toFixed(2),
    change: +(price * changePct / 100).toFixed(2),
    change_pct: +changePct.toFixed(2),
    volume: Math.floor(1_000_000 + r() * 50_000_000),
    ts: new Date().toISOString(),
  };
}

export function mockCandles(symbol: string, limit: number): Candle[] {
  const r = rng(symbol);
  let p = 50 + r() * 400;
  const out: Candle[] = [];
  const now = Date.now();
  for (let i = 0; i < limit; i++) {
    const shock = (r() - 0.5) * 0.04;
    const drift = Math.sin(i / 7) * 0.005;
    const c = Math.max(1, p * (1 + drift + shock));
    const o = p;
    const h = Math.max(o, c) * (1 + r() * 0.01);
    const l = Math.min(o, c) * (1 - r() * 0.01);
    out.push({
      t: new Date(now - (limit - i) * 86_400_000).toISOString(),
      o: +o.toFixed(2), h: +h.toFixed(2), l: +l.toFixed(2), c: +c.toFixed(2),
      v: Math.floor(500_000 + r() * 20_000_000),
    });
    p = c;
  }
  return out;
}

export function mockNews(symbol: string, limit: number): NewsItem[] {
  const r = rng(symbol);
  const templates = [
    `${symbol} beats Q3 estimates as cloud revenue accelerates`,
    `Analysts upgrade ${symbol} on margin expansion`,
    `${symbol} faces headwinds from regulatory scrutiny`,
    `${symbol} announces $5B share buyback program`,
    `Hedge funds rotated into ${symbol} last quarter`,
    `${symbol} hires former Apple exec as new CFO`,
  ];
  return Array.from({ length: limit }, (_, i) => ({
    headline: templates[Math.floor(r() * templates.length)],
    source: ["Reuters", "Bloomberg", "WSJ", "CNBC"][Math.floor(r() * 4)],
    url: `https://example.com/${symbol.toLowerCase()}/${i}`,
    published_at: new Date(Date.now() - i * 3 * 3_600_000).toISOString(),
    sentiment: +(r() * 1.4 - 0.5).toFixed(2),
  }));
}

export const mockOrders: Order[] = [
  { id: 1, broker_order_id: "ord_1", symbol: "NVDA", side: "buy", qty: 10, order_type: "market", status: "filled", filled_qty: 10, filled_avg_price: 478.20, mode: "paper", created_at: new Date(Date.now() - 3600_000).toISOString(), reasoning: "Momentum agent: RSI 62, ADX 24, above 50-DMA", confidence: 0.78 },
  { id: 2, broker_order_id: "ord_2", symbol: "TSLA", side: "sell", qty: 5, order_type: "market", status: "filled", filled_qty: 5, filled_avg_price: 232.10, mode: "paper", created_at: new Date(Date.now() - 7200_000).toISOString(), reasoning: "Risk agent: vol spiked to 48%, reducing exposure", confidence: 0.66 },
];

export function mockDecision(symbol: string): TradeDecision {
  const r = rng(symbol);
  const verdict = r() > 0.5 ? "buy" : r() > 0.5 ? "sell" : "hold";
  return {
    symbol, verdict, confidence: +(0.55 + r() * 0.4).toFixed(2),
    reasoning: "Mock decision generated client-side because the backend is unavailable. Wire up FastAPI to see real multi-agent debates.",
    risk_reward: 2.4, stop_loss: 460, take_profit: 525,
    summary: "Mock debate: momentum and sentiment lean bullish, risk neutral. Suggested entry with 2.5:1 R:R.",
    signals: [
      { agent: "momentum",       verdict: "buy",  confidence: 0.78, reasoning: "RSI 62, MACD bullish, ADX 24",        indicators: { rsi: 62, adx: 24 } },
      { agent: "mean_reversion", verdict: "hold", confidence: 0.55, reasoning: "Price within 1σ of mean",              indicators: { zscore: 0.4 } },
      { agent: "sentiment",      verdict: "buy",  confidence: 0.7,  reasoning: "5 positive headlines vs 1 negative",    indicators: { score: 0.45 } },
      { agent: "risk",           verdict: "hold", confidence: 0.6,  reasoning: "Vol 28%, ATR 2.1%, acceptable",         indicators: { ann_vol_pct: 28 } },
    ],
  };
}

export function mockBacktest(symbol: string): BacktestResult {
  const curve = Array.from({ length: 120 }, (_, i) => ({
    t: new Date(Date.now() - (120 - i) * 86_400_000).toISOString().slice(0, 10),
    equity: 100_000 * (1 + Math.sin(i / 14) * 0.05 + i / 600),
  }));
  return {
    id: 1, symbol, strategy: "sma_cross", start: curve[0].t, end: curve[curve.length - 1].t,
    initial_capital: 100_000, final_value: curve[curve.length - 1].equity,
    total_return_pct: +((curve[curve.length - 1].equity / 100_000 - 1) * 100).toFixed(2),
    sharpe: 1.42, max_drawdown_pct: -8.7, win_rate_pct: 58.3,
    trades: [],
    equity_curve: curve.map((p) => ({ ...p, equity: +p.equity.toFixed(2) })),
  };
}
