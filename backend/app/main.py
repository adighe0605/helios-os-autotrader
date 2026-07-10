from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from loguru import logger

from app.config import settings
from app.db import Base, engine
from app.routes import agents, auth, backtest, market, orders, portfolio, risk, ws
from app.routes.auto_trade import router as auto_trade_router
from app.workers.celery_app import scheduler, setup_scheduler


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting AI Trader — mode={mode} env={env}", mode=settings.TRADING_MODE, env=settings.ENVIRONMENT)

    # DB tables
    try:
        Base.metadata.create_all(bind=engine)
    except Exception as e:
        logger.warning("DB create_all skipped: {e}", e=e)

    # Start background scheduler (replaces Celery+Redis)
    setup_scheduler()
    scheduler.start()
    logger.info("APScheduler started — {n} jobs registered", n=len(scheduler.get_jobs()))

    yield

    # Graceful shutdown
    scheduler.shutdown(wait=False)
    logger.info("Shutting down")


app = FastAPI(
    title="Helios AI Trader",
    version="1.0.0",
    description="Autonomous AI-powered trading — multi-agent debate + Alpaca broker",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict:
    has_alpaca_keys = bool(
        settings.ALPACA_API_KEY_ID
        and settings.ALPACA_API_SECRET_KEY
        and settings.ALPACA_API_SECRET_KEY != "YOUR_ALPACA_PAPER_SECRET_HERE"
    )
    alpaca_mode = "paper" if "paper" in settings.ALPACA_BASE_URL else "live"
    jobs = [j.id for j in scheduler.get_jobs()]
    return {
        "ok": True,
        "mode": settings.TRADING_MODE,
        "env": settings.ENVIRONMENT,
        "alpaca_connected": has_alpaca_keys,
        "alpaca_mode": alpaca_mode if has_alpaca_keys else "disconnected",
        "data_source": "alpaca" if has_alpaca_keys else "yfinance/mock",
        "scheduler_running": scheduler.running,
        "scheduled_jobs": jobs,
    }


app.include_router(auth.router)
app.include_router(portfolio.router)
app.include_router(market.router)
app.include_router(orders.router)
app.include_router(agents.router)
app.include_router(backtest.router)
app.include_router(risk.router)
app.include_router(ws.router)
app.include_router(auto_trade_router)
