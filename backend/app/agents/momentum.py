from __future__ import annotations

from app.agents.base import AgentContext, BaseAgent
from app.schemas import AgentSignal
from app.services.indicators import adx, macd, rsi, sma


class MomentumAgent(BaseAgent):
    """Trend-following: RSI > 55, MACD bullish, ADX > 20, price above 50-DMA."""

    name = "momentum"

    def evaluate(self, ctx: AgentContext) -> AgentSignal:
        df = ctx.candles
        close = df["c"]
        r = float(rsi(close, 14).iloc[-1])
        m = macd(close)
        macd_bullish = bool(m["macd"].iloc[-1] > m["signal"].iloc[-1])
        macd_hist = float(m["hist"].iloc[-1])
        adx_v = float(adx(df, 14).iloc[-1])
        price = float(close.iloc[-1])
        dma50 = float(sma(close, 50).iloc[-1])
        above_trend = price > dma50

        score = 0
        score += 1 if r > 55 else 0
        score += 1 if macd_bullish else 0
        score += 1 if adx_v > 20 else 0
        score += 1 if above_trend else 0

        if score >= 3:
            verdict, conf = "buy", min(0.95, 0.55 + 0.1 * score)
            reason = (f"RSI {r:.1f}, MACD bullish={macd_bullish}, ADX {adx_v:.1f}, "
                      f"price {'above' if above_trend else 'below'} 50-DMA. "
                      "Trend and momentum both confirm upside continuation.")
        elif score == 0:
            verdict, conf = "sell", 0.65
            reason = "All momentum signals negative; favor selling/short bias."
        else:
            verdict, conf = "hold", 0.5
            reason = "Mixed momentum signals; await clearer confirmation."

        return AgentSignal(
            agent=self.name, verdict=verdict, confidence=conf, reasoning=reason,
            indicators={"rsi": round(r, 2), "macd_hist": round(macd_hist, 4),
                        "adx": round(adx_v, 2), "above_50dma": above_trend},
        )
