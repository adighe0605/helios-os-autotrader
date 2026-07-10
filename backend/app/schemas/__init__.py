from datetime import datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field


# ---------- auth ----------
class LoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


# ---------- market ----------
class Quote(BaseModel):
    symbol: str
    price: float
    change: float
    change_pct: float
    volume: int
    bid: Optional[float] = None
    ask: Optional[float] = None
    ts: datetime


class Candle(BaseModel):
    t: datetime
    o: float
    h: float
    l: float
    c: float
    v: int


class NewsItem(BaseModel):
    headline: str
    source: str
    url: str
    published_at: datetime
    sentiment: Optional[float] = None


# ---------- portfolio / orders ----------
class PortfolioSummary(BaseModel):
    cash: float
    equity: float
    buying_power: float
    portfolio_value: float
    day_pnl: float
    day_pnl_pct: float
    total_pnl: float
    total_pnl_pct: float
    mode: Literal["paper", "live"]


class PositionOut(BaseModel):
    symbol: str
    qty: float
    avg_entry_price: float
    current_price: float
    market_value: float
    unrealized_pnl: float
    unrealized_pnl_pct: float


class OrderCreate(BaseModel):
    symbol: str
    side: Literal["buy", "sell"]
    qty: float = Field(gt=0)
    order_type: Literal["market", "limit", "stop", "stop_limit"] = "market"
    limit_price: Optional[float] = None
    stop_price: Optional[float] = None
    take_profit: Optional[float] = None
    stop_loss: Optional[float] = None
    confirm_live: bool = False


class OrderOut(BaseModel):
    id: int
    broker_order_id: Optional[str]
    symbol: str
    side: str
    qty: float
    order_type: str
    status: str
    filled_qty: float
    filled_avg_price: Optional[float]
    mode: str
    created_at: datetime
    reasoning: Optional[str] = None
    confidence: Optional[float] = None


# ---------- agents ----------
class AgentSignal(BaseModel):
    agent: str
    verdict: Literal["buy", "sell", "hold"]
    confidence: float
    reasoning: str
    indicators: dict[str, Any] = {}


class TradeDecision(BaseModel):
    symbol: str
    verdict: Literal["buy", "sell", "hold"]
    confidence: float
    reasoning: str
    risk_reward: Optional[float] = None
    stop_loss: Optional[float] = None
    take_profit: Optional[float] = None
    signals: list[AgentSignal]
    summary: str


# ---------- backtest ----------
class BacktestRequest(BaseModel):
    symbol: str
    strategy: Literal["momentum", "mean_reversion", "sma_cross", "rsi"] = "sma_cross"
    start: str
    end: str
    initial_capital: float = 100_000.0


class BacktestResult(BaseModel):
    id: int
    symbol: str
    strategy: str
    start: str
    end: str
    initial_capital: float
    final_value: float
    total_return_pct: float
    sharpe: float
    max_drawdown_pct: float
    win_rate_pct: float
    trades: list[dict]
    equity_curve: list[dict]


# ---------- risk ----------
class RiskLimits(BaseModel):
    max_daily_loss_pct: float
    max_position_pct: float
    max_drawdown_pct: float
    max_trades_per_day: int
    cooldown_after_loss_min: int
    kill_switch_armed: bool


# ---------- penny scanner ----------
class ScanCandidate(BaseModel):
    symbol: str
    price: float
    change_pct: float
    volume: int
    volume_surge: float          # ratio vs 20-day avg
    ai_score: float              # 0-1 composite score from agents
    verdict: Literal["buy", "sell", "hold"]
    confidence: float
    stop_loss: Optional[float] = None
    take_profit: Optional[float] = None
    summary: str = ""
    scanned_at: datetime


# ---------- autonomous trading ----------
class AutoTradeRecord(BaseModel):
    id: str
    symbol: str
    side: Literal["buy", "sell"]
    qty: float
    price: float
    order_id: Optional[str] = None
    verdict: Literal["buy", "sell", "hold"]
    confidence: float
    reasoning: str
    stop_loss: Optional[float] = None
    take_profit: Optional[float] = None
    status: str = "submitted"   # submitted | filled | rejected | canceled
    executed_at: datetime


class AutoTradeStatus(BaseModel):
    enabled: bool
    min_confidence: float
    max_price: float
    min_volume: int
    max_position_pct: float
    max_concurrent_positions: int
    market_open: bool
    last_scan_at: Optional[datetime] = None
    scan_count: int = 0
    trades_today: int = 0


class AutoTradeSettings(BaseModel):
    min_confidence: Optional[float] = None
    max_price: Optional[float] = None
    min_volume: Optional[int] = None
    max_position_pct: Optional[float] = None
    max_concurrent_positions: Optional[int] = None
