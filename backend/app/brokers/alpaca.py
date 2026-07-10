"""Alpaca broker adapter. Uses alpaca-py for trading + market data."""
from __future__ import annotations

from typing import Optional

from app.brokers.base import Broker, BrokerAccount, BrokerOrder, BrokerPosition
from app.config import settings


class AlpacaBroker(Broker):
    mode = "live"

    def __init__(self) -> None:
        # Lazy import so tests / paper mode don't need the package
        from alpaca.trading.client import TradingClient
        paper = "paper" in settings.ALPACA_BASE_URL
        self.mode = "paper" if paper else "live"
        self._client = TradingClient(
            api_key=settings.ALPACA_API_KEY_ID,
            secret_key=settings.ALPACA_API_SECRET_KEY,
            paper=paper,
        )

    def account(self) -> BrokerAccount:
        a = self._client.get_account()
        equity = float(a.equity)
        last_equity = float(a.last_equity or a.equity)
        day_pnl = equity - last_equity
        return BrokerAccount(
            cash=float(a.cash),
            equity=equity,
            buying_power=float(a.buying_power),
            portfolio_value=float(a.portfolio_value),
            day_pnl=day_pnl,
            day_pnl_pct=(day_pnl / last_equity * 100) if last_equity else 0.0,
        )

    def positions(self) -> list[BrokerPosition]:
        out: list[BrokerPosition] = []
        for p in self._client.get_all_positions():
            out.append(BrokerPosition(
                symbol=p.symbol,
                qty=float(p.qty),
                avg_entry_price=float(p.avg_entry_price),
                current_price=float(p.current_price or 0.0),
                market_value=float(p.market_value or 0.0),
                unrealized_pnl=float(p.unrealized_pl or 0.0),
                unrealized_pnl_pct=float(p.unrealized_plpc or 0.0) * 100,
            ))
        return out

    def place_order(
        self,
        symbol: str,
        side: str,
        qty: float,
        order_type: str = "market",
        limit_price: Optional[float] = None,
        stop_price: Optional[float] = None,
        take_profit: Optional[float] = None,
        stop_loss: Optional[float] = None,
    ) -> BrokerOrder:
        from alpaca.trading.requests import (
            MarketOrderRequest, LimitOrderRequest, StopOrderRequest,
            TakeProfitRequest, StopLossRequest,
        )
        from alpaca.trading.enums import OrderSide, TimeInForce, OrderClass

        order_side = OrderSide.BUY if side == "buy" else OrderSide.SELL
        tif = TimeInForce.DAY

        bracket = None
        order_class = OrderClass.SIMPLE
        if take_profit and stop_loss:
            bracket = {
                "take_profit": TakeProfitRequest(limit_price=float(take_profit)),
                "stop_loss": StopLossRequest(stop_price=float(stop_loss)),
            }
            order_class = OrderClass.BRACKET

        if order_type == "market":
            req = MarketOrderRequest(symbol=symbol, qty=qty, side=order_side, time_in_force=tif,
                                     order_class=order_class, **(bracket or {}))
        elif order_type == "limit":
            req = LimitOrderRequest(symbol=symbol, qty=qty, side=order_side, time_in_force=tif,
                                    limit_price=limit_price, order_class=order_class, **(bracket or {}))
        elif order_type == "stop":
            req = StopOrderRequest(symbol=symbol, qty=qty, side=order_side, time_in_force=tif,
                                   stop_price=stop_price)
        else:
            raise ValueError(f"Unsupported order_type: {order_type}")

        o = self._client.submit_order(req)
        return BrokerOrder(
            id=str(o.id),
            symbol=o.symbol, side=str(o.side.value), qty=float(o.qty),
            order_type=str(o.order_type.value), status=str(o.status.value),
            filled_qty=float(o.filled_qty or 0.0),
            filled_avg_price=float(o.filled_avg_price) if o.filled_avg_price else None,
            limit_price=float(o.limit_price) if o.limit_price else None,
            stop_price=float(o.stop_price) if o.stop_price else None,
        )

    def cancel_order(self, order_id: str) -> None:
        self._client.cancel_order_by_id(order_id)

    def cancel_all(self) -> int:
        return len(self._client.cancel_orders() or [])

    def get_order(self, order_id: str) -> Optional[BrokerOrder]:
        try:
            o = self._client.get_order_by_id(order_id)
        except Exception:
            return None
        return BrokerOrder(
            id=str(o.id), symbol=o.symbol, side=str(o.side.value), qty=float(o.qty),
            order_type=str(o.order_type.value), status=str(o.status.value),
            filled_qty=float(o.filled_qty or 0.0),
            filled_avg_price=float(o.filled_avg_price) if o.filled_avg_price else None,
        )

    def orders(self, status: str = "all", limit: int = 50) -> list[BrokerOrder]:
        from alpaca.trading.requests import GetOrdersRequest
        from alpaca.trading.enums import QueryOrderStatus
        status_map = {"all": QueryOrderStatus.ALL, "open": QueryOrderStatus.OPEN, "closed": QueryOrderStatus.CLOSED}
        req = GetOrdersRequest(status=status_map.get(status, QueryOrderStatus.ALL), limit=limit)
        rows = self._client.get_orders(req)
        return [
            BrokerOrder(
                id=str(o.id), symbol=o.symbol, side=str(o.side.value), qty=float(o.qty),
                order_type=str(o.order_type.value), status=str(o.status.value),
                filled_qty=float(o.filled_qty or 0.0),
                filled_avg_price=float(o.filled_avg_price) if o.filled_avg_price else None,
            )
            for o in rows
        ]
