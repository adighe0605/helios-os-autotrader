from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from loguru import logger

from app.config import settings
from app.db import Base, engine
from app.routes import agents, auth, backtest, market, orders, portfolio, risk, ws
from app.routes.auto_trade import router as auto_trade_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting AI Trader in {mode} mode", mode=settings.TRADING_MODE)
    try:
        Base.metadata.create_all(bind=engine)
    except Exception as e:
        logger.warning("DB create_all skipped: {e}", e=e)
    yield
    logger.info("Shutting down")


app = FastAPI(
    title="AI Trader",
    version="0.1.0",
    description="Autonomous AI-powered trading platform — multi-agent + Alpaca",
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
    return {"ok": True, "mode": settings.TRADING_MODE, "env": settings.ENVIRONMENT}


app.include_router(auth.router)
app.include_router(portfolio.router)
app.include_router(market.router)
app.include_router(orders.router)
app.include_router(agents.router)
app.include_router(backtest.router)
app.include_router(risk.router)
app.include_router(ws.router)
app.include_router(auto_trade_router)
