from fastapi import APIRouter, Query

from app.schemas import Candle, NewsItem, Quote
from app.services.market_data import get_market_data


router = APIRouter(prefix="/market", tags=["market"])


@router.get("/quote/{symbol}", response_model=Quote)
def quote(symbol: str) -> Quote:
    return get_market_data().quote(symbol)


@router.get("/candles/{symbol}", response_model=list[Candle])
def candles(symbol: str, tf: str = "1d", limit: int = Query(default=200, ge=10, le=2000)) -> list[Candle]:
    return get_market_data().candles(symbol, tf=tf, limit=limit)


@router.get("/news/{symbol}", response_model=list[NewsItem])
def news(symbol: str, limit: int = Query(default=10, ge=1, le=50)) -> list[NewsItem]:
    return get_market_data().news(symbol, limit=limit)


@router.get("/movers")
def movers() -> dict:
    md = get_market_data()
    syms = ["AAPL", "MSFT", "NVDA", "TSLA", "META", "AMZN", "GOOGL", "AMD", "NFLX", "AVGO"]
    rows = [md.quote(s) for s in syms]
    rows.sort(key=lambda q: q.change_pct, reverse=True)
    return {"gainers": [r.model_dump() for r in rows[:5]], "losers": [r.model_dump() for r in rows[-5:]]}
