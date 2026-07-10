# AI Trader

Autonomous AI-powered trading platform for U.S. equities. Multi-agent reasoning, paper + live (Alpaca) execution, real-time market data, risk management, backtesting.

> **Status:** Scaffold. The frontend renders end-to-end with mock data, the backend boots and exposes the documented routes, and the AI agents call Anthropic when keys are set. Live trading is **disabled by default** and must be explicitly enabled per the safety section below.

---

## Architecture

```
ai-trader/
  frontend/           Next.js 15 + TS + Tailwind + Framer Motion + Recharts
    app/
      dashboard/      Portfolio, P&L, positions, AI insights
      trade/          Order ticket, chart, watchlist
      agents/         Multi-agent debate engine UI
      backtest/       Strategy backtests
      settings/       Risk tolerance, broker, alerts
  backend/            FastAPI + SQLAlchemy + Celery
    app/
      agents/         Momentum, mean-reversion, sentiment, risk, PM, debate
      brokers/        Alpaca adapter + paper-trading engine
      routes/         REST endpoints (portfolio, trade, market, agents, backtest)
      services/       Market data, AI orchestrator, risk manager, backtester
      models/         SQLAlchemy ORM
      workers/        Celery tasks (scheduled scans, alerts)
  docker/             Dockerfiles
  docker-compose.yml  Postgres + Redis + backend + worker + frontend
```

## Tech stack

| Layer       | Tech                                                                  |
| ----------- | --------------------------------------------------------------------- |
| Frontend    | Next.js 15, React 19, TypeScript, Tailwind, Framer Motion, Recharts   |
| Backend     | Python 3.11, FastAPI, SQLAlchemy, Alembic, Pydantic v2                |
| Async       | Celery + Redis broker                                                 |
| Storage     | PostgreSQL 16, Redis 7                                                |
| AI          | Anthropic Claude (multi-agent debate), scikit-learn, XGBoost (stubs)  |
| Market data | Alpaca Markets, Yahoo Finance, Polygon.io / Finnhub (adapters)        |
| Realtime    | FastAPI WebSocket (`/ws`)                                             |
| Auth        | JWT (HS256), optional OAuth via NextAuth on the frontend              |

## Quick start (Docker)

```bash
cp .env.example .env
# fill in ANTHROPIC_API_KEY and ALPACA_API_KEY_ID / ALPACA_API_SECRET_KEY (paper)
docker compose up --build
```

- Frontend: http://localhost:3001
- Backend:  http://localhost:8000  (docs at /docs)
- Postgres: localhost:5432  (db `aitrader`, user `aitrader`)
- Redis:    localhost:6379

## Local dev (no Docker)

```bash
# backend
cd backend
python -m venv .venv && .venv\Scripts\activate     # Windows
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# frontend (separate terminal)
cd frontend
npm install
npm run dev          # http://localhost:3001
```

## Safety: paper vs live trading

- The app **defaults to paper trading** (`TRADING_MODE=paper` in `.env`).
- Live trading requires:
  1. `TRADING_MODE=live` in the backend `.env`
  2. Live Alpaca API keys (`ALPACA_API_KEY_ID` / `ALPACA_API_SECRET_KEY` against `https://api.alpaca.markets`)
  3. Toggle in **Settings → Risk → Enable Live Trading** on the frontend
  4. Confirmation modal acknowledging the risk warning
- A kill switch in Settings cancels all open orders and disables new entries until manually re-armed.
- All orders pass through the `RiskManager` (max daily loss, max position size, max drawdown, cooldown after losses).

## Multi-agent AI engine

Six agents collaborate on every trade decision:

| Agent              | Role                                                       |
| ------------------ | ---------------------------------------------------------- |
| Momentum           | Detect breakouts using RSI/MACD/ADX + price action         |
| Mean Reversion     | Detect oversold/overbought from Bollinger + Z-score        |
| Sentiment          | Score recent news via Claude                               |
| Risk               | Estimate downside, vol-adjusted sizing                     |
| Portfolio Manager  | Decide final allocation, position sizing                   |
| Debate Engine      | Orchestrates a structured debate, returns reasoned verdict |

Output for every decision: `confidence`, `reasoning`, `signals[]`, `risk_reward`, `stop_loss`, `take_profit`.

## API surface (selected)

```
GET  /health
GET  /portfolio
GET  /positions
POST /orders
GET  /orders
GET  /market/quote/{symbol}
GET  /market/candles/{symbol}?tf=1D&limit=200
GET  /market/news/{symbol}
POST /agents/analyze            { symbol }
POST /backtest/run              { symbol, strategy, start, end }
GET  /backtest/{id}
GET  /risk/limits
POST /risk/kill-switch
WS   /ws                        live quotes + order/position updates
```

Full schema is auto-documented at `/docs`.

## Deployment

- **Frontend → Vercel.** `NEXT_PUBLIC_API_URL` points at your backend.
- **Backend → AWS** (ECS Fargate or EC2 + ALB). Postgres on RDS, Redis on ElastiCache.
- The included `docker-compose.yml` is for local development only.

## Disclaimer

This software is provided for research and educational use. Trading securities involves risk, and using algorithmic trading systems amplifies that risk. You are solely responsible for any orders this system places under your broker account. **Do not enable live trading unless you understand the code and accept the risk of total loss.**
