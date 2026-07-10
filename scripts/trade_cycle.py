#!/usr/bin/env python3
"""
Standalone autonomous trading cycle — runs via GitHub Actions cron.
Checks market hours, AUTONOMOUS_MODE flag, then executes one scan-decide-trade cycle.
"""
import os
import sys
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

# Add backend to Python path so `from app.xxx import ...` works
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "backend"))

from loguru import logger


def is_market_open() -> bool:
    """Return True if US equities market is currently open (9:30–16:00 ET, Mon–Fri)."""
    et = datetime.now(ZoneInfo("America/New_York"))
    if et.weekday() >= 5:  # Saturday=5, Sunday=6
        return False
    market_open = et.replace(hour=9, minute=30, second=0, microsecond=0)
    market_close = et.replace(hour=16, minute=0, second=0, microsecond=0)
    return market_open <= et < market_close


def main() -> None:
    dry_run = os.environ.get("DRY_RUN", "false").lower() == "true"
    autonomous = os.environ.get("AUTONOMOUS_MODE", "false").lower() == "true"
    eod_mode = os.environ.get("EOD_MODE", "false").lower() == "true"

    logger.info("=" * 60)
    logger.info("Helios AI Trader — Trade Cycle")
    logger.info(f"  Time (UTC):      {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S')}")
    logger.info(f"  Autonomous mode: {autonomous}")
    logger.info(f"  Dry run:         {dry_run}")
    logger.info(f"  EOD mode:        {eod_mode}")
    logger.info(f"  Market open:     {is_market_open()}")
    logger.info("=" * 60)

    if eod_mode:
        logger.info("EOD_MODE=true — flattening all positions before market close")
        _run_eod_flatten()
        return

    if not is_market_open():
        logger.info("Market is closed — skipping trade cycle.")
        return

    if not autonomous:
        logger.info(
            "AUTONOMOUS_MODE=false — no trades will be placed. "
            "Set AUTONOMOUS_MODE=true in GitHub Actions secrets to enable real trading."
        )
        _run_scan_only()
        return

    if dry_run:
        logger.info("DRY_RUN=true — scanning but not placing orders.")
        _run_scan_only()
        return

    _run_full_cycle()


def _run_scan_only() -> None:
    """Scan penny + blue chip universes and log candidates without placing orders."""
    try:
        from app.services.penny_scanner import get_penny_scanner
        scanner = get_penny_scanner()
        candidates = scanner.scan_universe()
        if candidates:
            logger.info(f"PENNY SCAN — {len(candidates)} candidate(s):")
            for c in candidates[:10]:
                logger.info(
                    f"  [PENNY] {c['symbol']:6s} ${c['price']:.3f}  "
                    f"vol_surge={c['volume_surge']:.1f}x  "
                    f"change={c['change_pct']:.2f}%"
                )
        else:
            logger.info("No penny candidates found this cycle.")
    except Exception as e:
        logger.exception(f"Penny scan failed: {e}")

    # Blue-chip scan (log only)
    try:
        from app.services.market_data import get_market_data
        from app.agents import AgentContext, DebateEngine
        from app.agents.momentum import MomentumAgent
        from app.agents.mean_reversion import MeanReversionAgent
        _BC_UNIVERSE = [
            "SPY", "QQQ", "AAPL", "MSFT", "NVDA", "TSLA", "AMZN", "GOOGL", "META", "AMD",
            "JPM", "V", "SOFI", "PLTR", "BA", "COIN", "UBER", "DKNG",
        ]
        md = get_market_data()
        engine = DebateEngine(agents=[MomentumAgent(), MeanReversionAgent()])
        bc_hits = []
        for sym in _BC_UNIVERSE:
            try:
                candles = md.candles_df(sym, tf="1d", limit=100)
                if candles.empty or len(candles) < 50:
                    continue
                decision = engine.decide(AgentContext(symbol=sym, candles=candles))
                if decision.verdict == "buy" and decision.confidence >= 0.60:
                    bc_hits.append((sym, float(candles["c"].iloc[-1]), decision.confidence))
            except Exception:
                continue
        if bc_hits:
            logger.info(f"BLUE CHIP SCAN — {len(bc_hits)} qualifying signal(s):")
            for sym, price, conf in bc_hits[:5]:
                logger.info(f"  [BLUE CHIP] {sym:6s} ${price:.2f}  conf={conf:.2f}")
        else:
            logger.info("No blue-chip signals above threshold this cycle.")
    except Exception as e:
        logger.exception(f"Blue-chip scan failed: {e}")


def _run_eod_flatten() -> None:
    """Close all managed positions before end of day to lock in intraday profits."""
    try:
        from app.services.auto_trader import get_auto_trader
        trader = get_auto_trader()
        orders = trader.run_cycle()  # EOD logic is triggered inside run_cycle via is_eod_time()
        if orders:
            logger.info(f"EOD flatten: {len(orders)} position(s) closed:")
            for o in orders:
                logger.info(f"  SELL {o.qty} {o.symbol} @ ${o.price:.4f}")
        else:
            logger.info("EOD flatten: no open managed positions to close.")
    except Exception as e:
        logger.exception(f"EOD flatten failed: {e}")


def _run_full_cycle() -> None:
    """Run full scan-debate-risk-execute cycle."""
    try:
        from app.services.auto_trader import get_auto_trader
        trader = get_auto_trader()
        orders = trader.run_cycle()
        if orders:
            logger.info(f"Placed {len(orders)} order(s):")
            for o in orders:
                logger.info(f"  {o.side.upper()} {o.qty} {o.symbol} @ {o.status}")
        else:
            logger.info("No orders placed this cycle (no signals met confidence threshold).")
    except Exception as e:
        logger.exception(f"Trade cycle failed: {e}")


if __name__ == "__main__":
    main()
