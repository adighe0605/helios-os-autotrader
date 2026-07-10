"""Lightweight backtester. Long-only, full-allocation, daily bars."""
from __future__ import annotations

from typing import Callable

import numpy as np
import pandas as pd

from app.schemas import BacktestResult
from app.services.indicators import bollinger, max_drawdown, rsi, sharpe, sma
from app.services.market_data import get_market_data


Signal = pd.Series  # +1 long, 0 flat


def _signal_sma_cross(df: pd.DataFrame, fast: int = 20, slow: int = 50) -> Signal:
    f, s = sma(df["c"], fast), sma(df["c"], slow)
    return (f > s).astype(int)


def _signal_momentum(df: pd.DataFrame) -> Signal:
    r = rsi(df["c"], 14)
    trend = (df["c"] > sma(df["c"], 50)).astype(int)
    return ((r > 55) & (trend == 1)).astype(int)


def _signal_mean_reversion(df: pd.DataFrame) -> Signal:
    b = bollinger(df["c"], 20, 2.0)
    long = (df["c"] < b["lower"]).astype(int)
    exit_ = (df["c"] > b["mid"]).astype(int)
    sig = long.where(long == 1, np.nan)
    sig = sig.where(exit_ == 0, 0)
    return sig.ffill().fillna(0).astype(int)


def _signal_rsi(df: pd.DataFrame, low: int = 30, high: int = 70) -> Signal:
    r = rsi(df["c"], 14)
    sig = pd.Series(index=df.index, dtype=float)
    sig[r < low] = 1
    sig[r > high] = 0
    return sig.ffill().fillna(0).astype(int)


STRATS: dict[str, Callable[[pd.DataFrame], Signal]] = {
    "sma_cross": _signal_sma_cross,
    "momentum": _signal_momentum,
    "mean_reversion": _signal_mean_reversion,
    "rsi": _signal_rsi,
}


def run_backtest(symbol: str, strategy: str, start: str, end: str,
                 initial_capital: float = 100_000.0) -> dict:
    if strategy not in STRATS:
        raise ValueError(f"Unknown strategy '{strategy}'. Available: {list(STRATS)}")
    df = get_market_data().candles_df(symbol, tf="1d", limit=1000)
    df = df.loc[(df.index >= pd.to_datetime(start, utc=True)) & (df.index <= pd.to_datetime(end, utc=True))]
    if len(df) < 30:
        raise ValueError("Not enough data in selected date range")

    sig = STRATS[strategy](df).shift(1).fillna(0)
    rets = df["c"].pct_change().fillna(0)
    strat_rets = sig * rets
    equity = initial_capital * (1 + strat_rets).cumprod()

    # trade log: signal flips
    flips = sig.diff().fillna(sig.iloc[0])
    trades: list[dict] = []
    open_t = None
    open_px = None
    for t, change in flips.items():
        if change == 1:
            open_t, open_px = t, df.loc[t, "c"]
        elif change == -1 and open_t is not None:
            close_px = df.loc[t, "c"]
            trades.append({
                "open": str(open_t.date()), "close": str(t.date()),
                "open_price": round(float(open_px), 2), "close_price": round(float(close_px), 2),
                "return_pct": round(float((close_px / open_px - 1) * 100), 2),
            })
            open_t = None

    wins = [t for t in trades if t["return_pct"] > 0]
    win_rate = (len(wins) / len(trades) * 100) if trades else 0.0
    total_return_pct = float((equity.iloc[-1] / initial_capital - 1) * 100)

    curve = [{"t": str(idx.date()), "equity": round(float(v), 2)} for idx, v in equity.iloc[::max(1, len(equity)//200)].items()]

    return {
        "symbol": symbol, "strategy": strategy, "start": start, "end": end,
        "initial_capital": initial_capital,
        "final_value": round(float(equity.iloc[-1]), 2),
        "total_return_pct": round(total_return_pct, 2),
        "sharpe": round(sharpe(strat_rets), 3),
        "max_drawdown_pct": round(max_drawdown(equity), 2),
        "win_rate_pct": round(win_rate, 2),
        "trades": trades,
        "equity_curve": curve,
    }
