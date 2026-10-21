from typing import Any

from authlib.integrations.starlette_client import OAuth
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.models import Organization, OrganizationMember, User


def create_google_oauth(settings: Settings) -> OAuth:
    oauth = OAuth()
    if settings.google_client_id and settings.google_client_secret:
        oauth.register(
            name="google",
            client_id=settings.google_client_id,
            client_secret=settings.google_client_secret,
            server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
            client_kwargs={"scope": "openid email profile"},
        )
    return oauth


def identity_from_claims(claims: dict[str, Any]) -> dict[str, str | None]:
    subject = claims.get("sub")
    email = claims.get("email")
    if not isinstance(subject, str) or not subject or not isinstance(email, str) or not email:
        raise ValueError("Google identity is missing a subject or email")
    return {
        "google_subject": subject,
        "email": email.lower(),
        "display_name": claims.get("name") if isinstance(claims.get("name"), str) else None,
        "profile_image_url": claims.get("picture") if isinstance(claims.get("picture"), str) else None,
    }


def upsert_google_user(db: Session, identity: dict[str, str | None], now) -> User:
    user = db.scalar(select(User).where(User.google_subject == identity["google_subject"]))
    if user is None:
        user = db.scalar(select(User).where(User.email == identity["email"]))
    if user is None:
        user = User(**identity, last_login_at=now)
        db.add(user)
        db.flush()
        organization = Organization(
            name=f"{identity['display_name'] or identity['email']}'s Workspace",
            slug=f"workspace-{user.id.hex[:12]}",
        )
        db.add(organization)
        db.flush()
        db.add(OrganizationMember(organization_id=organization.id, user_id=user.id, role="owner"))
    else:
        user.google_subject = identity["google_subject"]
        user.email = identity["email"]
        user.display_name = identity["display_name"]
        user.profile_image_url = identity["profile_image_url"]
        user.last_login_at = now
    return user
