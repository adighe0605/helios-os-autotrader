"""APScheduler-based background scheduler — replaces Celery+Redis.
Runs inside the FastAPI process. No external broker needed.
"""
from __future__ import annotations

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from apscheduler.triggers.cron import CronTrigger
from loguru import logger

from app.config import settings

scheduler = AsyncIOScheduler(timezone="UTC")


def setup_scheduler() -> None:
    """Register all periodic jobs. Called from lifespan startup."""

    # Autonomous trade cycle — every AUTO_SCAN_INTERVAL_SEC seconds
    scheduler.add_job(
        _autonomous_trade_cycle,
        trigger=IntervalTrigger(seconds=settings.AUTO_SCAN_INTERVAL_SEC),
        id="autonomous_trade_cycle",
        replace_existing=True,
        misfire_grace_time=30,
    )

    # Watchlist scan — every 15 minutes
    scheduler.add_job(
        _scan_watchlist,
        trigger=IntervalTrigger(minutes=15),
        id="scan_watchlist",
        replace_existing=True,
        misfire_grace_time=60,
    )

    # Daily recap — 9:15 PM UTC (≈5:15 PM ET)
    scheduler.add_job(
        _daily_recap,
        trigger=CronTrigger(hour=21, minute=15, timezone="UTC"),
        id="daily_recap",
        replace_existing=True,
    )

    logger.info(
        "Scheduler configured: auto-trade every {interval}s, watchlist every 15m",
        interval=settings.AUTO_SCAN_INTERVAL_SEC,
    )


# ── Job implementations ───────────────────────────────────────────────────────

async def _autonomous_trade_cycle() -> None:
    try:
        from app.services.auto_trader import get_auto_trader
        trader = get_auto_trader()
        orders = trader.run_cycle()
        if orders:
            logger.info("Auto-trade cycle: placed {n} order(s)", n=len(orders))
    except Exception as e:
        logger.exception("autonomous_trade_cycle failed: {e}", e=e)


async def _scan_watchlist() -> None:
    try:
        from app.agents import AgentContext, DebateEngine
        from app.services.market_data import get_market_data
        symbols = ["AAPL", "MSFT", "NVDA", "TSLA", "SPY"]
        md = get_market_data()
        engine = DebateEngine()
        for sym in symbols:
            try:
                quote = md.quote(sym)
                candles = md.candles_df(sym, tf="1d", limit=300)
                news = "  ".join(n.headline for n in md.news(sym, limit=5))
                decision = engine.decide(AgentContext(
                    symbol=sym, candles=candles, quote_price=quote.price, news_summary=news,
                ))
                logger.info("Watchlist {sym}: {v} ({c:.2f})", sym=sym, v=decision.verdict, c=decision.confidence)
            except Exception as e:
                logger.warning("Watchlist scan failed for {sym}: {e}", sym=sym, e=e)
    except Exception as e:
        logger.exception("scan_watchlist failed: {e}", e=e)


async def _daily_recap() -> None:
    logger.info("Daily recap — wire to Slack/Discord/email here.")

