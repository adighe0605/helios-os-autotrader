from typing import Any, Optional
from fastapi import APIRouter
from pydantic import BaseModel

from app.services.oracle import run_oracle_query


router = APIRouter(prefix="/oracle", tags=["oracle"])


class OracleChatRequest(BaseModel):
    prompt: str
    history: Optional[list[dict[str, str]]] = None


class OracleChatResponse(BaseModel):
    response: str


@router.post("/chat", response_model=OracleChatResponse)
def oracle_chat(body: OracleChatRequest) -> OracleChatResponse:
    res = run_oracle_query(body.prompt, body.history)
    return OracleChatResponse(response=res)
