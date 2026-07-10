export type Mode = "paper" | "live";

export type Portfolio = {
  cash: number;
  equity: number;
  buying_power: number;
  portfolio_value: number;
  day_pnl: number;
  day_pnl_pct: number;
  total_pnl: number;
  total_pnl_pct: number;
  mode: Mode;
};

export type Position = {
  symbol: string;
  qty: number;
  avg_entry_price: number;
  current_price: number;
  market_value: number;
  unrealized_pnl: number;
  unrealized_pnl_pct: number;
};

export type Quote = {
  symbol: string;
  price: number;
  change: number;
  change_pct: number;
  volume: number;
  ts: string;
};

export type Candle = { t: string; o: number; h: number; l: number; c: number; v: number };

export type Order = {
  id: number;
  broker_order_id: string | null;
  symbol: string;
  side: "buy" | "sell";
  qty: number;
  order_type: string;
  status: string;
  filled_qty: number;
  filled_avg_price: number | null;
  mode: Mode;
  created_at: string;
  reasoning?: string | null;
  confidence?: number | null;
};

export type AgentSignal = {
  agent: string;
  verdict: "buy" | "sell" | "hold";
  confidence: number;
  reasoning: string;
  indicators: Record<string, unknown>;
};

export type TradeDecision = {
  symbol: string;
  verdict: "buy" | "sell" | "hold";
  confidence: number;
  reasoning: string;
  risk_reward: number | null;
  stop_loss: number | null;
  take_profit: number | null;
  signals: AgentSignal[];
  summary: string;
};

export type BacktestResult = {
  id: number;
  symbol: string;
  strategy: string;
  start: string;
  end: string;
  initial_capital: number;
  final_value: number;
  total_return_pct: number;
  sharpe: number;
  max_drawdown_pct: number;
  win_rate_pct: number;
  trades: { open: string; close: string; open_price: number; close_price: number; return_pct: number }[];
  equity_curve: { t: string; equity: number }[];
};

export type RiskLimits = {
  max_daily_loss_pct: number;
  max_position_pct: number;
  max_drawdown_pct: number;
  max_trades_per_day: number;
  cooldown_after_loss_min: number;
  kill_switch_armed: boolean;
};

export type NewsItem = {
  headline: string;
  source: string;
  url: string;
  published_at: string;
  sentiment: number | null;
};

export type ScanCandidate = {
  symbol: string;
  price: number;
  change_pct: number;
  volume: number;
  volume_surge: number;
  ai_score: number;
  verdict: "buy" | "sell" | "hold";
  confidence: number;
  stop_loss: number | null;
  take_profit: number | null;
  summary: string;
  scanned_at: string;
};

export type AutoTradeRecord = {
  id: string;
  symbol: string;
  side: "buy" | "sell";
  qty: number;
  price: number;
  order_id: string | null;
  verdict: "buy" | "sell" | "hold";
  confidence: number;
  reasoning: string;
  stop_loss: number | null;
  take_profit: number | null;
  status: string;
  executed_at: string;
};

export type AutoTradeStatus = {
  enabled: boolean;
  min_confidence: number;
  max_price: number;
  min_volume: number;
  max_position_pct: number;
  max_concurrent_positions: number;
  market_open: boolean;
  last_scan_at: string | null;
  scan_count: number;
  trades_today: number;
};

export type AutoTradeSettings = {
  min_confidence?: number;
  max_price?: number;
  min_volume?: number;
  max_position_pct?: number;
  max_concurrent_positions?: number;
};
