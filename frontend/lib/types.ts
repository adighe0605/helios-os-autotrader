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

export type TradeHistoryItem = {
  id: string;
  order_id: string | null;
  symbol: string;
  side: "buy" | "sell" | "buy_to_cover" | "sell_short";
  qty: number;
  price: number;
  gross_value: number;
  realized_pnl: number | null;
  running_position_qty: number;
  avg_cost_after: number | null;
  mode: Mode;
  executed_at: string;
};

export type TradeHistoryResponse = {
  range_days: number;
  summary: {
    total_trades: number;
    realized_pnl: number;
    wins: number;
    losses: number;
    turnover: number;
  };
  trades: TradeHistoryItem[];
};

export type AgentSignal = {
  agent: string;
  verdict: "buy" | "sell" | "hold";
  confidence: number;
  reasoning: string;
  indicators: Record<string, unknown>;
};

export type AgentContribution = {
  agent: string;
  weight: number;
  score: number;
  confidence: number;
  data_quality: number;
  freshness_minutes: number | null;
  verdict: "buy" | "sell" | "hold";
  weighted_score: number;
  supporting_data: string[];
  is_real_data: boolean;
  data_source: string;
};

export type TradeDecision = {
  symbol: string;
  verdict: "buy" | "sell" | "hold";
  confidence: number;
  confidence_score: number;
  score: number;
  recommendation: string;
  positionSize: string;
  risk: "Low" | "Medium" | "High" | "Extreme";
  agreement: "High" | "Medium" | "Low";
  bullishSignals: string[];
  bearishSignals: string[];
  conflictingSignals: string[];
  supportingEvidence: string[];
  nextReview: string;
  risk_vetoed: boolean;
  risk_veto_reason: string | null;
  agent_contributions: AgentContribution[];
  section_scores: Record<string, number>;
  section_data_status: Record<string, boolean>;
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
  penny_allocation_pct: number;
  other_allocation_pct: number;
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
  penny_allocation_pct?: number;
  other_allocation_pct?: number;
};
