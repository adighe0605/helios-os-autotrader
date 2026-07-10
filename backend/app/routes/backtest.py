import itertools
from typing import Optional

from fastapi import APIRouter, HTTPException

from app.schemas import BacktestRequest, BacktestResult
from app.services.backtester import run_backtest


router = APIRouter(prefix="/backtest", tags=["backtest"])

_cache: dict[int, dict] = {}
_id_seq = itertools.count(start=1)


@router.post("/run", response_model=BacktestResult)
def run(body: BacktestRequest) -> BacktestResult:
    try:
        result = run_backtest(
            symbol=body.symbol, strategy=body.strategy,
            start=body.start, end=body.end,
            initial_capital=body.initial_capital,
        )
    except ValueError as e:
        raise HTTPException(400, str(e)) from e
    bt_id = next(_id_seq)
    _cache[bt_id] = result
    return BacktestResult(id=bt_id, **result)


@router.get("/{bt_id}", response_model=BacktestResult)
def get(bt_id: int) -> BacktestResult:
    data: Optional[dict] = _cache.get(bt_id)
    if not data:
        raise HTTPException(404, "backtest not found")
    return BacktestResult(id=bt_id, **data)


@router.get("", response_model=list[dict])
def list_recent() -> list[dict]:
    return [{"id": k, "symbol": v["symbol"], "strategy": v["strategy"],
             "total_return_pct": v["total_return_pct"]} for k, v in _cache.items()]
