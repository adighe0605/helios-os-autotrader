from __future__ import annotations

import numpy as np

from app.agents.base import AgentContext, BaseAgent
from app.schemas import AgentSignal
from app.services.indicators import atr, max_drawdown


class RiskAgent(BaseAgent):
    """Estimate downside via realized vol, ATR, and rolling drawdown. Down-weights aggressive entries."""

    name = "risk"

    def evaluate(self, ctx: AgentContext) -> AgentSignal:
        df = ctx.candles
        close = df["c"]
        rets = close.pct_change().dropna()
        ann_vol = float(rets.std() * np.sqrt(252) * 100) if len(rets) else 0.0
        atr_v = float(atr(df, 14).iloc[-1])
        atr_pct = (atr_v / float(close.iloc[-1])) * 100 if len(close) else 0.0
        dd = abs(max_drawdown(close.tail(120)))

        risk_score = (ann_vol / 30.0) + (dd / 20.0) + (atr_pct / 3.0)

        if risk_score < 2.0:
            verdict, conf = "buy", 0.65
            reason = (f"Risk profile acceptable: annualized vol {ann_vol:.1f}%, ATR {atr_pct:.2f}% of price, "
                      f"recent drawdown {dd:.1f}%. Position sizing comfortable.")
        elif risk_score < 3.5:
            verdict, conf = "hold", 0.55
            reason = (f"Elevated risk: vol {ann_vol:.1f}%, drawdown {dd:.1f}%. Reduce size or wait.")
        else:
            verdict, conf = "sell", 0.7
            reason = (f"Risk too high: vol {ann_vol:.1f}%, drawdown {dd:.1f}%, ATR {atr_pct:.2f}%. "
                      "Avoid entry or reduce exposure.")

        return AgentSignal(
            agent=self.name, verdict=verdict, confidence=conf, reasoning=reason,
            indicators={"ann_vol_pct": round(ann_vol, 2), "atr_pct": round(atr_pct, 3),
                        "recent_drawdown_pct": round(dd, 2), "risk_score": round(risk_score, 2)},
        )
