from __future__ import annotations

from app.agents.base import AgentContext, BaseAgent
from app.schemas import AgentSignal
from app.services.indicators import atr


class PortfolioManagerAgent(BaseAgent):
    """Sizes the position once a directional bias is established. Volatility-adjusted."""

    name = "portfolio_manager"

    def __init__(self, account_equity: float = 100_000.0, risk_pct: float = 0.5) -> None:
        self.account_equity = account_equity
        self.risk_pct = risk_pct  # % of equity to risk per trade

    def evaluate(self, ctx: AgentContext) -> AgentSignal:
        df = ctx.candles
        price = ctx.quote_price or float(df["c"].iloc[-1])
        atr_v = float(atr(df, 14).iloc[-1])
        if not atr_v or atr_v != atr_v:  # NaN guard
            atr_v = price * 0.02

        risk_per_share = max(atr_v * 1.5, price * 0.01)
        dollars_at_risk = self.account_equity * (self.risk_pct / 100)
        qty = max(1.0, dollars_at_risk / risk_per_share)
        stop_loss = round(price - risk_per_share, 2)
        take_profit = round(price + risk_per_share * 2.5, 2)

        reason = (f"Volatility-sized: ATR={atr_v:.2f}, risk/share=${risk_per_share:.2f}, "
                  f"risking ${dollars_at_risk:.0f} ({self.risk_pct}% of ${self.account_equity:,.0f}). "
                  f"Stop @ {stop_loss}, target @ {take_profit} (R:R = 1:2.5).")

        return AgentSignal(
            agent=self.name, verdict="hold", confidence=0.6, reasoning=reason,
            indicators={"suggested_qty": round(qty, 2), "stop_loss": stop_loss,
                        "take_profit": take_profit, "risk_per_share": round(risk_per_share, 2)},
        )
