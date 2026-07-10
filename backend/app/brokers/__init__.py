from app.brokers.base import Broker
from app.brokers.paper import PaperBroker
from app.brokers.alpaca import AlpacaBroker
from app.config import settings


def get_broker() -> Broker:
    """
    Use AlpacaBroker whenever API keys are configured.
    Paper vs live is determined by ALPACA_BASE_URL (paper-api vs api).
    Fall back to in-memory PaperBroker only when keys are absent (local dev / CI).
    """
    has_keys = bool(settings.ALPACA_API_KEY_ID and settings.ALPACA_API_SECRET_KEY
                    and settings.ALPACA_API_SECRET_KEY != "YOUR_ALPACA_PAPER_SECRET_HERE")
    if has_keys:
        return AlpacaBroker()
    return PaperBroker()


__all__ = ["Broker", "PaperBroker", "AlpacaBroker", "get_broker"]
