"""Penny-stock momentum agent.

Layered signal stack tuned for low-float, high-volatility sub-$5 equities:
  1. Volume Surge   — current volume vs 20-day avg (the most reliable penny signal)
  2. Price Breakout — price above the rolling 20-day high (range expansion)
  3. RSI Momentum   — RSI 14 in the 45-72 sweet spot (not overbought yet)
  4. Above SMA5     — price above short-term trend
  5. Catalyst Flag  — news in last 24h (from news_summary passed via context)
  6. $ Liquidity    — dollar volume (price × volume); ≥ $1M = institution-fillable.
                      This is the single most important filter: it separates the
                      ~5% of tradeable pennies from the 95% of illiquid junk.
  7. Price Quality  — sub-$0.50 names penalized (OTC/pink-sheet trap zone)

Scoring: factors add/subtract points. A "high-value" buy REQUIRES liquidity —
an illiquid penny can never earn a strong-buy verdict no matter how good the
chart looks, because you can't exit the position.
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

        # 6. Dollar-volume liquidity — the institutional-tradeability filter ───
        # Share volume alone is misleading for pennies (10M shares @ $0.02 = $200K,
        # untradeable). Dollar volume (price × volume) is what actually matters.
        dollar_volume = 0.0
        liquid = False
        if len(volume) >= 1:
            cur_vol = float(volume.iloc[-1])
            dollar_volume = price * cur_vol
            if dollar_volume >= 1_000_000:
                liquid = True
                score += 1
                signals.append(f"liquidity ${dollar_volume/1e6:.1f}M")
            elif dollar_volume < 250_000:
                # Illiquid trap — penalize hard so it can never be a strong buy.
                score -= 2
                signals.append(f"illiquid ${dollar_volume/1e3:.0f}K")

        # 7. Price-quality gate — punish sub-$0.50 OTC-style names ────────────
        if price < 0.50:
            score -= 1
            signals.append("sub-$0.50 risk")

        # 8. Low-price multiplier — reward liquid sub-$1 setups ────────────────
        if 0.50 <= price < 1.0 and score >= 3 and liquid:
            score += 1  # liquid sub-$1 can have outsized % moves
            signals.append("liquid sub-$1 bonus")

        # ── Map score → verdict ───────────────────────────────────────────────
        # High-conviction buys REQUIRE liquidity — an illiquid penny can never be
        # a strong buy no matter how good the chart looks (you can't exit it).
        high_value = liquid and price >= 0.50 and score >= 4
        if score >= 5 and liquid:
            verdict, conf = "buy", 0.92
        elif score >= 4 and liquid:
            verdict, conf = "buy", 0.82
        elif score >= 4:
            verdict, conf = "buy", 0.66  # capped: strong chart but thin liquidity
        elif score >= 3:
            verdict, conf = "buy", 0.68 if liquid else 0.58
        elif score <= 1:
            verdict, conf = "sell", 0.60
        else:
            verdict, conf = "hold", 0.50

        tier = "high-value" if high_value else ("momentum" if score >= 3 else "speculative")
        reasoning = (
            f"Penny {tier} score {score}: {', '.join(signals) if signals else 'no signals'}. "
            f"Price ${price:.4f}, vol_surge={vol_surge:.1f}×, "
            f"$vol={dollar_volume/1e6:.2f}M"
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
                "dollar_volume": round(dollar_volume),
                "liquid": liquid,
                "high_value": high_value,
                "tier": tier,
                "breakout": breakout,
                "rsi": round(r_val, 2) if r_val is not None else None,
                "above_sma5": above_sma5,
                "has_catalyst": has_catalyst,
                "score": score,
            },
        )
