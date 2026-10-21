from app.core.config import Settings
from datetime import datetime, timezone

from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from app.db.base import Base
from app.models import Organization, OrganizationMember, User
from app.services.auth.google import identity_from_claims, upsert_google_user
from app.services.auth.session import SessionService


def test_google_claims_keep_verified_identity_fields_only() -> None:
    identity = identity_from_claims({"sub": "google-sub", "email": "USER@EXAMPLE.COM", "name": "User", "picture": "https://example.com/user.png", "password": "must-not-be-used"})

    assert identity == {
        "google_subject": "google-sub",
        "email": "user@example.com",
        "display_name": "User",
        "profile_image_url": "https://example.com/user.png",
    }


def test_session_round_trip_and_expiration() -> None:
    session = SessionService(Settings(secret_key="test-secret", session_max_age_seconds=60))
    value = session.create("user-id")

    assert session.read(value) == "user-id"
    assert session.read("invalid") is None


def test_google_identity_creates_workspace_and_links_on_next_login() -> None:
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)
    identity = identity_from_claims({"sub": "google-sub", "email": "USER@EXAMPLE.COM", "name": "User"})
    now = datetime.now(timezone.utc)

    with Session(engine) as db:
        first_user = upsert_google_user(db, identity, now)
        db.commit()
        second_user = upsert_google_user(db, identity, now)
        organizations = list(db.scalars(select(Organization)))
        memberships = list(db.scalars(select(OrganizationMember)))

    assert first_user.id == second_user.id
    assert len(organizations) == 1
    assert len(memberships) == 1
