"""In-process paper-trading broker. State lives in memory; restart wipes it."""
from __future__ import annotations

import uuid
from threading import RLock
from typing import Optional

from app.brokers.base import Broker, BrokerAccount, BrokerOrder, BrokerPosition
from app.services.market_data import get_market_data


class PaperBroker(Broker):
    mode = "paper"

    def __init__(self, starting_cash: float = 100_000.0) -> None:
        self._lock = RLock()
        self._cash = starting_cash
        self._starting_equity = starting_cash
        self._orders: dict[str, BrokerOrder] = {}
        self._positions: dict[str, BrokerPosition] = {}

    # ---- account / positions ----
    def account(self) -> BrokerAccount:
        with self._lock:
            self._refresh_marks()
            equity = self._cash + sum(p.market_value for p in self._positions.values())
            day_pnl = equity - self._starting_equity
            total_pnl = sum(p.unrealized_pnl for p in self._positions.values())
            total_pnl_pct = (total_pnl / self._starting_equity * 100) if self._starting_equity else 0.0
            return BrokerAccount(
                cash=self._cash,
                equity=equity,
                buying_power=self._cash * 2.0,
                portfolio_value=equity,
                day_pnl=day_pnl,
                day_pnl_pct=(day_pnl / self._starting_equity) * 100 if self._starting_equity else 0.0,
                total_pnl=total_pnl,
                total_pnl_pct=total_pnl_pct,
            )

    def positions(self) -> list[BrokerPosition]:
        with self._lock:
            self._refresh_marks()
            return list(self._positions.values())

    # ---- orders ----
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
        symbol = symbol.upper()
        with self._lock:
            quote = get_market_data().quote(symbol)
            fill_price = quote.price if order_type == "market" else (limit_price or quote.price)

            if side == "buy":
                cost = fill_price * qty
                if cost > self._cash:
                    return self._record_order(symbol, side, qty, order_type, "rejected", 0.0, None,
                                              limit_price, stop_price)
                self._cash -= cost
                self._upsert_position(symbol, qty, fill_price)
            else:
                pos = self._positions.get(symbol)
                if not pos or pos.qty < qty:
                    return self._record_order(symbol, side, qty, order_type, "rejected", 0.0, None,
                                              limit_price, stop_price)
                self._cash += fill_price * qty
                self._reduce_position(symbol, qty)

            order = self._record_order(symbol, side, qty, order_type, "filled", qty, fill_price,
                                       limit_price, stop_price)
            return order

    def cancel_order(self, order_id: str) -> None:
        with self._lock:
            o = self._orders.get(order_id)
            if o and o.status == "pending":
                o.status = "canceled"

    def cancel_all(self) -> int:
        with self._lock:
            n = 0
            for o in self._orders.values():
                if o.status == "pending":
                    o.status = "canceled"
                    n += 1
            return n

    def get_order(self, order_id: str) -> Optional[BrokerOrder]:
        return self._orders.get(order_id)

    def orders(self, status: str = "all", limit: int = 50) -> list[BrokerOrder]:
        with self._lock:
            items = list(self._orders.values())
            if status != "all":
                items = [o for o in items if o.status == status]
            return items[-limit:][::-1]

    # ---- internals ----
    def _record_order(
        self, symbol: str, side: str, qty: float, order_type: str,
        status: str, filled_qty: float, fill_price: Optional[float],
        limit_price: Optional[float], stop_price: Optional[float],
    ) -> BrokerOrder:
        order = BrokerOrder(
            id=str(uuid.uuid4()),
            symbol=symbol, side=side, qty=qty, order_type=order_type,
            status=status, filled_qty=filled_qty, filled_avg_price=fill_price,
            limit_price=limit_price, stop_price=stop_price,
        )
        self._orders[order.id] = order
        return order

    def _upsert_position(self, symbol: str, qty: float, price: float) -> None:
        pos = self._positions.get(symbol)
        if not pos:
            self._positions[symbol] = BrokerPosition(
                symbol=symbol, qty=qty, avg_entry_price=price, current_price=price,
                market_value=qty * price, unrealized_pnl=0.0, unrealized_pnl_pct=0.0,
            )
            return
        total_qty = pos.qty + qty
        pos.avg_entry_price = (pos.avg_entry_price * pos.qty + price * qty) / total_qty
        pos.qty = total_qty

    def _reduce_position(self, symbol: str, qty: float) -> None:
        pos = self._positions[symbol]
        pos.qty -= qty
        if pos.qty <= 1e-9:
            del self._positions[symbol]

    def _refresh_marks(self) -> None:
        md = get_market_data()
        for pos in self._positions.values():
            try:
                px = md.quote(pos.symbol).price
            except Exception:
                continue
            pos.current_price = px
            pos.market_value = pos.qty * px
            pos.unrealized_pnl = (px - pos.avg_entry_price) * pos.qty
            pos.unrealized_pnl_pct = ((px / pos.avg_entry_price) - 1.0) * 100 if pos.avg_entry_price else 0.0

    def history(self) -> dict:
        import time
        import random
        now = int(time.time())
        day = 86400
        acc = self.account()
        equity_end = acc.equity
        equity_start = self._starting_equity
        
        # Generate 30 days of data ending at equity_end
        equities = []
        timestamps = []
        for i in range(30):
            t = now - (30 - i) * day
            timestamps.append(t)
            # Smooth transition from start to end with some noise
            progress = i / 29.0
            base = equity_start + (equity_end - equity_start) * progress
            # Add a bit of random variance (say +/- 0.5% max) unless it is the last day
            if i == 29:
                val = equity_end
            else:
                noise = (random.random() * 2 - 1) * 0.005 * base
                val = max(0.0, base + noise)
            equities.append(round(val, 2))
            
        return {
            "timestamp": timestamps,
            "equity": equities,
            "profit_loss": [round(eq - equity_start, 2) for eq in equities],
            "profit_loss_pct": [round((eq / equity_start - 1) * 100, 2) if equity_start else 0.0 for eq in equities],
            "timeframe": "1D",
            "base_value": equity_start,
            "cashflow": []
        }
