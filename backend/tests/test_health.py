from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_health() -> None:
    r = client.get("/health")
    assert r.status_code == 200
    body = r.json()
    assert body["ok"] is True
    assert body["mode"] in {"paper", "live"}


def test_portfolio_paper_mode() -> None:
    r = client.get("/portfolio")
    assert r.status_code == 200
    body = r.json()
    assert body["mode"] == "paper"
    assert body["cash"] > 0


def test_market_quote_mock_fallback() -> None:
    r = client.get("/market/quote/AAPL")
    assert r.status_code == 200
    assert r.json()["symbol"] == "AAPL"
