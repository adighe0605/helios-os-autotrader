"""Risk manager. Sits in front of broker.place_order and rejects unsafe orders."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from threading import RLock

from app.brokers.base import BrokerAccount
from app.config import settings


@dataclass
class RiskCheck:
    ok: bool
    reason: str | None = None


class RiskManager:
    def __init__(self) -> None:
        self._lock = RLock()
        self._trades_today: list[datetime] = []
        self._last_loss_at: datetime | None = None
        self._day_start_equity: float | None = None
        self._kill_switch: bool = False
        self._limits = {
            "max_daily_loss_pct": settings.RISK_MAX_DAILY_LOSS_PCT,
            "max_position_pct": settings.RISK_MAX_POSITION_PCT,
            "max_drawdown_pct": settings.RISK_MAX_DRAWDOWN_PCT,
            "max_trades_per_day": settings.RISK_MAX_TRADES_PER_DAY,
            "cooldown_after_loss_min": settings.RISK_COOLDOWN_AFTER_LOSS_MIN,
        }

    @property
    def limits(self) -> dict:
        return {**self._limits, "kill_switch_armed": self._kill_switch}

    def update_limits(self, **kwargs) -> None:
        with self._lock:
            for k, v in kwargs.items():
                if k in self._limits:
                    self._limits[k] = v

    def arm_kill_switch(self, armed: bool) -> None:
        with self._lock:
            self._kill_switch = armed

    def record_trade(self, *, realized_pnl: float = 0.0) -> None:
        with self._lock:
            self._trades_today.append(datetime.now(timezone.utc))
            if realized_pnl < 0:
                self._last_loss_at = datetime.now(timezone.utc)

    def _rollover_day(self) -> None:
        now = datetime.now(timezone.utc)
        cutoff = now - timedelta(hours=24)
        self._trades_today = [t for t in self._trades_today if t > cutoff]

    def check_order(
        self, *, symbol: str, side: str, qty: float, price: float, account: BrokerAccount,
    ) -> RiskCheck:
        with self._lock:
            self._rollover_day()
            if self._kill_switch:
                return RiskCheck(False, "Kill switch is armed; all new orders blocked.")

            if self._day_start_equity is None:
                self._day_start_equity = account.equity

            if len(self._trades_today) >= self._limits["max_trades_per_day"]:
                return RiskCheck(False, "Daily trade count limit reached.")

            if self._last_loss_at:
                cool_until = self._last_loss_at + timedelta(minutes=self._limits["cooldown_after_loss_min"])
                if datetime.now(timezone.utc) < cool_until:
                    mins = int((cool_until - datetime.now(timezone.utc)).total_seconds() // 60) + 1
                    return RiskCheck(False, f"Loss cooldown active for {mins} more minute(s).")

            daily_loss_pct = ((account.equity - self._day_start_equity) / self._day_start_equity) * 100 \
                if self._day_start_equity else 0.0
            if daily_loss_pct <= -self._limits["max_daily_loss_pct"]:
                return RiskCheck(False, f"Max daily loss ({self._limits['max_daily_loss_pct']}%) breached.")

            if side == "buy":
                cost = qty * price
                pct = (cost / account.equity) * 100 if account.equity else 100.0
                if pct > self._limits["max_position_pct"]:
                    return RiskCheck(False, f"Order size {pct:.1f}% of equity exceeds cap "
                                            f"{self._limits['max_position_pct']}%.")
                if cost > account.buying_power:
                    return RiskCheck(False, "Insufficient buying power.")

            return RiskCheck(True)


_singleton = RiskManager()


def get_risk_manager() -> RiskManager:
    return _singleton
