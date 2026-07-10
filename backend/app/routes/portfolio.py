from fastapi import APIRouter

from app.brokers import get_broker
from app.schemas import PortfolioSummary, PositionOut


router = APIRouter(tags=["portfolio"])


@router.get("/portfolio", response_model=PortfolioSummary)
def portfolio() -> PortfolioSummary:
    b = get_broker()
    a = b.account()
    return PortfolioSummary(
        cash=a.cash, equity=a.equity, buying_power=a.buying_power,
        portfolio_value=a.portfolio_value, day_pnl=a.day_pnl, day_pnl_pct=a.day_pnl_pct,
        total_pnl=a.total_pnl, total_pnl_pct=a.total_pnl_pct,
        mode=b.mode,
    )


@router.get("/positions", response_model=list[PositionOut])
def positions() -> list[PositionOut]:
    b = get_broker()
    return [
        PositionOut(
            symbol=p.symbol, qty=p.qty, avg_entry_price=p.avg_entry_price,
            current_price=p.current_price, market_value=p.market_value,
            unrealized_pnl=p.unrealized_pnl, unrealized_pnl_pct=p.unrealized_pnl_pct,
        )
        for p in b.positions()
    ]
