from uuid import UUID

from fastapi import Cookie, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.models import OrganizationMember, User
from app.services.auth.session import SessionService
from app.core.config import get_settings


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_current_user(
    session_cookie: str | None = Cookie(default=None, alias="analytics_session"),
    db: Session = Depends(get_db),
) -> User:
    if not session_cookie:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    user_id = SessionService(get_settings()).read(session_cookie)
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired session")
    try:
        user = db.scalar(select(User).where(User.id == UUID(user_id)))
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid session user") from exc
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid session user")
    return user


def organization_ids_for_user(user: User, db: Session) -> list[UUID]:
    return list(db.scalars(select(OrganizationMember.organization_id).where(OrganizationMember.user_id == user.id)))
