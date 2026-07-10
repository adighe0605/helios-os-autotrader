from fastapi import APIRouter, HTTPException, status

from app.schemas import LoginRequest, TokenResponse
from app.security import create_access_token


router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest) -> TokenResponse:
    # Demo-only auth. Replace with real user lookup + verify_password().
    if not body.email or not body.password:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "email and password required")
    token = create_access_token(subject=body.email)
    return TokenResponse(access_token=token)


@router.post("/logout")
def logout() -> dict:
    return {"ok": True}
