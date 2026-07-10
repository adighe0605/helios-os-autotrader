"""Autonomous trading REST endpoints.

GET  /auto-trade/status          → current AutoTrader status
POST /auto-trade/enable          → enable autonomous mode
POST /auto-trade/disable         → disable autonomous mode
PATCH /auto-trade/settings       → update thresholds (confidence, price, etc.)
GET  /auto-trade/history         → recent auto-executed trades
GET  /auto-trade/scan            → run a live scan pass and return scored candidates
POST /auto-trade/universe        → add symbols to scanner universe
DELETE /auto-trade/universe      → remove symbols from scanner universe
"""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Query
from pydantic import BaseModel

from app.schemas import AutoTradeRecord, AutoTradeSettings, AutoTradeStatus, ScanCandidate
from app.services.auto_trader import get_auto_trader
from app.services.penny_scanner import get_penny_scanner

router = APIRouter(prefix="/auto-trade", tags=["auto-trade"])


class UniverseUpdate(BaseModel):
    symbols: list[str]


# ── Status / control ──────────────────────────────────────────────────────────

@router.get("/status", response_model=AutoTradeStatus)
def get_status() -> AutoTradeStatus:
    return get_auto_trader().status()


@router.post("/enable")
def enable_auto_trade() -> dict:
    get_auto_trader().enable()
    return {"ok": True, "enabled": True}


@router.post("/disable")
def disable_auto_trade() -> dict:
    get_auto_trader().disable()
    return {"ok": True, "enabled": False}


@router.patch("/settings", response_model=AutoTradeStatus)
def update_settings(body: AutoTradeSettings) -> AutoTradeStatus:
    get_auto_trader().update_settings(
        min_confidence=body.min_confidence,
        max_price=body.max_price,
        min_volume=body.min_volume,
        max_position_pct=body.max_position_pct,
        max_concurrent_positions=body.max_concurrent_positions,
    )
    return get_auto_trader().status()


# ── History ───────────────────────────────────────────────────────────────────

@router.get("/history", response_model=list[AutoTradeRecord])
def get_history(limit: int = Query(50, ge=1, le=200)) -> list[AutoTradeRecord]:
    return get_auto_trader().history(limit=limit)


# ── Live scan (on-demand, no order execution) ─────────────────────────────────

@router.get("/scan", response_model=list[ScanCandidate])
def scan_now() -> list[ScanCandidate]:
    """Trigger an immediate scan pass and return AI-scored penny candidates.
    Does NOT place any orders regardless of autonomous mode state.
    """
    return get_auto_trader().scan_candidates()


# ── Universe management ───────────────────────────────────────────────────────

@router.get("/universe")
def get_universe() -> dict:
    return {"symbols": get_penny_scanner().universe}


@router.post("/universe")
def add_to_universe(body: UniverseUpdate) -> dict:
    get_penny_scanner().add_symbols(body.symbols)
    return {"ok": True, "universe_size": len(get_penny_scanner().universe)}


@router.delete("/universe")
def remove_from_universe(body: UniverseUpdate) -> dict:
    get_penny_scanner().remove_symbols(body.symbols)
    return {"ok": True, "universe_size": len(get_penny_scanner().universe)}
