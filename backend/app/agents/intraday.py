"""Intraday momentum agent.

Uses 5-minute candles to evaluate intraday entry timing on top of a
daily-trend confirmation.  Designed to work alongside PennyMomentumAgent
(penny stocks) and MomentumAgent (blue chips) — those agents assess the
*daily* trend; this agent decides *when today* to enter.

Signals scored (each worth 1 point unless noted):
  1. VWAP Bounce   — price above VWAP for the day  (+1, or +2 if just reclaimed)
  2. ORB Breakout  — price above 30-min opening-range high  (+2)
  3. ORB Hold      — price above ORB low (still inside range but bullish)  (+1)
  4. 5m RSI        — RSI(14) on 5m bars is 50-70 (momentum zone)  (+1)
  5. 5m Vol Surge  — last 5m bar volume > 1.5× avg 5m volume  (+1)
  6. Uptrend       — price above SMA20 on 5m bars  (+1)
  7. No Fade       — price NOT more than 1.5% below the intraday high  (+1)

Score mapping:  ≥5 → buy 0.88,  ≥4 → buy 0.75,  ≥3 → buy 0.62,
                ≤1 → sell 0.65, else → hold 0.50
"""
from __future__ import annotations

import pandas as pd

from app.agents.base import AgentContext, BaseAgent
from app.schemas import AgentSignal
from app.services.indicators import rsi, sma


def _vwap(df: pd.DataFrame) -> pd.Series:
    """Calculate VWAP from 5m OHLCV bars."""
    tp = (df["h"] + df["l"] + df["c"]) / 3
    vol = df["v"].replace(0, 1)  # avoid division by zero
    cum_tpv = (tp * vol).cumsum()
    cum_vol = vol.cumsum()
    return cum_tpv / cum_vol


class IntradayAgent(BaseAgent):
    name = "intraday"

    def evaluate(self, ctx: AgentContext) -> AgentSignal:
        df = ctx.candles  # expected: 5m bars for today (up to 78 bars for a full day)
        if df is None or len(df) < 6:
            return AgentSignal(
                agent=self.name, verdict="hold", confidence=0.50,
                reasoning="Insufficient intraday data (need ≥6 bars).",
                indicators={},
            )

        close = df["c"]
        high  = df["h"]
        low   = df["l"]
        vol   = df["v"] if "v" in df.columns else pd.Series([1] * len(df))

        price = ctx.quote_price or float(close.iloc[-1])
        score = 0
        signals: list[str] = []

        # 1. VWAP ──────────────────────────────────────────────────────────────
        vwap_series = _vwap(df)
        vwap_now = float(vwap_series.iloc[-1])
        above_vwap = price > vwap_now
        if above_vwap:
            # Extra point if price was BELOW vwap earlier and just reclaimed it
            prev_above = price > float(vwap_series.iloc[-2]) if len(vwap_series) > 1 else True
            if not prev_above:
                score += 2
                signals.append(f"VWAP reclaim ↑ ({vwap_now:.3f})")
            else:
                score += 1
                signals.append(f"above VWAP ({vwap_now:.3f})")

        # 2. Opening Range Breakout (first 6 bars = 30 min) ───────────────────
        orb_bars = df.head(6)
        orb_high = float(orb_bars["h"].max()) if len(orb_bars) >= 6 else None
        orb_low  = float(orb_bars["l"].min()) if len(orb_bars) >= 6 else None
        if orb_high is not None and len(df) > 6:
            if price > orb_high:
                score += 2
                signals.append(f"ORB breakout (high={orb_high:.3f})")
            elif orb_low is not None and price > orb_low:
                score += 1
                signals.append(f"inside ORB (hold above low={orb_low:.3f})")

        # 3. 5m RSI ────────────────────────────────────────────────────────────
        rsi_val: float | None = None
        if len(close) >= 15:
            try:
                rsi_val = float(rsi(close, 14).iloc[-1])
                if 50 <= rsi_val <= 70:
                    score += 1
                    signals.append(f"5m RSI {rsi_val:.1f}")
                elif rsi_val > 70:
                    signals.append(f"5m RSI overbought {rsi_val:.1f}")
            except Exception:
                pass

        # 4. 5m Volume Surge ───────────────────────────────────────────────────
        if len(vol) >= 10:
            avg_vol_5m = float(vol.tail(10).iloc[:-1].mean())
            cur_vol_5m = float(vol.iloc[-1])
            if avg_vol_5m > 0 and cur_vol_5m / avg_vol_5m >= 1.5:
                score += 1
                signals.append(f"5m vol surge {cur_vol_5m / avg_vol_5m:.1f}×")

        # 5. Price above 20-bar SMA (trend filter on 5m) ──────────────────────
        if len(close) >= 20:
            try:
                sma20 = float(sma(close, 20).iloc[-1])
                if price > sma20:
                    score += 1
                    signals.append(f"above 5m SMA20 ({sma20:.3f})")
            except Exception:
                pass

        # 6. No intraday fade — price within 1.5% of intraday high ────────────
        intraday_high = float(high.max())
        if intraday_high > 0 and (intraday_high - price) / intraday_high < 0.015:
            score += 1
            signals.append(f"near intraday high ({intraday_high:.3f})")

        # ── Map score → verdict ───────────────────────────────────────────────
        if score >= 5:
            verdict, conf = "buy", 0.88
        elif score >= 4:
            verdict, conf = "buy", 0.75
        elif score >= 3:
            verdict, conf = "buy", 0.62
        elif score <= 1:
            verdict, conf = "sell", 0.65
        else:
            verdict, conf = "hold", 0.50

        reasoning = (
            f"Intraday score {score}/8: {', '.join(signals) if signals else 'no signals'}. "
            f"Price=${price:.4f}, VWAP={vwap_now:.4f}"
            + (f", RSI5m={rsi_val:.1f}" if rsi_val is not None else "")
            + (f", ORB_H={orb_high:.3f}" if orb_high else "")
            + "."
        )

        return AgentSignal(
            agent=self.name,
            verdict=verdict,
            confidence=conf,
            reasoning=reasoning,
            indicators={
                "price": round(price, 4),
                "vwap": round(vwap_now, 4),
                "above_vwap": above_vwap,
                "orb_high": round(orb_high, 4) if orb_high else None,
                "orb_low": round(orb_low, 4) if orb_low else None,
                "rsi_5m": round(rsi_val, 2) if rsi_val is not None else None,
                "intraday_high": round(intraday_high, 4),
                "score": score,
            },
        )
