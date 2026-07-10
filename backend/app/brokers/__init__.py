from app.brokers.base import Broker
from app.brokers.paper import PaperBroker
from app.brokers.alpaca import AlpacaBroker
from app.config import settings


def get_broker() -> Broker:
    if settings.TRADING_MODE == "live":
        if not (settings.ALPACA_API_KEY_ID and settings.ALPACA_API_SECRET_KEY):
            raise RuntimeError("Live mode requires ALPACA_API_KEY_ID and ALPACA_API_SECRET_KEY")
        return AlpacaBroker()
    return PaperBroker()


__all__ = ["Broker", "PaperBroker", "AlpacaBroker", "get_broker"]
