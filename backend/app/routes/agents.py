from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.agents import AgentContext, DebateEngine
from app.schemas import TradeDecision
from app.services.market_data import get_market_data


router = APIRouter(prefix="/agents", tags=["agents"])
_engine = DebateEngine()


class AnalyzeRequest(BaseModel):
    symbol: str


@router.post("/analyze", response_model=TradeDecision)
def analyze(body: AnalyzeRequest) -> TradeDecision:
    symbol = body.symbol.upper().strip()
    if not symbol:
        raise HTTPException(400, "symbol required")
    md = get_market_data()
    quote = md.quote(symbol)
    candles_df = md.candles_df(symbol, tf="1d", limit=400)
    if candles_df.empty:
        raise HTTPException(404, f"No candle data for {symbol}")
    news = md.news(symbol, limit=8)
    news_summary = "  ".join(n.headline for n in news)

    ctx = AgentContext(
        symbol=symbol, candles=candles_df,
        quote_price=quote.price, news_summary=news_summary,
    )
    return _engine.decide(ctx)
