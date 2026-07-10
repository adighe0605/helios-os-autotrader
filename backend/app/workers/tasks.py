from loguru import logger

from app.agents import AgentContext, DebateEngine
from app.services.auto_trader import get_auto_trader
from app.services.market_data import get_market_data
from app.workers.celery_app import celery_app


_engine = DebateEngine()


@celery_app.task
def scan_watchlist(symbols: list[str]) -> dict:
    md = get_market_data()
    out = {}
    for sym in symbols:
        try:
            quote = md.quote(sym)
            candles = md.candles_df(sym, tf="1d", limit=300)
            news = "  ".join(n.headline for n in md.news(sym, limit=5))
            decision = _engine.decide(AgentContext(
                symbol=sym, candles=candles, quote_price=quote.price, news_summary=news,
            ))
            out[sym] = {"verdict": decision.verdict, "confidence": decision.confidence}
            logger.info("Scanned {sym}: {v} ({c:.2f})", sym=sym, v=decision.verdict, c=decision.confidence)
        except Exception as e:
            logger.exception("scan_watchlist failed for {sym}: {e}", sym=sym, e=e)
    return out


@celery_app.task
def autonomous_trade_cycle() -> dict:
    """Periodic task: run one autonomous scan-decide-execute cycle."""
    try:
        trader = get_auto_trader()
        orders = trader.run_cycle()
        return {"ok": True, "orders_placed": len(orders)}
    except Exception as e:
        logger.exception("autonomous_trade_cycle failed: {e}", e=e)
        return {"ok": False, "error": str(e)}


@celery_app.task
def daily_recap() -> dict:
    logger.info("Generating daily recap (stub) — wire to Slack/Discord/email here.")
    return {"ok": True}

