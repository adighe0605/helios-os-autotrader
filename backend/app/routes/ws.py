import asyncio
import json

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.brokers import get_broker
from app.services.market_data import get_market_data


router = APIRouter(tags=["ws"])


@router.websocket("/ws")
async def ws_endpoint(socket: WebSocket) -> None:
    """Pushes a snapshot every 5s: account + positions + a few quotes. Clients can also send
    {"type":"subscribe","symbols":["AAPL","TSLA"]} to drive the quote stream."""
    await socket.accept()
    symbols: list[str] = ["SPY", "QQQ"]
    md = get_market_data()
    broker = get_broker()

    async def reader() -> None:
        nonlocal symbols
        try:
            while True:
                msg = await socket.receive_text()
                try:
                    data = json.loads(msg)
                except json.JSONDecodeError:
                    continue
                if data.get("type") == "subscribe" and isinstance(data.get("symbols"), list):
                    symbols = [s.upper() for s in data["symbols"]][:25] or symbols
        except WebSocketDisconnect:
            return

    reader_task = asyncio.create_task(reader())
    try:
        while True:
            payload = {
                "type": "snapshot",
                "account": broker.account().__dict__,
                "positions": [p.__dict__ for p in broker.positions()],
                "quotes": [md.quote(s).model_dump(mode="json") for s in symbols],
            }
            await socket.send_json(payload)
            await asyncio.sleep(5)
    except WebSocketDisconnect:
        pass
    finally:
        reader_task.cancel()
