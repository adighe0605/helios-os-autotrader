from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.brokers import get_broker
from app.schemas import RiskLimits
from app.services.risk_manager import get_risk_manager


router = APIRouter(prefix="/risk", tags=["risk"])


class UpdateLimitsBody(BaseModel):
    max_daily_loss_pct: float | None = Field(default=None, ge=0.1, le=20)
    max_position_pct: float | None = Field(default=None, ge=1, le=100)
    max_drawdown_pct: float | None = Field(default=None, ge=1, le=50)
    max_trades_per_day: int | None = Field(default=None, ge=1, le=500)
    cooldown_after_loss_min: int | None = Field(default=None, ge=0, le=240)


@router.get("/limits", response_model=RiskLimits)
def get_limits() -> RiskLimits:
    return RiskLimits(**get_risk_manager().limits)


@router.patch("/limits", response_model=RiskLimits)
def update_limits(body: UpdateLimitsBody) -> RiskLimits:
    rm = get_risk_manager()
    rm.update_limits(**{k: v for k, v in body.model_dump().items() if v is not None})
    return RiskLimits(**rm.limits)


@router.post("/kill-switch")
def kill_switch(arm: bool = True) -> dict:
    rm = get_risk_manager()
    rm.arm_kill_switch(arm)
    canceled = get_broker().cancel_all() if arm else 0
    return {"armed": arm, "canceled_orders": canceled}
