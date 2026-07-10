"""Pure-numpy technical indicators. No pandas-ta dependency on the hot path."""
from __future__ import annotations

import numpy as np
import pandas as pd


def sma(series: pd.Series, window: int) -> pd.Series:
    return series.rolling(window=window, min_periods=1).mean()


def ema(series: pd.Series, window: int) -> pd.Series:
    return series.ewm(span=window, adjust=False).mean()


def rsi(close: pd.Series, period: int = 14) -> pd.Series:
    delta = close.diff()
    gain = delta.clip(lower=0).rolling(period).mean()
    loss = (-delta.clip(upper=0)).rolling(period).mean()
    rs = gain / loss.replace(0, np.nan)
    return (100 - (100 / (1 + rs))).fillna(50)


def macd(close: pd.Series, fast: int = 12, slow: int = 26, signal: int = 9) -> pd.DataFrame:
    macd_line = ema(close, fast) - ema(close, slow)
    signal_line = ema(macd_line, signal)
    hist = macd_line - signal_line
    return pd.DataFrame({"macd": macd_line, "signal": signal_line, "hist": hist})


def bollinger(close: pd.Series, window: int = 20, k: float = 2.0) -> pd.DataFrame:
    mid = sma(close, window)
    std = close.rolling(window).std()
    upper = mid + k * std
    lower = mid - k * std
    return pd.DataFrame({"mid": mid, "upper": upper, "lower": lower})


def atr(df: pd.DataFrame, period: int = 14) -> pd.Series:
    h, l, c = df["h"], df["l"], df["c"]
    prev_close = c.shift(1)
    tr = pd.concat([(h - l), (h - prev_close).abs(), (l - prev_close).abs()], axis=1).max(axis=1)
    return tr.rolling(period).mean()


def zscore(series: pd.Series, window: int = 20) -> pd.Series:
    mu = series.rolling(window).mean()
    sd = series.rolling(window).std()
    return ((series - mu) / sd).fillna(0)


def adx(df: pd.DataFrame, period: int = 14) -> pd.Series:
    h, l, c = df["h"], df["l"], df["c"]
    up = h.diff()
    down = -l.diff()
    plus_dm = ((up > down) & (up > 0)) * up
    minus_dm = ((down > up) & (down > 0)) * down
    atr_v = atr(df, period)
    plus_di = 100 * (plus_dm.rolling(period).mean() / atr_v)
    minus_di = 100 * (minus_dm.rolling(period).mean() / atr_v)
    dx = (100 * (plus_di - minus_di).abs() / (plus_di + minus_di).replace(0, np.nan)).fillna(0)
    return dx.rolling(period).mean().fillna(0)


def returns(close: pd.Series) -> pd.Series:
    return close.pct_change().fillna(0)


def sharpe(returns_series: pd.Series, periods_per_year: int = 252, rf: float = 0.0) -> float:
    excess = returns_series - rf / periods_per_year
    sd = excess.std()
    if not sd or np.isnan(sd):
        return 0.0
    return float(excess.mean() / sd * np.sqrt(periods_per_year))


def max_drawdown(equity: pd.Series) -> float:
    if equity.empty:
        return 0.0
    running_max = equity.cummax()
    dd = (equity - running_max) / running_max
    return float(dd.min() * 100)
