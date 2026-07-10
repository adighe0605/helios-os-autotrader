"""Multi-agent debate engine. Collects per-agent signals, optionally invokes Claude to
generate the final natural-language verdict, otherwise falls back to a deterministic blend."""
from __future__ import annotations

import json
from typing import Optional

from app.agents.base import AgentContext, BaseAgent
from app.agents.mean_reversion import MeanReversionAgent
from app.agents.momentum import MomentumAgent
from app.agents.portfolio_manager import PortfolioManagerAgent
from app.agents.risk_agent import RiskAgent
from app.agents.sentiment import SentimentAgent
from app.config import settings
from app.schemas import AgentSignal, TradeDecision


_DEBATE_PROMPT = """You are the moderator of a multi-agent trading committee. The agents below each produced a verdict, a confidence score (0-1), reasoning, and supporting indicators. Synthesize a single trade decision.

Symbol: {symbol}
Current price: {price}

Agent signals:
{signals_json}

Portfolio manager suggestion (sizing only — do not let this drive direction):
{pm_json}

Return STRICT JSON matching:
{{
  "verdict": "buy" | "sell" | "hold",
  "confidence": 0.0-1.0,
  "reasoning": "...",
  "risk_reward": float | null,
  "stop_loss": float | null,
  "take_profit": float | null,
  "summary": "one tight paragraph explaining the decision for a trader"
}}

Rules:
- If risk and momentum disagree strongly, prefer hold.
- Confidence should be the agreement-weighted average, not just the max.
- Stop loss and take profit should come from the portfolio manager's suggestion when entering long.
- Be concise but specific; cite actual indicator values from the agents."""


class DebateEngine:
    def __init__(self, agents: Optional[list[BaseAgent]] = None,
                 pm: Optional[PortfolioManagerAgent] = None) -> None:
        self.agents = agents or [
            MomentumAgent(), MeanReversionAgent(), SentimentAgent(), RiskAgent(),
        ]
        self.pm = pm or PortfolioManagerAgent()

    def decide(self, ctx: AgentContext) -> TradeDecision:
        signals = [a.evaluate(ctx) for a in self.agents]
        pm_sig = self.pm.evaluate(ctx)

        # Try Claude for the verdict if a key is configured.
        decision = self._llm_decide(ctx, signals, pm_sig) if settings.ANTHROPIC_API_KEY else None
        if decision is None:
            decision = self._heuristic_decide(ctx, signals, pm_sig)

        return TradeDecision(
            symbol=ctx.symbol,
            verdict=decision["verdict"],
            confidence=float(decision["confidence"]),
            reasoning=decision["reasoning"],
            risk_reward=decision.get("risk_reward"),
            stop_loss=decision.get("stop_loss"),
            take_profit=decision.get("take_profit"),
            signals=signals,
            summary=decision["summary"],
        )

    # ---- LLM path ----
    def _llm_decide(self, ctx: AgentContext, signals: list[AgentSignal],
                    pm: AgentSignal) -> Optional[dict]:
        try:
            import anthropic
            client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
            prompt = _DEBATE_PROMPT.format(
                symbol=ctx.symbol,
                price=ctx.quote_price,
                signals_json=json.dumps([s.model_dump() for s in signals], indent=2, default=str),
                pm_json=json.dumps(pm.model_dump(), indent=2, default=str),
            )
            msg = client.messages.create(
                model=settings.ANTHROPIC_MODEL,
                max_tokens=900,
                messages=[{"role": "user", "content": prompt}],
            )
            raw = "".join(b.text for b in msg.content if getattr(b, "type", "") == "text")
            start, end = raw.find("{"), raw.rfind("}")
            if start == -1 or end == -1:
                return None
            data = json.loads(raw[start: end + 1])
            return data
        except Exception:
            return None

    # ---- heuristic fallback ----
    def _heuristic_decide(self, ctx: AgentContext, signals: list[AgentSignal],
                          pm: AgentSignal) -> dict:
        weight = {"buy": 0, "sell": 0, "hold": 0}
        total_conf = 0.0
        for s in signals:
            weight[s.verdict] += s.confidence
            total_conf += s.confidence

        verdict = max(weight, key=weight.get)
        confidence = round(weight[verdict] / max(1e-6, total_conf), 3)
        sup = ", ".join(f"{s.agent}={s.verdict}({s.confidence:.2f})" for s in signals)
        ind = pm.indicators
        sl, tp = ind.get("stop_loss"), ind.get("take_profit")
        rr = None
        if sl and tp and ctx.quote_price:
            risk = ctx.quote_price - sl
            reward = tp - ctx.quote_price
            rr = round(abs(reward / risk), 2) if risk else None

        summary = (f"Committee verdict: {verdict.upper()} with {confidence*100:.0f}% confidence. "
                   f"Vote breakdown: {sup}. "
                   + (f"Suggested stop {sl}, target {tp} (R:R {rr}). " if verdict == "buy" else ""))

        return {
            "verdict": verdict,
            "confidence": confidence,
            "reasoning": summary,
            "risk_reward": rr,
            "stop_loss": sl if verdict == "buy" else None,
            "take_profit": tp if verdict == "buy" else None,
            "summary": summary,
        }
