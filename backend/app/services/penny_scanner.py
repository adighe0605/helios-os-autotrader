"""Penny stock scanner.

Maintains a curated universe of penny-stock candidates and dynamically screens
them via yfinance to surface the best setups each scan cycle.

Criteria for inclusion in a scan cycle:
  • Price between PENNY_MIN_PRICE and PENNY_MAX_PRICE (default $0.10–$5.00)
  • Daily volume ≥ PENNY_MIN_VOLUME  (default 300 K)
  • Volume surge ≥ PENNY_MIN_VOLUME_SURGE × 20-day average volume
"""
from __future__ import annotations

import statistics
from datetime import datetime, timezone
from functools import lru_cache
from typing import Optional

import pandas as pd

from app.config import settings
from app.services.market_data import get_market_data

# ── Curated penny-stock universe ───────────────────────────────────────────────
# Mix of popular names across OTC/NASDAQ/NYSE that routinely trade under $5.
# This is the initial universe; the scanner will filter to only those that
# currently meet price / volume / surge criteria.
_DEFAULT_UNIVERSE: list[str] = [
    # High-volume penny names (frequently trade < $5)
    "SNDL", "CLOV", "BBIG", "GOVX", "OCGN", "CTRM", "NAKD", "ZOM",
    "SENS", "IDEX", "XELA", "EXPR", "WKHS", "SPCE", "PLUG", "FCEL",
    "NOK", "BB", "AMC", "MVIS", "ATOS", "BFRI", "AEYE", "MMAT",
    "FFIE", "MULN", "RSSS", "IMPP", "PROG", "GFAI", "ILUS", "INPX",
    "BLNK", "SOLO", "NKLA", "RMO", "RIDE", "GOEV", "FSR", "WATT",
    "SFIX", "KOSS", "EXPR", "BYFC", "CLPS", "CTXR", "DARE", "DPLO",
    "EEIQ", "EVFM", "FBIO", "GBOX", "HIMS", "IDAI", "JNVR", "KTOV",
    "LIQT", "MDJH", "NURO", "OTRK", "PAVM", "QNRX", "RBNW", "SIGA",
    "TLSS", "UONE", "VVPR", "WISA", "XXII", "YRIV", "ZKIN", "FAMI",
    "HPNN", "INKW", "JUPW", "KAVL", "LPEN", "MITI", "NDRA", "OGEN",
    # Frequent short-squeeze penny names
    "BGFV", "CATO", "CONN", "DXLG", "GNSS", "HYMC", "IRNT", "JMIA",
    "KPLT", "LMND", "MSTR", "NKTR", "OPEN", "PAYA", "QTRX",
    # Bio/pharma penny names
    "ATHX", "BCLI", "CDTX", "DRRX", "ELTX", "FLXN", "GNPX", "HALO",
    "IDRA", "JAGX", "KALA", "LGND", "MGNX", "NEOS", "OCUL", "PRPH",
]


class PennyScanner:
    def __init__(self) -> None:
        self._universe: list[str] = list(dict.fromkeys(_DEFAULT_UNIVERSE))  # dedupe

    @property
    def universe(self) -> list[str]:
        return list(self._universe)

    def add_symbols(self, symbols: list[str]) -> None:
        for s in symbols:
            s = s.upper().strip()
            if s and s not in self._universe:
                self._universe.append(s)

    def remove_symbols(self, symbols: list[str]) -> None:
        rm = {s.upper().strip() for s in symbols}
        self._universe = [s for s in self._universe if s not in rm]

    # ── Main scan ──────────────────────────────────────────────────────────────
    def scan_universe(
        self,
        max_price: Optional[float] = None,
        min_price: Optional[float] = None,
        min_volume: Optional[int] = None,
        min_surge: Optional[float] = None,
        max_results: int = 40,
    ) -> list[dict]:
        """Return filtered penny-stock candidates sorted by volume-surge descending.

        Each entry: {symbol, price, change_pct, volume, volume_surge, avg_volume}
        """
        max_price = max_price if max_price is not None else settings.PENNY_MAX_PRICE
        min_price = min_price if min_price is not None else settings.PENNY_MIN_PRICE
        min_volume = min_volume if min_volume is not None else settings.PENNY_MIN_VOLUME
        min_surge = min_surge if min_surge is not None else settings.PENNY_MIN_VOLUME_SURGE

        md = get_market_data()
        results: list[dict] = []

        for symbol in self._universe:
            try:
                quote = md.quote(symbol)
                if quote.price <= 0:
                    continue
                if not (min_price <= quote.price <= max_price):
                    continue
                if quote.volume < min_volume:
                    continue

                avg_vol = self._avg_volume(symbol, md)
                surge = (quote.volume / avg_vol) if avg_vol > 0 else 1.0

                if surge < min_surge:
                    continue

                results.append({
                    "symbol": symbol,
                    "price": quote.price,
                    "change_pct": quote.change_pct,
                    "volume": quote.volume,
                    "volume_surge": round(surge, 2),
                    "avg_volume": int(avg_vol),
                })
            except Exception:
                continue

        results.sort(key=lambda x: x["volume_surge"], reverse=True)
        return results[:max_results]

    # ── Volume helper ──────────────────────────────────────────────────────────
    def _avg_volume(self, symbol: str, md) -> float:
        """Return 20-day average volume from daily candles."""
        try:
            df = md.candles_df(symbol, tf="1d", limit=25)
            if df is not None and len(df) >= 5:
                vols = [v for v in df["v"].tail(20).tolist() if v and v > 0]
                if vols:
                    return statistics.mean(vols)
        except Exception:
            pass
        return 0.0


@lru_cache
def get_penny_scanner() -> PennyScanner:
    return PennyScanner()
