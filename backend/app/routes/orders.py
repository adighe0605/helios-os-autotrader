from fastapi import APIRouter, HTTPException, status

from app.brokers import get_broker
from app.config import settings
from app.schemas import OrderCreate, OrderOut
from app.services.market_data import get_market_data
from app.services.risk_manager import get_risk_manager


router = APIRouter(prefix="/orders", tags=["orders"])


@router.get("", response_model=list[OrderOut])
def list_orders(status: str = "all", limit: int = 50) -> list[OrderOut]:
    b = get_broker()
    return [
        OrderOut(
            id=hash(o.id) & 0xFFFFFFFF,
            broker_order_id=o.id,
            symbol=o.symbol, side=o.side, qty=o.qty, order_type=o.order_type,
            status=o.status, filled_qty=o.filled_qty,
            filled_avg_price=o.filled_avg_price, mode=b.mode,
            created_at=__import__("datetime").datetime.now(__import__("datetime").timezone.utc),
        )
        for o in b.orders(status=status, limit=limit)
    ]


@router.post("", response_model=OrderOut)
def create_order(body: OrderCreate) -> OrderOut:
    if settings.TRADING_MODE == "live" and not body.confirm_live:
        raise HTTPException(status.HTTP_400_BAD_REQUEST,
                            "Live mode requires confirm_live=true in payload.")

    broker = get_broker()
    risk = get_risk_manager()
    quote = get_market_data().quote(body.symbol)
    px = body.limit_price or quote.price

    check = risk.check_order(symbol=body.symbol, side=body.side, qty=body.qty,
                             price=px, account=broker.account())
    if not check.ok:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Risk check failed: {check.reason}")

    order = broker.place_order(
        symbol=body.symbol, side=body.side, qty=body.qty, order_type=body.order_type,
        limit_price=body.limit_price, stop_price=body.stop_price,
        take_profit=body.take_profit, stop_loss=body.stop_loss,
    )
    risk.record_trade(realized_pnl=0.0)

    return OrderOut(
        id=hash(order.id) & 0xFFFFFFFF,
        broker_order_id=order.id, symbol=order.symbol, side=order.side, qty=order.qty,
        order_type=order.order_type, status=order.status, filled_qty=order.filled_qty,
        filled_avg_price=order.filled_avg_price, mode=broker.mode,
        created_at=__import__("datetime").datetime.now(__import__("datetime").timezone.utc),
    )


@router.delete("/{order_id}")
def cancel(order_id: str) -> dict:
    get_broker().cancel_order(order_id)
    return {"ok": True}


@router.post("/cancel-all")
def cancel_all() -> dict:
    n = get_broker().cancel_all()
    return {"canceled": n}
