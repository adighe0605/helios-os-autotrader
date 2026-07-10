from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any

import pandas as pd

from app.schemas import AgentSignal


@dataclass
class AgentContext:
    symbol: str
    candles: pd.DataFrame
    quote_price: float
    news_summary: str = ""
    extras: dict[str, Any] = field(default_factory=dict)


class BaseAgent(ABC):
    name: str = "base"

    @abstractmethod
    def evaluate(self, ctx: AgentContext) -> AgentSignal: ...
