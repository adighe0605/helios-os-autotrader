from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Optional


@dataclass
class BrokerOrder:
    id: str
    symbol: str
    side: str
    qty: float
    order_type: str
    status: str
    filled_qty: float
    filled_avg_price: Optional[float]
    limit_price: Optional[float] = None
    stop_price: Optional[float] = None


@dataclass
class BrokerPosition:
    symbol: str
    qty: float
    avg_entry_price: float
    current_price: float
    market_value: float
    unrealized_pnl: float
    unrealized_pnl_pct: float


@dataclass
class BrokerAccount:
    cash: float
    equity: float
    buying_power: float
    portfolio_value: float
    day_pnl: float
    day_pnl_pct: float


class Broker(ABC):
    mode: str = "paper"

    @abstractmethod
    def account(self) -> BrokerAccount: ...

    @abstractmethod
    def positions(self) -> list[BrokerPosition]: ...

    @abstractmethod
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
    ) -> BrokerOrder: ...

    @abstractmethod
    def cancel_order(self, order_id: str) -> None: ...

    @abstractmethod
    def cancel_all(self) -> int: ...

    @abstractmethod
    def get_order(self, order_id: str) -> Optional[BrokerOrder]: ...

    @abstractmethod
    def orders(self, status: str = "all", limit: int = 50) -> list[BrokerOrder]: ...
