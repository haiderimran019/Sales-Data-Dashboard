from datetime import datetime, timezone
from urllib.parse import urlparse
from authlib.integrations.starlette_client import OAuthError
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, get_db
from app.core.config import get_settings
from app.models import User
from app.schemas.auth import UserResponse
from app.services.auth.google import create_google_oauth, identity_from_claims, upsert_google_user
from app.services.auth.session import SessionService

router = APIRouter(prefix="/api/auth", tags=["auth"])
me_router = APIRouter(prefix="/api", tags=["auth"])
settings = get_settings()
oauth = create_google_oauth(settings)


def _validate_return_to(return_to: str) -> str:
    parsed = urlparse(return_to)
    frontend = urlparse(settings.frontend_url)
    if parsed.scheme != frontend.scheme or parsed.netloc != frontend.netloc:
        return settings.frontend_url
    return return_to


@router.get("/google")
async def google_login(request: Request, return_to: str = "/"):
    if not oauth.google:
        raise HTTPException(status_code=503, detail="Google authentication is not configured")
    request.session["auth_return_to"] = _validate_return_to(return_to)
    redirect_uri = f"{settings.backend_url.rstrip('/')}/api/auth/google/callback"
    return await oauth.google.authorize_redirect(request, redirect_uri)


@router.get("/google/callback")
async def google_callback(request: Request, db: Session = Depends(get_db)):
    if not oauth.google:
        raise HTTPException(status_code=503, detail="Google authentication is not configured")
    try:
        token = await oauth.google.authorize_access_token(request)
        claims = await oauth.google.parse_id_token(request, token)
        identity = identity_from_claims(dict(claims))
    except (OAuthError, ValueError) as exc:
        raise HTTPException(status_code=401, detail="Google authentication failed") from exc

    now = datetime.now(timezone.utc)
    user = upsert_google_user(db, identity, now)
    db.commit()

    response = Response(status_code=status.HTTP_303_SEE_OTHER)
    response.headers["location"] = _validate_return_to(request.session.pop("auth_return_to", settings.frontend_url))
    response.set_cookie("analytics_session", SessionService(settings).create(str(user.id)), httponly=True, secure=settings.cookie_secure, samesite="lax", max_age=settings.session_max_age_seconds, path="/")
    return response


@router.post("/logout", status_code=204)
def logout(response: Response) -> None:
    response.delete_cookie("analytics_session", secure=settings.cookie_secure, path="/")


@me_router.get("/me", response_model=UserResponse)
def me(user: User = Depends(get_current_user)) -> User:
    return user
