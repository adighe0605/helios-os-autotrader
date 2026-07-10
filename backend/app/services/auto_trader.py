"""Autonomous execution engine.

AutoTrader is a singleton service that, when enabled, runs a full
scan-decide-execute cycle each time ``run_cycle()`` is called (wired to a
Celery beat task).

Lifecycle:
  1. Guard: must be enabled, market must be open.
  2. Scan penny universe → filtered candidates sorted by volume surge.
  3. For each candidate:
       a. Skip if already in an open position.
       b. Skip if max concurrent positions reached.
       c. Run debate engine → TradeDecision.
       d. If verdict == "buy" and confidence ≥ threshold:
            - Size the position (ATR / equity-pct based, penny-adjusted).
            - Pass through RiskManager.
            - Place market order with bracket (stop_loss / take_profit).
            - Record to history.
  4. For each existing auto-managed position:
       - If price ≤ stop_loss or price ≥ take_profit: place sell order.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from threading import RLock
from typing import Optional

from loguru import logger

from app.agents import AgentContext, DebateEngine
from app.agents.penny_momentum import PennyMomentumAgent
from app.brokers import get_broker
from app.config import settings
from app.schemas import AutoTradeRecord, AutoTradeStatus, ScanCandidate
from app.services.market_data import get_market_data
from app.services.penny_scanner import get_penny_scanner
from app.services.risk_manager import get_risk_manager

# Blue-chip universe — liquid names above $5
_BLUECHIP_UNIVERSE: list[str] = [
    "SPY", "QQQ", "AAPL", "MSFT", "NVDA", "TSLA", "AMZN", "GOOGL", "META", "AMD",
    "JPM", "V", "JNJ", "PG", "WMT", "NFLX", "DIS", "BAC", "GS", "PYPL",
    "SOFI", "PLTR", "BA", "F", "INTC", "CRM", "ADBE", "COST", "HD", "MA",
    "COIN", "HOOD", "RIVN", "SNAP", "UBER", "DKNG", "RBLX",
]

# Maximum history records kept in memory
_MAX_HISTORY = 200


def is_market_open() -> bool:
    """Return True during NYSE/NASDAQ regular hours (9:30–16:00 ET, Mon–Fri).

    Uses UTC offset: ET = UTC-4 (EDT) or UTC-5 (EST).
    We use a simple heuristic — if the server clock is within the ET window
    on a weekday.  For production, replace with alpaca.is_market_open().
    """
    try:
        from alpaca.trading.client import TradingClient
        client = TradingClient(
            api_key=settings.ALPACA_API_KEY_ID,
            secret_key=settings.ALPACA_API_SECRET_KEY,
            paper="paper" in settings.ALPACA_BASE_URL,
        )
        clock = client.get_clock()
        return bool(clock.is_open)
    except Exception:
        pass

    # Fallback: UTC-based estimate
    from datetime import timedelta
    now_utc = datetime.now(timezone.utc)
    # EDT offset: UTC-4; use conservative range (13:30–20:00 UTC = 9:30–16:00 ET)
    market_open_utc = now_utc.replace(hour=13, minute=30, second=0, microsecond=0)
    market_close_utc = now_utc.replace(hour=20, minute=0, second=0, microsecond=0)
    return (now_utc.weekday() < 5) and (market_open_utc <= now_utc < market_close_utc)


class AutoTrader:
    def __init__(self) -> None:
        self._lock = RLock()
        self._enabled: bool = settings.AUTONOMOUS_MODE
        self._min_confidence: float = settings.AUTO_MIN_CONFIDENCE
        self._max_price: float = settings.PENNY_MAX_PRICE
        self._min_volume: int = settings.PENNY_MIN_VOLUME
        self._max_position_pct: float = settings.AUTO_MAX_POSITION_PCT
        self._max_concurrent: int = settings.AUTO_MAX_CONCURRENT_POSITIONS

        self._history: list[AutoTradeRecord] = []
        self._managed_stops: dict[str, dict] = {}  # symbol → {stop, target, qty}
        self._last_scan_at: Optional[datetime] = None
        self._scan_count: int = 0
        self._trades_today: int = 0

        # Penny-tuned debate engine: includes PennyMomentumAgent
        from app.agents.mean_reversion import MeanReversionAgent
        from app.agents.momentum import MomentumAgent
        from app.agents.risk_agent import RiskAgent
        from app.agents.sentiment import SentimentAgent
        self._engine = DebateEngine(agents=[
            PennyMomentumAgent(),
            MeanReversionAgent(),
            SentimentAgent(),
            RiskAgent(),
        ])
        # Blue-chip engine uses broader momentum signals
        self._bc_engine = DebateEngine(agents=[
            MomentumAgent(),
            MeanReversionAgent(),
            SentimentAgent(),
            RiskAgent(),
        ])

        # Allocation split: penny vs blue chip (percentages, sum to 100)
        self._penny_alloc_pct: float = float(settings.AUTO_PENNY_ALLOCATION_PCT) if hasattr(settings, "AUTO_PENNY_ALLOCATION_PCT") else 70.0
        self._bc_alloc_pct: float = 100.0 - self._penny_alloc_pct

    # ── Status / settings ─────────────────────────────────────────────────────
    def status(self) -> AutoTradeStatus:
        with self._lock:
            return AutoTradeStatus(
                enabled=self._enabled,
                min_confidence=self._min_confidence,
                max_price=self._max_price,
                min_volume=self._min_volume,
                max_position_pct=self._max_position_pct,
                max_concurrent_positions=self._max_concurrent,
                market_open=is_market_open(),
                last_scan_at=self._last_scan_at,
                scan_count=self._scan_count,
                trades_today=self._trades_today,
            )

    def enable(self) -> None:
        with self._lock:
            self._enabled = True
            logger.info("AutoTrader ENABLED")

    def disable(self) -> None:
        with self._lock:
            self._enabled = False
            logger.info("AutoTrader DISABLED")

    def update_settings(
        self,
        min_confidence: Optional[float] = None,
        max_price: Optional[float] = None,
        min_volume: Optional[int] = None,
        max_position_pct: Optional[float] = None,
        max_concurrent_positions: Optional[int] = None,
    ) -> None:
        with self._lock:
            if min_confidence is not None:
                self._min_confidence = max(0.5, min(1.0, min_confidence))
            if max_price is not None:
                self._max_price = max(0.01, min(10.0, max_price))
            if min_volume is not None:
                self._min_volume = max(1_000, min_volume)
            if max_position_pct is not None:
                self._max_position_pct = max(0.5, min(20.0, max_position_pct))
            if max_concurrent_positions is not None:
                self._max_concurrent = max(1, min(20, max_concurrent_positions))

    def history(self, limit: int = 50) -> list[AutoTradeRecord]:
        with self._lock:
            return list(reversed(self._history[-limit:]))

    # ── Scan for UI ──────────────────────────────────────────────────────────
    def scan_candidates(self) -> list[ScanCandidate]:
        """Run a scan pass and return AI-scored penny candidates (no order execution)."""
        scanner = get_penny_scanner()
        raw = scanner.scan_universe(
            max_price=self._max_price,
            min_volume=self._min_volume,
        )
        md = get_market_data()
        out: list[ScanCandidate] = []
        for item in raw[:30]:
            symbol = item["symbol"]
            try:
                candles = md.candles_df(symbol, tf="1d", limit=300)
                if candles.empty:
                    continue
                news = md.news(symbol, limit=5)
                news_summary = "  ".join(n.headline for n in news)
                ctx = AgentContext(
                    symbol=symbol,
                    candles=candles,
                    quote_price=item["price"],
                    news_summary=news_summary,
                )
                decision = self._engine.decide(ctx)
                out.append(ScanCandidate(
                    symbol=symbol,
                    price=item["price"],
                    change_pct=item["change_pct"],
                    volume=item["volume"],
                    volume_surge=item["volume_surge"],
                    ai_score=decision.confidence,
                    verdict=decision.verdict,
                    confidence=decision.confidence,
                    stop_loss=decision.stop_loss,
                    take_profit=decision.take_profit,
                    summary=decision.summary,
                    scanned_at=datetime.now(timezone.utc),
                ))
            except Exception as exc:
                logger.debug("scan_candidates skipped {s}: {e}", s=symbol, e=exc)
        out.sort(key=lambda x: x.confidence, reverse=True)
        return out

    # ── Main execution cycle ─────────────────────────────────────────────────
    def run_cycle(self) -> list[AutoTradeRecord]:
        """Execute one autonomous scan-decide-trade cycle.

        Called by the Celery beat task every AUTO_SCAN_INTERVAL_SEC seconds.
        Returns the list of orders placed this cycle.
        """
        with self._lock:
            if not self._enabled:
                return []

        if not is_market_open():
            logger.debug("AutoTrader: market closed, skipping cycle")
            return []

        logger.info("AutoTrader: starting cycle")
        broker = get_broker()
        risk = get_risk_manager()
        md = get_market_data()
        scanner = get_penny_scanner()

        try:
            account = broker.account()
        except Exception as e:
            logger.error("AutoTrader: cannot fetch account: {e}", e=e)
            return []

        # Current open positions (to avoid doubling up + manage stops)
        try:
            current_positions = {p.symbol: p for p in broker.positions()}
        except Exception:
            current_positions = {}

        cycle_orders: list[AutoTradeRecord] = []

        # ── Step 1: Manage existing positions ────────────────────────────────
        for symbol, pos in list(current_positions.items()):
            if symbol not in self._managed_stops:
                continue
            stop_info = self._managed_stops[symbol]
            cur_price = pos.current_price
            if cur_price <= 0:
                continue

            hit_stop = cur_price <= stop_info.get("stop", 0)
            hit_target = cur_price >= stop_info.get("target", float("inf"))

            if hit_stop or hit_target:
                reason = "stop_loss" if hit_stop else "take_profit"
                logger.info("AutoTrader: closing {s} at {p:.4f} ({r})", s=symbol, p=cur_price, r=reason)
                try:
                    order = broker.place_order(
                        symbol=symbol, side="sell", qty=pos.qty, order_type="market"
                    )
                    pnl = (cur_price - stop_info.get("entry", cur_price)) * pos.qty
                    risk.record_trade(realized_pnl=pnl)
                    rec = self._make_record(
                        symbol=symbol, side="sell", qty=pos.qty, price=cur_price,
                        order_id=order.id, verdict="sell", confidence=1.0,
                        reasoning=f"Auto-close: {reason} triggered @ {cur_price:.4f}",
                    )
                    cycle_orders.append(rec)
                    self._managed_stops.pop(symbol, None)
                except Exception as e:
                    logger.error("AutoTrader: close order failed for {s}: {e}", s=symbol, e=e)

        # ── Step 2: Check capacity ────────────────────────────────────────────
        with self._lock:
            concurrent_limit = self._max_concurrent
            min_conf = self._min_confidence
            max_price = self._max_price
            min_volume = self._min_volume
            max_pos_pct = self._max_position_pct
            penny_alloc = self._penny_alloc_pct
            bc_alloc = self._bc_alloc_pct

        open_auto = len(self._managed_stops)
        if open_auto >= concurrent_limit:
            logger.info("AutoTrader: at max concurrent positions ({n}), skipping new entries", n=open_auto)
            self._update_scan_meta()
            return cycle_orders

        # Determine slot budgets based on allocation split
        total_slots = concurrent_limit - open_auto
        penny_slots = max(1, round(total_slots * penny_alloc / 100))
        bc_slots    = max(0, total_slots - penny_slots)
        logger.info(
            "AutoTrader: {t} open slots — penny={p}, blue_chip={b}",
            t=total_slots, p=penny_slots, b=bc_slots,
        )

        # ── Step 3a: Penny stock entries (70% allocation) ─────────────────────
        raw_candidates = scanner.scan_universe(max_price=max_price, min_volume=min_volume)
        penny_placed = 0

        for item in raw_candidates:
            if penny_placed >= penny_slots:
                break

            symbol = item["symbol"]
            if symbol in current_positions:
                continue

            try:
                candles = md.candles_df(symbol, tf="1d", limit=300)
                if candles.empty:
                    continue

                news = md.news(symbol, limit=5)
                news_summary = "  ".join(n.headline for n in news)
                ctx = AgentContext(
                    symbol=symbol,
                    candles=candles,
                    quote_price=item["price"],
                    news_summary=news_summary,
                )
                decision = self._engine.decide(ctx)

                if decision.verdict != "buy":
                    continue
                if decision.confidence < min_conf:
                    logger.debug(
                        "AutoTrader [penny]: {s} conf {c:.2f} < {t:.2f}, skip",
                        s=symbol, c=decision.confidence, t=min_conf,
                    )
                    continue

                qty = self._size_position(item["price"], account, max_pos_pct)
                if qty < 1:
                    continue

                order_price = item["price"]
                check = risk.check_order(
                    symbol=symbol, side="buy", qty=qty,
                    price=order_price, account=account,
                )
                if not check.ok:
                    logger.info("AutoTrader [penny]: risk rejected {s}: {r}", s=symbol, r=check.reason)
                    continue

                order = broker.place_order(
                    symbol=symbol, side="buy", qty=qty, order_type="market",
                    take_profit=decision.take_profit, stop_loss=decision.stop_loss,
                )
                risk.record_trade(realized_pnl=0.0)

                self._managed_stops[symbol] = {
                    "stop": decision.stop_loss or (order_price * 0.92),
                    "target": decision.take_profit or (order_price * 1.25),
                    "entry": order_price,
                }

                rec = self._make_record(
                    symbol=symbol, side="buy", qty=qty, price=order_price,
                    order_id=order.id, verdict="buy",
                    confidence=decision.confidence,
                    reasoning=f"[PENNY] {decision.summary}",
                    stop_loss=decision.stop_loss,
                    take_profit=decision.take_profit,
                )
                cycle_orders.append(rec)
                penny_placed += 1
                logger.info(
                    "AutoTrader [penny]: BUY {s} ×{q} @ {p:.4f} (conf={c:.2f})",
                    s=symbol, q=qty, p=order_price, c=decision.confidence,
                )

            except Exception as exc:
                logger.exception("AutoTrader [penny]: cycle error for {s}: {e}", s=symbol, e=exc)

        # ── Step 3b: Blue-chip entries (30% allocation) ───────────────────────
        if bc_slots > 0:
            bc_placed = 0
            for symbol in _BLUECHIP_UNIVERSE:
                if bc_placed >= bc_slots:
                    break
                if symbol in current_positions:
                    continue

                try:
                    candles = md.candles_df(symbol, tf="1d", limit=300)
                    if candles.empty or len(candles) < 50:
                        continue

                    news = md.news(symbol, limit=5)
                    news_summary = "  ".join(n.headline for n in news)
                    price = float(candles["c"].iloc[-1])
                    ctx = AgentContext(
                        symbol=symbol,
                        candles=candles,
                        quote_price=price,
                        news_summary=news_summary,
                    )
                    decision = self._bc_engine.decide(ctx)

                    if decision.verdict != "buy":
                        continue
                    if decision.confidence < min_conf:
                        logger.debug(
                            "AutoTrader [bluechip]: {s} conf {c:.2f} < {t:.2f}, skip",
                            s=symbol, c=decision.confidence, t=min_conf,
                        )
                        continue

                    # Use 5% per blue chip position (less volatile than pennies)
                    bc_pos_pct = min(5.0, max_pos_pct * 1.5)
                    qty = self._size_position(price, account, bc_pos_pct)
                    if qty < 1:
                        continue

                    check = risk.check_order(
                        symbol=symbol, side="buy", qty=qty,
                        price=price, account=account,
                    )
                    if not check.ok:
                        logger.info("AutoTrader [bluechip]: risk rejected {s}: {r}", s=symbol, r=check.reason)
                        continue

                    stop_loss  = price * 0.97   # 3% stop for blue chips
                    take_profit = price * 1.08  # 8% target
                    order = broker.place_order(
                        symbol=symbol, side="buy", qty=qty, order_type="market",
                        take_profit=take_profit, stop_loss=stop_loss,
                    )
                    risk.record_trade(realized_pnl=0.0)

                    self._managed_stops[symbol] = {
                        "stop": stop_loss,
                        "target": take_profit,
                        "entry": price,
                    }

                    rec = self._make_record(
                        symbol=symbol, side="buy", qty=qty, price=price,
                        order_id=order.id, verdict="buy",
                        confidence=decision.confidence,
                        reasoning=f"[BLUE CHIP] {decision.summary}",
                        stop_loss=stop_loss,
                        take_profit=take_profit,
                    )
                    cycle_orders.append(rec)
                    bc_placed += 1
                    logger.info(
                        "AutoTrader [bluechip]: BUY {s} ×{q} @ {p:.2f} (conf={c:.2f})",
                        s=symbol, q=qty, p=price, c=decision.confidence,
                    )

                except Exception as exc:
                    logger.exception("AutoTrader [bluechip]: cycle error for {s}: {e}", s=symbol, e=exc)

        with self._lock:
            self._history.extend(cycle_orders)
            if len(self._history) > _MAX_HISTORY:
                self._history = self._history[-_MAX_HISTORY:]
            self._trades_today += len(cycle_orders)

        self._update_scan_meta()
        logger.info("AutoTrader: cycle done — {n} new order(s)", n=len(cycle_orders))
        return cycle_orders

    # ── Helpers ──────────────────────────────────────────────────────────────
    def _size_position(self, price: float, account, max_pct: float) -> float:
        """Return whole-share qty capped at max_pct of equity."""
        if price <= 0 or account.equity <= 0:
            return 0.0
        dollars = account.equity * (max_pct / 100.0)
        dollars = min(dollars, account.buying_power * 0.95)
        qty = dollars / price
        return max(0.0, round(qty, 0))

    def _make_record(
        self, *, symbol: str, side: str, qty: float, price: float,
        order_id: Optional[str], verdict: str, confidence: float,
        reasoning: str, stop_loss: Optional[float] = None,
        take_profit: Optional[float] = None,
    ) -> AutoTradeRecord:
        rec = AutoTradeRecord(
            id=str(uuid.uuid4()),
            symbol=symbol,
            side=side,  # type: ignore[arg-type]
            qty=qty,
            price=price,
            order_id=order_id,
            verdict=verdict,  # type: ignore[arg-type]
            confidence=confidence,
            reasoning=reasoning,
            stop_loss=stop_loss,
            take_profit=take_profit,
            status="submitted",
            executed_at=datetime.now(timezone.utc),
        )
        return rec

    def _update_scan_meta(self) -> None:
        with self._lock:
            self._last_scan_at = datetime.now(timezone.utc)
            self._scan_count += 1


# Singleton
_auto_trader: Optional[AutoTrader] = None
_trader_lock = RLock()


def get_auto_trader() -> AutoTrader:
    global _auto_trader
    with _trader_lock:
        if _auto_trader is None:
            _auto_trader = AutoTrader()
        return _auto_trader
