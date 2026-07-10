from __future__ import annotations

import re

from app.agents.base import AgentContext, BaseAgent
from app.schemas import AgentSignal


_POSITIVE = {"beat", "beats", "upgrade", "upgraded", "strong", "surge", "buyback", "raises", "outperform",
             "accelerates", "record", "exceeds"}
_NEGATIVE = {"miss", "misses", "downgrade", "downgraded", "lawsuit", "probe", "investigation",
             "headwinds", "warns", "cut", "underperform", "fraud", "scrutiny"}


class SentimentAgent(BaseAgent):
    """Score sentiment from a news summary. Heuristic; can be swapped for an LLM call."""

    name = "sentiment"

    def evaluate(self, ctx: AgentContext) -> AgentSignal:
        text = (ctx.news_summary or "").lower()
        tokens = re.findall(r"[a-z]+", text)
        pos = sum(1 for t in tokens if t in _POSITIVE)
        neg = sum(1 for t in tokens if t in _NEGATIVE)
        total = max(1, pos + neg)
        score = (pos - neg) / total

        if score >= 0.3:
            verdict, conf, reason = "buy", min(0.85, 0.55 + score), \
                f"News skews bullish ({pos} positive / {neg} negative keywords)."
        elif score <= -0.3:
            verdict, conf, reason = "sell", min(0.85, 0.55 + abs(score)), \
                f"News skews bearish ({pos} positive / {neg} negative keywords)."
        else:
            verdict, conf, reason = "hold", 0.5, "News flow is mixed or neutral."

        return AgentSignal(
            agent=self.name, verdict=verdict, confidence=conf, reasoning=reason,
            indicators={"positive_terms": pos, "negative_terms": neg, "score": round(score, 3)},
        )
