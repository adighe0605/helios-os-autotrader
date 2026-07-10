"""Market data service.
Priority order:
  1. Alpaca Data API  (when ALPACA_API_KEY_ID + ALPACA_API_SECRET_KEY are set)
  2. yfinance         (free, no key needed, slight delay)
  3. Deterministic mock (so the app always boots, even without network)
"""
from __future__ import annotations

import hashlib
import math
import random
from datetime import datetime, timedelta, timezone
from functools import lru_cache
from typing import Optional

import pandas as pd

from app.schemas import Candle, NewsItem, Quote


class MarketData:
    def quote(self, symbol: str) -> Quote:
        symbol = symbol.upper()
        # 1) Alpaca Data API
        try:
            from app.config import settings
            if settings.ALPACA_API_KEY_ID and settings.ALPACA_API_SECRET_KEY \
                    and settings.ALPACA_API_SECRET_KEY != "YOUR_ALPACA_PAPER_SECRET_HERE":
                from alpaca.data.historical import StockHistoricalDataClient
                from alpaca.data.requests import StockLatestQuoteRequest, StockLatestTradeRequest
                client = StockHistoricalDataClient(
                    api_key=settings.ALPACA_API_KEY_ID,
                    secret_key=settings.ALPACA_API_SECRET_KEY,
                )
                trade_req = StockLatestTradeRequest(symbol_or_symbols=symbol)
                trades = client.get_stock_latest_trade(trade_req)
                trade = trades.get(symbol)
                quote_req = StockLatestQuoteRequest(symbol_or_symbols=symbol)
                quotes = client.get_stock_latest_quote(quote_req)
                q = quotes.get(symbol)
                if trade and q:
                    price = float(trade.price)
                    # Get previous close via snapshot for change calc
                    try:
                        from alpaca.data.requests import StockSnapshotRequest
                        snap_req = StockSnapshotRequest(symbol_or_symbols=symbol)
                        snaps = client.get_stock_snapshot(snap_req)
                        snap = snaps.get(symbol)
                        prev_close = float(snap.daily_bar.open) if snap and snap.daily_bar else price
                    except Exception:
                        prev_close = price
                    change = price - prev_close
                    pct = (change / prev_close * 100) if prev_close else 0.0
                    volume = int(q.ask_size or 0) + int(q.bid_size or 0)
                    return Quote(
                        symbol=symbol, price=round(price, 4),
                        change=round(change, 4), change_pct=round(pct, 4),
                        volume=volume, ts=datetime.now(timezone.utc),
                    )
        except Exception:
            pass

        # 2) yfinance fallback
        try:
            import yfinance as yf
            t = yf.Ticker(symbol)
            fast = getattr(t, "fast_info", None)
            price = float(fast["last_price"]) if fast and fast.get("last_price") else None
            prev = float(fast["previous_close"]) if fast and fast.get("previous_close") else None
            volume = int(fast["last_volume"]) if fast and fast.get("last_volume") else 0
            if price and prev:
                change = price - prev
                pct = (change / prev) * 100 if prev else 0.0
                return Quote(
                    symbol=symbol, price=price, change=change, change_pct=pct,
                    volume=volume, ts=datetime.now(timezone.utc),
                )
        except Exception:
            pass
        return self._mock_quote(symbol)

    def candles(self, symbol: str, tf: str = "1d", limit: int = 200) -> list[Candle]:
        symbol = symbol.upper()
        # 1) Alpaca Data API
        try:
            from app.config import settings
            if settings.ALPACA_API_KEY_ID and settings.ALPACA_API_SECRET_KEY \
                    and settings.ALPACA_API_SECRET_KEY != "YOUR_ALPACA_PAPER_SECRET_HERE":
                from alpaca.data.historical import StockHistoricalDataClient
                from alpaca.data.requests import StockBarsRequest
                from alpaca.data.timeframe import TimeFrame, TimeFrameUnit
                tf_map = {
                    "1m": TimeFrame(1, TimeFrameUnit.Minute),
                    "5m": TimeFrame(5, TimeFrameUnit.Minute),
                    "15m": TimeFrame(15, TimeFrameUnit.Minute),
                    "1h": TimeFrame(1, TimeFrameUnit.Hour),
                    "1d": TimeFrame.Day,
                    "1w": TimeFrame.Week,
                }
                alpaca_tf = tf_map.get(tf, TimeFrame.Day)
                days_back = max(limit * 2, 365) if tf in ("1d", "1w") else 5
                start = datetime.now(timezone.utc) - timedelta(days=days_back)
                client = StockHistoricalDataClient(
                    api_key=settings.ALPACA_API_KEY_ID,
                    secret_key=settings.ALPACA_API_SECRET_KEY,
                )
                req = StockBarsRequest(
                    symbol_or_symbols=symbol,
                    timeframe=alpaca_tf,
                    start=start,
                    limit=limit,
                    feed="iex",  # free IEX feed; use "sip" if you have unlimited plan
                )
                bars = client.get_stock_bars(req)
                df = bars.df
                if df is not None and len(df):
                    if hasattr(df.index, "levels"):
                        df = df.xs(symbol, level=0) if symbol in df.index.get_level_values(0) else df
                    df = df.tail(limit)
                    return [
                        Candle(
                            t=idx.to_pydatetime() if hasattr(idx, "to_pydatetime") else idx,
                            o=float(r["open"]), h=float(r["high"]),
                            l=float(r["low"]), c=float(r["close"]),
                            v=int(r.get("volume", 0)),
                        )
                        for idx, r in df.iterrows()
                    ]
        except Exception:
            pass

        # 2) yfinance fallback
        try:
            import yfinance as yf
            interval = {"1m": "1m", "5m": "5m", "15m": "15m", "1h": "60m", "1d": "1d", "1w": "1wk"}.get(tf, "1d")
            period = "60d" if interval.endswith("m") or interval == "60m" else "2y"
            df = yf.Ticker(symbol).history(period=period, interval=interval)
            if df is not None and len(df):
                df = df.tail(limit)
                return [
                    Candle(t=idx.to_pydatetime(), o=float(r.Open), h=float(r.High),
                           l=float(r.Low), c=float(r.Close), v=int(r.Volume or 0))
                    for idx, r in df.iterrows()
                ]
        except Exception:
            pass
        return self._mock_candles(symbol, limit)

    def candles_df(self, symbol: str, tf: str = "1d", limit: int = 400) -> pd.DataFrame:
        rows = self.candles(symbol, tf=tf, limit=limit)
        return pd.DataFrame([r.model_dump() for r in rows]).set_index("t")

    def news(self, symbol: str, limit: int = 10) -> list[NewsItem]:
        symbol = symbol.upper()
        try:
            import yfinance as yf
            items = (yf.Ticker(symbol).news or [])[:limit]
            out: list[NewsItem] = []
            for n in items:
                content = n.get("content") or n
                title = content.get("title") or n.get("title", "")
                pub = content.get("pubDate") or n.get("providerPublishTime")
                if isinstance(pub, (int, float)):
                    published = datetime.fromtimestamp(pub, tz=timezone.utc)
                elif isinstance(pub, str):
                    try:
                        published = datetime.fromisoformat(pub.replace("Z", "+00:00"))
                    except ValueError:
                        published = datetime.now(timezone.utc)
                else:
                    published = datetime.now(timezone.utc)
                url = (content.get("canonicalUrl") or {}).get("url") or n.get("link", "")
                source = (content.get("provider") or {}).get("displayName") or n.get("publisher", "")
                out.append(NewsItem(headline=title, source=source, url=url, published_at=published))
            if out:
                return out
        except Exception:
            pass
        return self._mock_news(symbol, limit)

    # ---- deterministic mock fallback (so the app runs without network) ----
    def _seed(self, symbol: str) -> int:
        return int(hashlib.sha1(symbol.encode()).hexdigest()[:8], 16)

    def _mock_quote(self, symbol: str) -> Quote:
        rng = random.Random(self._seed(symbol))
        base = 50 + rng.random() * 400
        change_pct = rng.uniform(-3.0, 3.0)
        change = base * change_pct / 100
        return Quote(
            symbol=symbol, price=round(base, 2), change=round(change, 2),
            change_pct=round(change_pct, 2), volume=rng.randint(1_000_000, 50_000_000),
            ts=datetime.now(timezone.utc),
        )

    def _mock_candles(self, symbol: str, limit: int) -> list[Candle]:
        rng = random.Random(self._seed(symbol))
        price = 50 + rng.random() * 400
        out: list[Candle] = []
        now = datetime.now(timezone.utc)
        for i in range(limit):
            t = now - timedelta(days=limit - i)
            drift = math.sin(i / 7) * 0.005
            shock = rng.gauss(0, 0.015)
            o = price
            c = max(1.0, price * (1 + drift + shock))
            h = max(o, c) * (1 + abs(rng.gauss(0, 0.004)))
            l = min(o, c) * (1 - abs(rng.gauss(0, 0.004)))
            v = rng.randint(500_000, 20_000_000)
            out.append(Candle(t=t, o=round(o, 2), h=round(h, 2), l=round(l, 2), c=round(c, 2), v=v))
            price = c
        return out

    def _mock_news(self, symbol: str, limit: int) -> list[NewsItem]:
        rng = random.Random(self._seed(symbol))
        templates = [
            f"{symbol} beats Q3 estimates as cloud revenue accelerates",
            f"Analysts upgrade {symbol} on margin expansion",
            f"{symbol} faces headwinds from regulatory scrutiny",
            f"{symbol} announces share buyback program",
            f"Hedge funds rotated into {symbol} last quarter",
        ]
        now = datetime.now(timezone.utc)
        return [
            NewsItem(
                headline=rng.choice(templates),
                source=rng.choice(["Reuters", "Bloomberg", "WSJ", "CNBC"]),
                url=f"https://example.com/{symbol.lower()}/{i}",
                published_at=now - timedelta(hours=i * 3),
                sentiment=round(rng.uniform(-0.5, 0.7), 2),
            )
            for i in range(limit)
        ]


@lru_cache
def get_market_data() -> MarketData:
    return MarketData()
