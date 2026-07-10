from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import JSON, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


def _now() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    two_factor_secret: Mapped[Optional[str]] = mapped_column(String(64), default=None)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    orders: Mapped[list["Order"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    positions: Mapped[list["Position"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    settings: Mapped[Optional["UserSettings"]] = relationship(back_populates="user", uselist=False, cascade="all, delete-orphan")


class UserSettings(Base):
    __tablename__ = "user_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), unique=True)
    trading_mode: Mapped[str] = mapped_column(String(16), default="paper")
    risk_tolerance: Mapped[str] = mapped_column(String(16), default="moderate")
    max_position_pct: Mapped[float] = mapped_column(Float, default=10.0)
    max_daily_loss_pct: Mapped[float] = mapped_column(Float, default=2.0)
    max_trades_per_day: Mapped[int] = mapped_column(Integer, default=25)
    ai_aggressiveness: Mapped[int] = mapped_column(Integer, default=50)
    preferred_sectors: Mapped[Optional[dict]] = mapped_column(JSON, default=None)
    notifications: Mapped[Optional[dict]] = mapped_column(JSON, default=None)
    kill_switch_armed: Mapped[bool] = mapped_column(default=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now)

    user: Mapped["User"] = relationship(back_populates="settings")


class Order(Base):
    __tablename__ = "orders"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    broker_order_id: Mapped[Optional[str]] = mapped_column(String(64), index=True)
    symbol: Mapped[str] = mapped_column(String(16), index=True)
    side: Mapped[str] = mapped_column(String(8))                 # buy | sell
    qty: Mapped[float] = mapped_column(Float)
    order_type: Mapped[str] = mapped_column(String(16))          # market | limit | stop | stop_limit
    limit_price: Mapped[Optional[float]] = mapped_column(Float, default=None)
    stop_price: Mapped[Optional[float]] = mapped_column(Float, default=None)
    take_profit: Mapped[Optional[float]] = mapped_column(Float, default=None)
    stop_loss: Mapped[Optional[float]] = mapped_column(Float, default=None)
    status: Mapped[str] = mapped_column(String(16), default="pending")
    filled_qty: Mapped[float] = mapped_column(Float, default=0.0)
    filled_avg_price: Mapped[Optional[float]] = mapped_column(Float, default=None)
    mode: Mapped[str] = mapped_column(String(8), default="paper")
    reasoning: Mapped[Optional[str]] = mapped_column(Text, default=None)
    confidence: Mapped[Optional[float]] = mapped_column(Float, default=None)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now)

    user: Mapped["User"] = relationship(back_populates="orders")


class Position(Base):
    __tablename__ = "positions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    symbol: Mapped[str] = mapped_column(String(16), index=True)
    qty: Mapped[float] = mapped_column(Float)
    avg_entry_price: Mapped[float] = mapped_column(Float)
    market_value: Mapped[float] = mapped_column(Float, default=0.0)
    unrealized_pnl: Mapped[float] = mapped_column(Float, default=0.0)
    unrealized_pnl_pct: Mapped[float] = mapped_column(Float, default=0.0)
    opened_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now)

    user: Mapped["User"] = relationship(back_populates="positions")


class AuditLog(Base):
    __tablename__ = "audit_log"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), index=True)
    actor: Mapped[str] = mapped_column(String(64))               # user | agent | system
    event: Mapped[str] = mapped_column(String(64), index=True)
    payload: Mapped[Optional[dict]] = mapped_column(JSON, default=None)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, index=True)


class BacktestRun(Base):
    __tablename__ = "backtest_runs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), index=True)
    symbol: Mapped[str] = mapped_column(String(16))
    strategy: Mapped[str] = mapped_column(String(64))
    start_date: Mapped[str] = mapped_column(String(16))
    end_date: Mapped[str] = mapped_column(String(16))
    initial_capital: Mapped[float] = mapped_column(Float, default=100_000.0)
    final_value: Mapped[Optional[float]] = mapped_column(Float, default=None)
    total_return_pct: Mapped[Optional[float]] = mapped_column(Float, default=None)
    sharpe: Mapped[Optional[float]] = mapped_column(Float, default=None)
    max_drawdown_pct: Mapped[Optional[float]] = mapped_column(Float, default=None)
    win_rate_pct: Mapped[Optional[float]] = mapped_column(Float, default=None)
    trades: Mapped[Optional[dict]] = mapped_column(JSON, default=None)
    equity_curve: Mapped[Optional[dict]] = mapped_column(JSON, default=None)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
