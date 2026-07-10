from functools import lru_cache
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Core
    TRADING_MODE: Literal["paper", "live"] = "paper"
    ENVIRONMENT: str = "development"
    LOG_LEVEL: str = "INFO"
    SECRET_KEY: str = "change-me"

    # DB / Redis
    DATABASE_URL: str = "postgresql+psycopg://aitrader:aitrader@db:5432/aitrader"
    REDIS_URL: str = "redis://redis:6379/0"
    CELERY_BROKER_URL: str = "redis://redis:6379/1"
    CELERY_RESULT_BACKEND: str = "redis://redis:6379/2"

    # Auth
    JWT_SECRET: str = "change-me-jwt"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 1440
    CORS_ORIGINS: str = "http://localhost:3001"

    # Anthropic
    ANTHROPIC_API_KEY: str = ""
    ANTHROPIC_MODEL: str = "claude-opus-4-7"
    ANTHROPIC_FAST_MODEL: str = "claude-haiku-4-5-20251001"

    # Alpaca
    ALPACA_BASE_URL: str = "https://paper-api.alpaca.markets"
    ALPACA_API_KEY_ID: str = ""
    ALPACA_API_SECRET_KEY: str = ""
    ALPACA_DATA_URL: str = "https://data.alpaca.markets"

    # Market data
    POLYGON_API_KEY: str = ""
    FINNHUB_API_KEY: str = ""
    ALPHA_VANTAGE_API_KEY: str = ""

    # Risk
    RISK_MAX_DAILY_LOSS_PCT: float = 2.0
    RISK_MAX_POSITION_PCT: float = 10.0
    RISK_MAX_DRAWDOWN_PCT: float = 15.0
    RISK_MAX_TRADES_PER_DAY: int = 25
    RISK_COOLDOWN_AFTER_LOSS_MIN: int = 15

    # Autonomous trading
    AUTONOMOUS_MODE: bool = False
    AUTO_MIN_CONFIDENCE: float = 0.70       # minimum AI confidence to auto-execute
    AUTO_MAX_POSITION_PCT: float = 3.0      # max % of equity per single auto-trade
    AUTO_SCAN_INTERVAL_SEC: int = 60        # how often the autonomous loop fires (Celery beat)
    AUTO_MAX_CONCURRENT_POSITIONS: int = 5  # max open auto-trade positions at once

    # Penny stock filters
    PENNY_MAX_PRICE: float = 5.0            # only trade stocks at or below this price
    PENNY_MIN_PRICE: float = 0.10           # avoid sub-penny traps
    PENNY_MIN_VOLUME: int = 300_000         # minimum daily volume for safety
    PENNY_MIN_VOLUME_SURGE: float = 1.5     # current vol must be ≥ X × 20-day avg vol
    PENNY_MAX_SPREAD_PCT: float = 3.0       # skip if bid-ask spread > 3% of price

    # Notifications
    SLACK_WEBHOOK_URL: str = ""
    DISCORD_WEBHOOK_URL: str = ""
    SENDGRID_API_KEY: str = ""
    TWILIO_ACCOUNT_SID: str = ""
    TWILIO_AUTH_TOKEN: str = ""
    TWILIO_FROM_NUMBER: str = ""

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
