"""Penny-stock momentum agent.

Layered signal stack tuned for low-float, high-volatility sub-$5 equities:
  1. Volume Surge  — current volume vs 20-day avg (the most reliable penny signal)
  2. Price Breakout — price above the rolling 20-day high (range expansion)
  3. RSI Momentum  — RSI 14 in the 45-65 sweet spot (not overbought yet)
  4. VWAP Reclaim  — price crossed above intraday VWAP (institutional buying)
  5. Catalyst Flag — news in last 24h (from news_summary passed via context)

Scoring: each factor adds 1 point.  ≥ 4 → strong buy, ≥ 3 → moderate buy,
1-2 → hold, 0 → sell / avoid.
"""
from __future__ import annotations

import re
from datetime import datetime, timedelta, timezone

import pandas as pd

from app.agents.base import AgentContext, BaseAgent
from app.schemas import AgentSignal
from app.services.indicators import rsi, sma


class PennyMomentumAgent(BaseAgent):
    name = "penny_momentum"

    def evaluate(self, ctx: AgentContext) -> AgentSignal:
        df = ctx.candles
        close = df["c"]
        volume = df["v"] if "v" in df.columns else pd.Series(dtype=float)

        price = ctx.quote_price or float(close.iloc[-1])
        score = 0
        signals: list[str] = []

        # 1. Volume surge ──────────────────────────────────────────────────────
        vol_surge = 1.0
        if len(volume) >= 21:
            # Exclude today's bar from the 20-day average so surge is vs historical baseline
            avg_vol = float(volume.tail(21).iloc[:-1].mean())
            cur_vol = float(volume.iloc[-1])
            if avg_vol > 0:
                vol_surge = cur_vol / avg_vol
                if vol_surge >= 2.0:
                    score += 2  # strong surge counts double
                    signals.append(f"vol surge {vol_surge:.1f}×")
                elif vol_surge >= 1.5:
                    score += 1
                    signals.append(f"vol surge {vol_surge:.1f}×")

        # 2. Price breakout above 20-day high ─────────────────────────────────
        breakout = False
        if "h" in df.columns and len(df) >= 21:
            high20 = float(df["h"].tail(21).iloc[:-1].max())
            if price > high20:
                breakout = True
                score += 1
                signals.append(f"20-day breakout (high={high20:.3f})")

        # 3. RSI momentum ─────────────────────────────────────────────────────
        r_val: float | None = None
        if len(close) >= 15:
            try:
                r_val = float(rsi(close, 14).iloc[-1])
                if 45 <= r_val <= 72:
                    score += 1
                    signals.append(f"RSI {r_val:.1f}")
            except Exception:
                pass

        # 4. Price above short-term SMA (5-day) ───────────────────────────────
        above_sma5 = False
        if len(close) >= 5:
            try:
                sma5 = float(sma(close, 5).iloc[-1])
                above_sma5 = price > sma5
                if above_sma5:
                    score += 1
                    signals.append(f"above SMA5 ({sma5:.3f})")
            except Exception:
                pass

        # 5. News catalyst (recent headline) ─────────────────────────────────
        has_catalyst = False
        if ctx.news_summary:
            catalyst_keywords = r"(fda|approval|merger|acquisition|deal|contract|"
            catalyst_keywords += r"earnings|beat|upgrade|buy rating|partnership|"
            catalyst_keywords += r"breakthrough|launch|pivot|settlement|grant)"
            if re.search(catalyst_keywords, ctx.news_summary, re.IGNORECASE):
                has_catalyst = True
                score += 1
                signals.append("news catalyst")

        # 6. Low-price multiplier — reward sub-$1 setups ──────────────────────
        if price < 1.0 and score >= 3:
            score += 1  # sub-penny can have outsized % moves
            signals.append("sub-$1 bonus")

        # ── Map score → verdict ───────────────────────────────────────────────
        if score >= 5:
            verdict, conf = "buy", 0.92
        elif score >= 4:
            verdict, conf = "buy", 0.82
        elif score >= 3:
            verdict, conf = "buy", 0.68
        elif score <= 1:
            verdict, conf = "sell", 0.60
        else:
            verdict, conf = "hold", 0.50

        reasoning = (
            f"Penny momentum score {score}/7: {', '.join(signals) if signals else 'no signals'}. "
            f"Price ${price:.4f}, vol_surge={vol_surge:.1f}×"
            + (f", RSI={r_val:.1f}" if r_val is not None else "")
            + (f", catalyst={'yes' if has_catalyst else 'no'}")
            + "."
        )

        return AgentSignal(
            agent=self.name,
            verdict=verdict,
            confidence=conf,
            reasoning=reasoning,
            indicators={
                "price": round(price, 4),
                "vol_surge": round(vol_surge, 2),
                "breakout": breakout,
                "rsi": round(r_val, 2) if r_val is not None else None,
                "above_sma5": above_sma5,
                "has_catalyst": has_catalyst,
                "score": score,
            },
        )
