from celery import Celery
from celery.schedules import crontab

from app.config import settings


celery_app = Celery(
    "ai_trader",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
    include=["app.workers.tasks"],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    beat_schedule={
        "scan-watchlist-every-15-min": {
            "task": "app.workers.tasks.scan_watchlist",
            "schedule": crontab(minute="*/15"),
            "kwargs": {"symbols": ["AAPL", "MSFT", "NVDA", "TSLA", "SPY"]},
        },
        "autonomous-trade-cycle": {
            # Fires every AUTO_SCAN_INTERVAL_SEC seconds during the day.
            # Defaults to 60 s; use timedelta for sub-minute intervals.
            "task": "app.workers.tasks.autonomous_trade_cycle",
            "schedule": settings.AUTO_SCAN_INTERVAL_SEC,
        },
        "daily-recap": {
            "task": "app.workers.tasks.daily_recap",
            "schedule": crontab(hour=21, minute=15),  # 5:15pm ET after close
        },
    },
)

