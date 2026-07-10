from __future__ import annotations

from app.agents.base import AgentContext, BaseAgent
from app.schemas import AgentSignal
from app.services.indicators import bollinger, rsi, zscore


class MeanReversionAgent(BaseAgent):
    """Look for stretched conditions: low RSI + below lower Bollinger + negative z-score."""

    name = "mean_reversion"

    def evaluate(self, ctx: AgentContext) -> AgentSignal:
        df = ctx.candles
        close = df["c"]
        r = float(rsi(close, 14).iloc[-1])
        b = bollinger(close, 20, 2.0)
        z = float(zscore(close, 20).iloc[-1])
        price = float(close.iloc[-1])
        below_lower = price < float(b["lower"].iloc[-1])
        above_upper = price > float(b["upper"].iloc[-1])

        if r < 30 and (below_lower or z < -1.5):
            verdict, conf = "buy", 0.7
            reason = (f"RSI {r:.1f} indicates oversold; price below lower Bollinger and z-score {z:.2f}. "
                      "Statistical mean-reversion edge favors a long entry.")
        elif r > 70 and (above_upper or z > 1.5):
            verdict, conf = "sell", 0.7
            reason = (f"RSI {r:.1f} overbought; price above upper Bollinger and z-score {z:.2f}. "
                      "Expect a pullback toward the mean.")
        else:
            verdict, conf = "hold", 0.5
            reason = "Price near fair-value mean; no mean-reversion setup."

        return AgentSignal(
            agent=self.name, verdict=verdict, confidence=conf, reasoning=reason,
            indicators={"rsi": round(r, 2), "zscore": round(z, 3),
                        "below_lower_bb": below_lower, "above_upper_bb": above_upper},
        )
